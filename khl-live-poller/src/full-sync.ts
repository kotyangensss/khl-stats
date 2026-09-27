// ============================================================
// Фулл-синк без Prisma: голый SQL через Hyperdrive (pg).
//
// ВАЖНО про имена колонок: Prisma по умолчанию НЕ переименовывает
// поля в snake_case — колонки в Postgres называются точно как поля
// моделей (camelCase в кавычках): "logoUrl", "homeScore",
// "periodScores", "gamesPlayed" и т.д. Именно так их и пишем.
//
// Запуск: scheduled() в index.ts по cron */30 * * * *
// (или локально: wrangler dev --test-scheduled + curl
//  "http://localhost:8787/__scheduled?cron=*/30+*+*+*+*")
// ============================================================

import { Client } from "pg";
import type { Env } from "./live-poller";

const BASE_URL = "https://www.khl.ru";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36";

type Session = { cookie: string; sessid: string };

// ---- Типы ответов khl.ru (только нужное) ----

interface RawGame {
  id: number;
  tnId: number;
  date: string;
  time_format: string;
  teama: number;
  teamb: number;
  arenaid: number;
  homeScore: string | number;
  visitorScore: string | number;
  scP: string[];
  ots?: string;
  win?: number;
  approved: number;
}

interface RawTeam {
  NAME: string;
  LOGO: string;
}

interface KhlCalendarResponse {
  status: string;
  data: {
    TEAMS: Record<string, RawTeam>;
    ARENAS: Record<string, string>;
    GAMES: Array<Record<string, RawGame[]>>;
  };
}

// ---- Сессия ----

async function getSession(): Promise<Session> {
  let url = `${BASE_URL}/`;
  const cookieJar: string[] = [];
  let html = "";

  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9",
        ...(cookieJar.length ? { Cookie: cookieJar.join("; ") } : {}),
      },
    });

    cookieJar.push(
      ...(response.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0])
    );

    const location = response.headers.get("location");
    if (!(response.status >= 300 && response.status < 400 && location)) {
      if (!response.ok) throw new Error(`Не удалось загрузить главную khl.ru: ${response.status}`);
      html = await response.text();
      break;
    }
    url = new URL(location, url).toString();
  }

  const match = html.match(/sessid["'\s:=]+([a-f0-9]{32})/i);
  if (!match) throw new Error("Не удалось получить sessid с khl.ru (full-sync)");
  return { cookie: cookieJar.join("; "), sessid: match[1] };
}

async function postKhl(path: string, session: Session, body: Record<string, string>) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Accept-Language": "ru-RU,ru;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      Cookie: session.cookie,
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

// ---- Маппинг статусов (1-в-1 из lib/khl-client.ts) ----

function gameStartUtc(game: RawGame): Date | null {
  if (!game.date) return null;
  const datePart = game.date.slice(0, 10);
  const timePart = /^\d{1,2}:\d{2}$/.test(game.time_format ?? "") ? game.time_format : "00:00";
  const parsed = new Date(`${datePart}T${timePart}:00+03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapGameStatus(game: RawGame): "SCHEDULED" | "LIVE" | "FINISHED" {
  if (game.approved === 1) return "FINISHED";
  if (Number(game.homeScore) > 0 || Number(game.visitorScore) > 0) return "LIVE";
  const start = gameStartUtc(game);
  if (start && Date.now() > start.getTime() + 5 * 60 * 1000) return "LIVE";
  return "SCHEDULED";
}

function flattenGames(games: KhlCalendarResponse["data"]["GAMES"]): RawGame[] {
  const flat: RawGame[] = [];
  for (const dayBucket of games) {
    for (const gamesOnDate of Object.values(dayBucket)) {
      if (Array.isArray(gamesOnDate)) flat.push(...gamesOnDate);
    }
  }
  return flat;
}

// ---- Безопасный парсинг чисел из khl.ru ----
// khl.ru отдаёт числовые поля строками, и иногда они пустые/битые.
// Number(undefined) даёт NaN, который pg отказывается писать в integer
// (SQLSTATE 22P02 "invalid input syntax for type integer").

function toIntOrNull(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// ---- Дельта-запросы ----

async function syncTeamsAndArenas(client: Client, calendar: KhlCalendarResponse) {
  const { TEAMS, ARENAS } = calendar.data;

  const dbTeams = await client.query<{ id: number; name: string; logoUrl: string | null }>(
    'SELECT id, name, "logoUrl" FROM "Team"'
  );
  const dbArenas = await client.query<{ id: number; city: string }>(
    'SELECT id, city FROM "Arena"'
  );

  const teamsById = new Map(dbTeams.rows.map((t) => [t.id, t]));
  const arenasById = new Map(dbArenas.rows.map((a) => [a.id, a]));

  // Команды: только новые/изменённые
  const teamValues: unknown[][] = [];
  for (const [idStr, team] of Object.entries(TEAMS)) {
    const id = Number(idStr);
    if (idStr === "0" || !id) continue;
    const existing = teamsById.get(id);
    if (existing && existing.name === team.NAME && existing.logoUrl === team.LOGO) continue;
    teamValues.push([id, team.NAME, team.LOGO ?? null]);
  }

  if (teamValues.length > 0) {
    const chunks = teamValues.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(", ");
    await client.query(
      `INSERT INTO "Team" (id, name, "logoUrl") VALUES ${chunks}
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "logoUrl" = EXCLUDED."logoUrl"`,
      teamValues.flat()
    );
  }

  // Арены — аналогично
  const arenaValues: unknown[][] = [];
  for (const [idStr, city] of Object.entries(ARENAS)) {
    const id = Number(idStr);
    if (idStr === "0" || !id || !city) continue;
    const existing = arenasById.get(id);
    if (existing && existing.city === city) continue;
    arenaValues.push([id, city]);
  }

  if (arenaValues.length > 0) {
    const chunks = arenaValues.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ");
    await client.query(
      `INSERT INTO "Arena" (id, city) VALUES ${chunks}
       ON CONFLICT (id) DO UPDATE SET city = EXCLUDED.city`,
      arenaValues.flat()
    );
  }

  return { teams: teamValues.length, arenas: arenaValues.length };
}

async function syncGames(client: Client, games: RawGame[]): Promise<{ created: number; updated: number; skipped: number }> {
  if (games.length === 0) return { created: 0, updated: 0, skipped: 0 };

  // Игры с битыми teama/teamb записать нельзя (NOT NULL + FK на Team) —
  // пропускаем их с логом, остальные обрабатываем.
  const validGames: RawGame[] = [];
  let invalidGames = 0;
  for (const game of games) {
    if (toIntOrNull(game.teama) == null || toIntOrNull(game.teamb) == null) {
      invalidGames++;
      console.warn(
        `[full-sync] игра ${game.id} пропущена: некорректные teama/teamb (${JSON.stringify(game.teama)}/${JSON.stringify(game.teamb)})`
      );
      continue;
    }
    validGames.push(game);
  }

  const ids = validGames.map((g) => g.id);
  const dbGames = await client.query<{
    id: number;
    date: Date;
    timeFormat: string | null;
    status: string;
    homeScore: number | null;
    visitorScore: number | null;
    periodScores: unknown;
    overtime: string | null;
    winnerTeamId: number | null;
  }>(
    `SELECT id, date, "timeFormat", status, "homeScore", "visitorScore",
            "periodScores", overtime, "winnerTeamId"
     FROM "Game" WHERE id = ANY($1)`,
    [ids]
  );
  const dbById = new Map(dbGames.rows.map((g) => [g.id, g]));

  const toInsert: RawGame[] = [];
  const toUpdate: RawGame[] = [];
  let skipped = 0;

  for (const game of validGames) {
    const existing = dbById.get(game.id);
    if (!existing) {
      toInsert.push(game);
      continue;
    }

    const dateChanged = new Date(game.date).getTime() !== new Date(existing.date).getTime();
    const timeChanged = game.time_format !== existing.timeFormat;
    const statusChanged = mapGameStatus(game) !== existing.status;
    const homeChanged = toIntOrNull(game.homeScore) !== existing.homeScore;
    const visitorChanged = toIntOrNull(game.visitorScore) !== existing.visitorScore;
    const otChanged = (game.ots || null) !== existing.overtime;
    const winChanged = toIntOrNull(game.win) !== existing.winnerTeamId;
    const periodChanged = JSON.stringify(game.scP ?? null) !== JSON.stringify(existing.periodScores ?? null);

    if (dateChanged || timeChanged || statusChanged || homeChanged || visitorChanged || otChanged || winChanged || periodChanged) {
      toUpdate.push(game);
    } else {
      skipped++;
    }
  }

  // Новые игры — batch-INSERT пачками по 200 (лимит параметров 65535 / 12 колонок)
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const values: unknown[] = [];
    const chunks = batch.map((_, j) => {
      const b = j * 12;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::"GameStatus", $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}::jsonb, $${b + 12}, now(), now())`;
    }).join(", ");

    for (const game of batch) {
      values.push(
        toIntOrNull(game.id),
        toIntOrNull(game.tnId),
        new Date(game.date),
        game.time_format,
        mapGameStatus(game),
        toIntOrNull(game.teama),
        toIntOrNull(game.teamb),
        toIntOrNull(game.arenaid),
        toIntOrNull(game.homeScore),
        toIntOrNull(game.visitorScore),
        game.scP ? JSON.stringify(game.scP) : null,
        toIntOrNull(game.win)
      );
    }

    await client.query(
      `INSERT INTO "Game" (
         id, "tnId", date, "timeFormat", status,
         "teamAId", "teamBId", "arenaId",
         "homeScore", "visitorScore", "periodScores", "winnerTeamId", "updatedAt", "createdAt"
       ) VALUES ${chunks}
       ON CONFLICT (id) DO NOTHING`,
      values
    );
  }

  // Изменённые — построчные UPDATE через одно соединение
  for (const game of toUpdate) {
    await client.query(
      `UPDATE "Game" SET
         date = $2,
         "timeFormat" = $3,
         status = $4::"GameStatus",
         "homeScore" = $5,
         "visitorScore" = $6,
         "periodScores" = $7::jsonb,
         overtime = $8,
         "winnerTeamId" = $9,
         "updatedAt" = now()
       WHERE id = $1`,
      [
        toIntOrNull(game.id),
        new Date(game.date),
        game.time_format,
        mapGameStatus(game),
        toIntOrNull(game.homeScore),
        toIntOrNull(game.visitorScore),
        game.scP ? JSON.stringify(game.scP) : null,
        game.ots || null,
        toIntOrNull(game.win),
      ]
    );
  }

  return { created: toInsert.length, updated: toUpdate.length, skipped };
}

// ---- Standings ----

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function goalsValue(value: unknown): [number, number] {
  if (typeof value === "string") {
    const [scored, conceded] = value.split("-").map(numberValue);
    return [scored, conceded];
  }
  return [0, 0];
}

interface StandingsTeamRow {
  id: number;
  name: string;
  logoUrl: string | null;
  conference: string;
  division: string;
  rank: number;
  gamesPlayed: number;
  wins: number;
  otWins: number;
  shootoutWins: number;
  shootoutLosses: number;
  otLosses: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  playoff: boolean;
}

function normalizeStandingsTeam(
  raw: Record<string, unknown>,
  group: { conference: string; division: string }
): StandingsTeamRow {
  const stats = (raw.stats ?? raw.s ?? {}) as Record<string, unknown>;
  const [goalsFor, goalsAgainst] = goalsValue(stats.goals ?? stats.g);
  const id = numberValue(raw.id ?? raw.clubid);
  const position = numberValue(raw.position ?? raw.r);

  return {
    id,
    name: String(raw.name ?? ""),
    logoUrl: typeof (raw.logo ?? raw.img) === "string" ? String(raw.logo ?? raw.img) : null,
    conference: group.conference,
    division: group.division,
    rank: position,
    gamesPlayed: numberValue(stats.gp),
    wins: numberValue(stats.w),
    otWins: numberValue(stats.otw),
    shootoutWins: numberValue(stats.sow),
    shootoutLosses: numberValue(stats.sol),
    otLosses: numberValue(stats.otl),
    losses: numberValue(stats.l),
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    points: numberValue(stats.pts),
    playoff: raw.is_out_playoff !== undefined ? !Boolean(raw.is_out_playoff) : Boolean(raw.playoff),
  };
}

async function syncStandings(client: Client, standingsRaw: unknown): Promise<number> {
  const response = standingsRaw as { data?: { json?: Record<string, unknown> } };
  const json = response.data?.json;
  if (!json) return 0;

  const leagueRows = (json as { league?: Record<string, { rows?: unknown[] }> }).league?.["0"]?.rows;
  const conferenceByDivision: Record<string, string> = {
    bobrov: "Западная конференция",
    tarasov: "Западная конференция",
    kharlamov: "Восточная конференция",
    chernyshev: "Восточная конференция",
  };
  const divisionNames: Record<string, string> = {
    bobrov: "Дивизион Боброва",
    tarasov: "Дивизион Тарасова",
    kharlamov: "Дивизион Харламова",
    chernyshev: "Дивизион Чернышева",
  };
  const divisions = (json as { divisions?: Array<{ item?: string; rows?: unknown[] }> }).divisions ?? [];

  const byId = new Map<number, StandingsTeamRow>();
  for (const division of divisions) {
    const group = {
      conference: conferenceByDivision[division.item ?? ""] ?? "",
      division: divisionNames[division.item ?? ""] ?? division.item ?? "",
    };
    for (const raw of division.rows ?? []) {
      if (raw && typeof raw === "object") {
        const team = normalizeStandingsTeam(raw as Record<string, unknown>, group);
        if (team.id > 0) byId.set(team.id, team);
      }
    }
  }

  const overallTeams = (leagueRows ?? [])
    .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === "object"))
    .map((t) => normalizeStandingsTeam(t, { conference: "", division: "" }))
    .filter((t) => t.id > 0 && t.name.length > 0);

  const rows = overallTeams.map((t) => {
    const known = byId.get(t.id);
    return known ? { ...known, rank: t.rank } : t;
  });

  if (rows.length === 0) return 0;

  const values: unknown[] = [];
  const chunks = rows.map((_, i) => {
    const b = i * 18;    
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12}, $${b + 13}, $${b + 14}, $${b + 15}, $${b + 16}, $${b + 17}, $${b + 18}::boolean, now())`;
  }).join(", ");

  for (const team of rows) {
    values.push(
      team.id, team.name, team.logoUrl,
      team.conference, team.division, team.rank,
      team.gamesPlayed, team.wins, team.otWins,
      team.shootoutWins, team.shootoutLosses, team.otLosses,
      team.losses, team.goalsFor, team.goalsAgainst,
      team.goalDiff, team.points, team.playoff
    );
  }

  await client.query(
    `INSERT INTO "StandingsRow" (
       "teamId", name, "logoUrl", conference, division, rank,
       "gamesPlayed", wins, "otWins", "shootoutWins", "shootoutLosses", "otLosses",
       losses, "goalsFor", "goalsAgainst", "goalDiff", points, playoff, "updatedAt"
     ) VALUES ${chunks}
     ON CONFLICT ("teamId") DO UPDATE SET
       name = EXCLUDED.name,
       "logoUrl" = EXCLUDED."logoUrl",
       conference = EXCLUDED.conference,
       division = EXCLUDED.division,
       rank = EXCLUDED.rank,
       "gamesPlayed" = EXCLUDED."gamesPlayed",
       wins = EXCLUDED.wins,
       "otWins" = EXCLUDED."otWins",
       "shootoutWins" = EXCLUDED."shootoutWins",
       "shootoutLosses" = EXCLUDED."shootoutLosses",
       "otLosses" = EXCLUDED."otLosses",
       losses = EXCLUDED.losses,
       "goalsFor" = EXCLUDED."goalsFor",
       "goalsAgainst" = EXCLUDED."goalsAgainst",
       "goalDiff" = EXCLUDED."goalDiff",
       points = EXCLUDED.points,
       playoff = EXCLUDED.playoff,
       "updatedAt" = now()`,
    values
  );

  return rows.length;
}

// ---- Главная функция ----

export async function runFullSync(env: Env): Promise<void> {
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();

  try {
    const session = await getSession();
    const [calendar, standingsRaw] = await Promise.all([
      postKhl("/rest/calendar/list/", session, { sessid: session.sessid }),
      postKhl("/rest/standings/regular/", session, {
        "values[type]": "regular",
        sessid: session.sessid,
      }),
    ]);

    const calendarData = calendar as KhlCalendarResponse;
    if (calendarData.status !== "success") {
      throw new Error(`calendar/list вернул статус "${calendarData.status}"`);
    }

    const teamStats = await syncTeamsAndArenas(client, calendarData);
    const games = flattenGames(calendarData.data.GAMES);
    const gameStats = await syncGames(client, games);
    const standingsTeams = await syncStandings(client, standingsRaw);

    console.log(
      `[full-sync] games=${games.length} created=${gameStats.created} updated=${gameStats.updated} skipped=${gameStats.skipped} teams=${teamStats.teams} arenas=${teamStats.arenas} standingsTeams=${standingsTeams}`
    );
  } catch (error) {
    console.error("[full-sync] ошибка:", error);
    throw error;
  } finally {
    await client.end();
  }
}
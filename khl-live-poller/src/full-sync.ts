// ============================================================
// src/full-sync.ts — замена app/api/sync/route.ts + sync.yml.
// Запускается по Cron Trigger раз в 30 минут (см. scheduled() в index.ts).
//
// getSession/fetchCalendar/fetchStandings и вся логика записи
// команд/арен/игр перенесены 1-в-1 из app/api/sync/route.ts + lib/sync.ts
// + lib/khl-client.ts (flattenGames, mapGameStatus, gameStartUtc).
//
// TODO: запись турнирной таблицы (saveStandingsToDb из lib/standings.ts)
// пока не перенесена — жду содержимое этой функции, чтобы не гадать
// структуру апсерта StandingsRow вслепую.
// ============================================================

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Env } from "./live-poller";

const BASE_URL = "https://www.khl.ru";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36";

type Session = { cookie: string; sessid: string };

// ---- Продублировано из lib/khl-client.ts ----

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
  errors: unknown[];
}

/** Разворачивает GAMES (массив объектов по датам) в плоский список игр */
function flattenGames(games: KhlCalendarResponse["data"]["GAMES"]): RawGame[] {
  const flat: RawGame[] = [];
  for (const dayBucket of games) {
    for (const gamesOnDate of Object.values(dayBucket)) {
      if (Array.isArray(gamesOnDate)) flat.push(...gamesOnDate);
    }
  }
  return flat;
}

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

// ---- Сессия (без кэша — при интервале 30 мин кэш с TTL 8 мин бессмысленен) ----

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

// ---- Перенесено 1-в-1 из app/api/sync/route.ts ----

async function fetchCalendar(session: Session): Promise<KhlCalendarResponse> {
  const response = await fetch(`${BASE_URL}/rest/calendar/list/`, {
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
    body: new URLSearchParams({ sessid: session.sessid }).toString(),
  });

  if (!response.ok) throw new Error(`calendar/list: ${response.status}`);
  const json = (await response.json()) as KhlCalendarResponse;
  if (json.status !== "success") throw new Error(`calendar/list вернул статус "${json.status}"`);
  return json;
}

async function fetchStandings(session: Session): Promise<unknown> {
  const response = await fetch(`${BASE_URL}/rest/standings/regular/`, {
    method: "POST",
    redirect: "manual",
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
    body: new URLSearchParams({ "values[type]": "regular", sessid: session.sessid }).toString(),
  });

  if (!response.ok) throw new Error(`standings: ${response.status}`);
  return response.json();
}

// ---- Продублировано из lib/standings.ts ----

interface StandingsTeam {
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

interface StandingsGroup {
  conference: string;
  division: string;
  teams: StandingsTeam[];
}

interface StandingsData {
  overall: StandingsGroup;
  conferenceGroups: StandingsGroup[];
  groups: StandingsGroup[];
  teamsById: Record<number, StandingsTeam>;
}

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

function normalizeTeam(
  raw: Record<string, unknown>,
  group: Pick<StandingsGroup, "conference" | "division">
): StandingsTeam {
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

function normalizeStandings(payload: unknown): StandingsData {
  const response = payload as { data?: { json?: { divisions?: unknown[] } } };
  const divisions = response.data?.json?.divisions;

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

  const groups = (Array.isArray(divisions) ? divisions : []).flatMap((division) => {
    if (!division || typeof division !== "object") return [];
    const value = division as { item?: string; rows?: unknown[] };
    const item = value.item ?? "";
    const group = {
      conference: conferenceByDivision[item] ?? "",
      division: divisionNames[item] ?? item,
    };
    const teams = (value.rows ?? [])
      .filter((team): team is Record<string, unknown> => Boolean(team && typeof team === "object"))
      .map((team) => normalizeTeam(team, group));
    return teams.length > 0 ? [{ ...group, teams }] : [];
  });

  const byId = Object.fromEntries(groups.flatMap((group) => group.teams.map((team) => [team.id, team])));

  const conferences =
    response.data?.json &&
    (response.data.json as { conferences?: Array<{ item?: string; rows?: unknown[] }> }).conferences;

  const conferenceNames: Record<string, string> = {
    west: "Западная конференция",
    east: "Восточная конференция",
  };

  const conferenceGroups = (conferences ?? []).flatMap((conference) => {
    const teams = (conference.rows ?? [])
      .filter((team): team is Record<string, unknown> => Boolean(team && typeof team === "object"))
      .map((team) => {
        const normalized = normalizeTeam(team, {
          conference: conferenceNames[conference.item ?? ""] ?? conference.item ?? "",
          division: "",
        });
        return byId[normalized.id] ? { ...byId[normalized.id], rank: normalized.rank } : normalized;
      });
    return teams.length > 0
      ? [{ conference: conferenceNames[conference.item ?? ""] ?? conference.item ?? "", division: "", teams }]
      : [];
  });

  const leagueRows =
    response.data?.json &&
    (response.data.json as { league?: Record<string, { rows?: unknown[] }> }).league?.["0"]?.rows;

  const overallTeams = (leagueRows ?? [])
    .filter((team): team is Record<string, unknown> => Boolean(team && typeof team === "object"))
    .map((team) => {
      const normalized = normalizeTeam(team, { conference: "", division: "" });
      const known = byId[normalized.id];
      return known ? { ...known, rank: normalized.rank } : normalized;
    })
    .filter((team) => team.id > 0 && team.name.length > 0);

  return {
    overall: { conference: "Общая таблица", division: "", teams: overallTeams },
    conferenceGroups,
    groups,
    teamsById: Object.fromEntries(overallTeams.map((team) => [team.id, team])),
  };
}

async function saveStandingsToDb(prisma: PrismaClient, value: StandingsData): Promise<number> {
  const rows = Object.values(value.teamsById);
  await prisma.$transaction([
    prisma.standingsRow.deleteMany(),
    ...rows.map((team) =>
      prisma.standingsRow.create({
        data: {
          teamId: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
          conference: team.conference,
          division: team.division,
          rank: team.rank,
          gamesPlayed: team.gamesPlayed,
          wins: team.wins,
          otWins: team.otWins,
          shootoutWins: team.shootoutWins,
          shootoutLosses: team.shootoutLosses,
          otLosses: team.otLosses,
          losses: team.losses,
          goalsFor: team.goalsFor,
          goalsAgainst: team.goalsAgainst,
          goalDiff: team.goalDiff,
          points: team.points,
          playoff: team.playoff,
        },
      })
    ),
  ]);
  return rows.length;
}

// ---- Перенесено 1-в-1 из lib/sync.ts::syncKhlData (без части про standings) ----

export async function runFullSync(env: Env): Promise<void> {
  const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const session = await getSession();
    const [calendar, standingsRaw] = await Promise.all([
      fetchCalendar(session),
      fetchStandings(session),
    ]);

    const { TEAMS, ARENAS } = calendar.data;

    await prisma.$transaction([
      ...Object.entries(TEAMS)
        .filter(([id]) => id !== "0")
        .map(([id, team]) =>
          prisma.team.upsert({
            where: { id: Number(id) },
            create: { id: Number(id), name: team.NAME, logoUrl: team.LOGO },
            update: { name: team.NAME, logoUrl: team.LOGO },
          })
        ),
      ...Object.entries(ARENAS)
        .filter(([id, city]) => id !== "0" && city !== "")
        .map(([id, city]) =>
          prisma.arena.upsert({
            where: { id: Number(id) },
            create: { id: Number(id), city },
            update: { city },
          })
        ),
    ]);

    const games = flattenGames(calendar.data.GAMES);

    const existingIds = new Set(
      (
        await prisma.game.findMany({
          where: { id: { in: games.map((game) => game.id) } },
          select: { id: true },
        })
      ).map((game) => game.id)
    );

    let created = 0;
    let updated = 0;

    await Promise.all(
      games.map(async (game) => {
        const existed = existingIds.has(game.id);
        await prisma.game.upsert({
          where: { id: game.id },
          create: {
            id: game.id,
            tnId: game.tnId,
            date: new Date(game.date),
            timeFormat: game.time_format,
            status: mapGameStatus(game),
            teamAId: game.teama,
            teamBId: game.teamb,
            arenaId: game.arenaid || null,
            homeScore: game.homeScore !== "" ? Number(game.homeScore) : null,
            visitorScore: game.visitorScore !== "" ? Number(game.visitorScore) : null,
            periodScores: (game.scP ?? undefined) as Prisma.InputJsonValue | undefined,
            overtime: game.ots || null,
            winnerTeamId: game.win || null,
            venue: null,
          },
          update: {
            date: new Date(game.date),
            timeFormat: game.time_format,
            status: mapGameStatus(game),
            homeScore: game.homeScore !== "" ? Number(game.homeScore) : null,
            visitorScore: game.visitorScore !== "" ? Number(game.visitorScore) : null,
            periodScores: (game.scP ?? undefined) as Prisma.InputJsonValue | undefined,
            overtime: game.ots || null,
            winnerTeamId: game.win || null,
          },
        });
        if (existed) updated++;
        else created++;
      })
    );

    let standingsTeams = 0;
    try {
      standingsTeams = await saveStandingsToDb(prisma, normalizeStandings(standingsRaw));
    } catch (error) {
      console.error("[full-sync] standings save failed:", error);
    }

    console.log(
      `[full-sync] teams=${Object.keys(TEAMS).length} games=${games.length} created=${created} updated=${updated} standingsTeams=${standingsTeams}`
    );
  } catch (error) {
    console.error("[full-sync] ошибка:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

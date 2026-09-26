/**
 * Клиент для внутреннего API khl.ru.
 *
 * ВАЖНО: этот файл — самая хрупкая часть проекта, потому что мы дёргаем
 * недокументированный эндпоинт сайта, а не официальное API. khl.ru может
 * поменять структуру страницы или способ выдачи sessid в любой момент —
 * тогда getSession() придётся поправить. Комментарии ниже объясняют, что
 * именно проверять, если что-то сломается.
 */

export interface RawGame {
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

export interface RawTeam {
  NAME: string;
  LOGO: string;
}

export interface KhlCalendarResponse {
  status: string;
  data: {
    TEAMS: Record<string, RawTeam>;
    ARENAS: Record<string, string>;
    GAMES: Array<Record<string, RawGame[]>>;
  };
  errors: unknown[];
}

export type LiveGameEvent = {
  period: number;
  time: string;
  team: "home" | "away" | string;
  scorer: string;
  assists: string[];
  score: string;
};

export type KhlGameHeader = {
  id: number;
  status?: string;
  period?: number;
  time?: string;
  arena?: string;
  score?: { home?: number | string; away?: number | string };
  goals?: LiveGameEvent[];
};

export type RawKhlGameHeader = KhlGameHeader & {
  showstatus?: string;
  game?: {
    id: number;
    arena?: string;
    homeScore?: number;
    visitorScore?: number;
    scP?: string[];
    score?: string;
  };
  proto?: {
    goals?: Record<string, Array<{
      per?: number;
      pmg_time?: string;
      teamAB?: "A" | "B" | string;
      scoreA?: string;
      scoreB?: string;
      scorer?: { name?: string };
      assist_1?: { name?: string };
      assist_2?: { name?: string };
    }>>;
  };
  isOnline?: boolean;
  online?: {
    status?: string;
    homeScore?: number;
    visitorScore?: number;
  }
};

export type KhlGameHeaderResponse = RawKhlGameHeader | {
  status: string;
  data: RawKhlGameHeader | null;
  errors?: unknown[];
};

export function normalizeGameHeader(raw: RawKhlGameHeader): KhlGameHeader {
  if (!raw.game) return raw;

  const goals = Object.values(raw.proto?.goals ?? {})
    .flat()
    .map((goal) => ({
      period: goal.per ?? 0,
      time: goal.pmg_time ?? "",
      team: goal.teamAB === "A" ? "home" : "away",
      scorer: goal.scorer?.name ?? "",
      assists: [goal.assist_1?.name, goal.assist_2?.name].filter(
        (name): name is string => Boolean(name)
      ),
      score: `${goal.scoreA ?? ""}:${goal.scoreB ?? ""}`,
    }));

  // в normalizeGameHeader:
  return {
    id: raw.game.id,
    status: raw.showstatus,
    period: raw.period,
    time: raw.time,
    arena: raw.game.arena,
    goals: goals.length > 0 ? goals : undefined,
    score: raw.game.homeScore != null || raw.game.visitorScore != null
      ? { home: raw.game.homeScore, away: raw.game.visitorScore }
      : { home: raw.online?.homeScore, away: raw.online?.visitorScore }
  };
}

/** Разворачивает GAMES (массив объектов по датам) в плоский список игр */
export function flattenGames(games: KhlCalendarResponse["data"]["GAMES"]): RawGame[] {
  const flat: RawGame[] = [];
  for (const dayBucket of games) {
    for (const gamesOnDate of Object.values(dayBucket)) {
      // В дни без матчей khl.ru отдаёт null/undefined вместо пустого массива
      if (Array.isArray(gamesOnDate)) {
        flat.push(...gamesOnDate);
      }
    }
  }
  return flat;
}

/**
 * Момент начала матча в UTC. khl.ru показывает время в московском часовом
 * поясе — считаем это так же (+03:00), другого способа узнать точнее нет.
 */
function gameStartUtc(game: RawGame): Date | null {
  if (!game.date) return null;
  const datePart = game.date.slice(0, 10);
  const timePart = /^\d{1,2}:\d{2}$/.test(game.time_format ?? "") ? game.time_format : "00:00";
  const parsed = new Date(`${datePart}T${timePart}:00+03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapGameStatus(game: RawGame): "SCHEDULED" | "LIVE" | "FINISHED" {
  if (game.approved === 1) return "FINISHED";

  // approved === 0 и есть счёт — вероятно, матч идёт прямо сейчас
  if (Number(game.homeScore) > 0 || Number(game.visitorScore) > 0) return "LIVE";

  // Счёта 0:0 недостаточно, чтобы отличить "ещё не начался" от "идёт, но
  // пока без голов" — сверяемся со временем начала (+5 мин запаса на
  // задержки/паузы).
  const start = gameStartUtc(game);
  if (start && Date.now() > start.getTime() + 5 * 60 * 1000) return "LIVE";

  return "SCHEDULED";
}

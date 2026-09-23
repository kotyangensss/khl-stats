/**
 * Клиент для внутреннего API khl.ru.
 *
 * ВАЖНО: этот файл — самая хрупкая часть проекта, потому что мы дёргаем
 * недокументированный эндпоинт сайта, а не официальное API. khl.ru может
 * поменять структуру страницы или способ выдачи sessid в любой момент —
 * тогда getSession() придётся поправить. Комментарии ниже объясняют, что
 * именно проверять, если что-то сломается.
 */

const BASE_URL = "https://www.khl.ru";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export interface Session {
  cookie: string;
  sessid: string;
}

/**
 * Заходит на главную страницу khl.ru, чтобы получить:
 *  - куки сессии (PHPSESSID и т.д.) из заголовка Set-Cookie
 *  - значение sessid, которое сайт обычно встраивает в HTML/JS главной страницы
 *
 * Если regex ниже перестанет находить sessid — откройте https://www.khl.ru/
 * в браузере, посмотрите вкладку Network при загрузке страницы, найдите,
 * где именно передаётся sessid (обычно это глобальная JS-переменная или
 * значение скрытого input), и поправьте SESSID_PATTERN.
 */
export async function getSession(): Promise<Session> {
  // ВАЖНО: khl.ru перед отдачей реальной страницы ставит "антибот" куки
  // (spid/spsc) через 307-редирект на тот же адрес. Встроенный fetch при
  // автоматическом follow НЕ передаёт куки между хопами редиректа, из-за
  // чего получается бесконечный цикл 307 → 307 → ... Поэтому обрабатываем
  // редирект вручную и сами прокидываем куки на следующий запрос.
  let url = BASE_URL + "/";
  const cookieJar: string[] = [];
  let html = "";

  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(cookieJar.length ? { Cookie: cookieJar.join("; ") } : {}),
      },
    });

    const setCookie = res.headers.getSetCookie?.() ?? [];
    cookieJar.push(...setCookie.map((c) => c.split(";")[0]));

    const location = res.headers.get("location");
    const isRedirect = res.status >= 300 && res.status < 400 && location;

    if (!isRedirect) {
      if (!res.ok) {
        throw new Error(`Не удалось загрузить главную страницу khl.ru: ${res.status}`);
      }
      html = await res.text();
      break;
    }

    url = new URL(location, url).toString();
  }

  if (!html) {
    throw new Error("khl.ru не отдал страницу после нескольких редиректов (изменилась логика антибот-защиты?)");
  }

  const cookie = cookieJar.join("; ");

  const SESSID_PATTERN = /sessid["'\s:=]+([a-f0-9]{32})/i;
  const match = html.match(SESSID_PATTERN);

  if (!match) {
    throw new Error(
      "Не удалось найти sessid на главной странице khl.ru — вероятно, сайт " +
        "изменил разметку. Смотри комментарий над getSession()."
    );
  }

  return { cookie, sessid: match[1] };
}

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

type RawKhlGameHeader = KhlGameHeader & {
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
};

type KhlGameHeaderResponse = RawKhlGameHeader | {
  status: string;
  data: RawKhlGameHeader | null;
  errors?: unknown[];
};

function normalizeGameHeader(raw: RawKhlGameHeader): KhlGameHeader {
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

  return {
    id: raw.game.id,
    status: raw.showstatus,
    arena: raw.game.arena,
    score: {
      home: raw.game.homeScore,
      away: raw.game.visitorScore,
    },
    goals,
  };
}

/**
 * Тянет календарь/результаты матчей с khl.ru.
 * dateFrom / dateTo в формате YYYY-MM-DD — при необходимости добавьте их
 * в body ниже, если API khl.ru поддерживает диапазон (проверить в Network
 * при ручном выборе дат на сайте — возможно, нужны доп. параметры, которых
 * не было в изначальном запросе).
 */
export async function fetchKhlCalendar(): Promise<KhlCalendarResponse> {
  const session = await getSession();

  const res = await fetch(BASE_URL + "/rest/calendar/list/", {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE_URL,
      Referer: BASE_URL + "/",
      Cookie: session.cookie,
    },
    body: new URLSearchParams({ sessid: session.sessid }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Запрос к calendar/list вернул ошибку: ${res.status}`);
  }

  const json = (await res.json()) as KhlCalendarResponse;

  if (json.status !== "success") {
    throw new Error(`khl.ru вернул статус "${json.status}": ${JSON.stringify(json.errors)}`);
  }

  return json;
}

/** Загружает live-события конкретного матча через недокументированный endpoint. */
export async function fetchKhlGameHeader(
  gameId: number,
  session: Session
): Promise<KhlGameHeader> {
  const body = new URLSearchParams({
    page: "preview",
    "values[tournament]": "1436",
    "values[gameid]": String(gameId),
    sessid: session.sessid,
  });
  const res = await fetch(`${BASE_URL}/rest/game/header/`, {
    method: "POST",
    headers: {
      Accept: "application/json, */*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/game/${gameId}/`,
      Cookie: session.cookie,
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Запрос game/header вернул ошибку: ${res.status}`);
  }

  const json = (await res.json()) as KhlGameHeaderResponse;
  if ("data" in json) {
    if (json.data) return normalizeGameHeader(json.data);
    throw new Error(`khl.ru не отдал live-данные для игры ${gameId}`);
  }
  if (!json || typeof json !== "object") {
    throw new Error(`khl.ru вернул некорректный header для игры ${gameId}`);
  }
  return normalizeGameHeader(json);
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

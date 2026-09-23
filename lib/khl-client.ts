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

interface Session {
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
async function getSession(): Promise<Session> {
  // ВАЖНО: khl.ru перед отдачей реальной страницы ставит "антибот" куки
  // (spid/spsc) через 307-редирект на тот же адрес. Встроенный fetch при
  // автоматическом follow НЕ передаёт куки между хопами редиректа, из-за
  // чего получается бесконечный цикл 307 → 307 → ... Поэтому обрабатываем
  // редирект вручную и сами прокидываем куки на следующий запрос.
  let url = BASE_URL + "/";
  let cookieJar: string[] = [];
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

export function mapGameStatus(game: RawGame): "SCHEDULED" | "LIVE" | "FINISHED" {
  if (game.approved === 1) return "FINISHED";
  // approved === 0 и есть счёт — вероятно, матч идёт прямо сейчас
  if (Number(game.homeScore) > 0 || Number(game.visitorScore) > 0) return "LIVE";
  return "SCHEDULED";
}

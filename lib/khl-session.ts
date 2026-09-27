const BASE_URL = "https://www.khl.ru";

export const KHL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 часа

type Session = { cookie: string; sessid: string };

let cached: { session: Session; expiresAt: number } | null = null;
let inflight: Promise<Session | null> | null = null;

async function fetchNewSession(): Promise<Session | null> {
  let url = `${BASE_URL}/`;
  const cookies = new Map<string, string>(); // dedupe: новая кука перекрывает старую
  let html = "";

  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": KHL_UA, // один UA везде
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9",
        ...(cookies.size
          ? { Cookie: [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ") }
          : {}),
      },
      cache: "no-store",
    });

    for (const c of response.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const idx = pair.indexOf("=");
      if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }

    const location = response.headers.get("location");
    if (!(response.status >= 300 && response.status < 400 && location)) {
      if (!response.ok) return null;
      html = await response.text();
      break;
    }
    url = new URL(location, url).toString();
  }

  const match = html.match(/sessid["'\s:=]+([a-f0-9]{32})/i);
  if (!match) return null;

  return {
    cookie: [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    sessid: match[1],
  };
}

/** Кэшированная сессия: не больше одного запроса на TTL, параллельные вызовы шарят промис. */
export async function getSession(force = false): Promise<Session | null> {
  if (!force && cached && cached.expiresAt > Date.now()) return cached.session;
  if (!force && inflight) return inflight;

  inflight = fetchNewSession()
    .then((session) => {
      if (session) {
        cached = { session, expiresAt: Date.now() + SESSION_TTL_MS };
        return session;
      }
      cached = null; // неудачу не кэшируем — следующий вызов попробует снова
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Сброс кэша — вызывай, когда POST вернул 403/307-цикл. */
export function invalidateSession(): void {
  cached = null;
}

/** Обновить куку после WAF-bounce, чтобы не терять её между рендерами. */
export function updateSessionCookie(cookie: string): void {
  if (cached) cached = { ...cached, session: { ...cached.session, cookie } };
}
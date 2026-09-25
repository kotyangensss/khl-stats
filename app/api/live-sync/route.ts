import { NextRequest, NextResponse } from "next/server";
import { syncLiveGames } from "@/lib/sync";
import { normalizeGameHeader } from "@/lib/khl-client";
import type { KhlGameHeaderResponse } from "@/lib/khl-client";

const BASE_URL = "https://www.khl.ru";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36";

type Session = { cookie: string; sessid: string };

class UpstreamError extends Error {
  constructor(message: string, public status?: number, public bodySnippet?: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

function snippet(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

async function getSessionOnce(): Promise<Session> {
  let url = `${BASE_URL}/`;
  const cookieJar: string[] = [];
  let html = "";
  let lastStatus = 0;

  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9",
        ...(cookieJar.length ? { Cookie: cookieJar.join("; ") } : {}),
      },
    });

    lastStatus = response.status;
    cookieJar.push(
      ...(response.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0])
    );

    const location = response.headers.get("location");
    if (!(response.status >= 300 && response.status < 400 && location)) {
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new UpstreamError(
          `Не удалось загрузить главную страницу khl.ru: ${response.status}`,
          response.status,
          snippet(body)
        );
      }
      html = await response.text();
      break;
    }
    url = new URL(location, url).toString();
  }

  const match = html.match(/sessid["'\s:=]+([a-f0-9]{32})/i);
  if (!match) {
    throw new UpstreamError(
      `Не удалось получить sessid с khl.ru (последний статус ${lastStatus}). Похоже, ответ не похож на обычную страницу — возможно сработала анти-бот защита сайта.`,
      lastStatus,
      snippet(html)
    );
  }
  return { cookie: cookieJar.join("; "), sessid: match[1] };
}

// Кэш сессии между вызовами: на тёплом serverless-инстансе Vercel эта
// переменная переживает между запросами, поэтому не тянем главную
// страницу khl.ru на КАЖДЫЙ вызов /api/live-sync (а их каждые 5-20 сек).
let cachedSession: Session | null = null;
let sessionExpiresAt = 0;
const SESSION_TTL_MS = 8 * 60 * 1000; // 8 минут

async function getSession(): Promise<Session> {
  const now = Date.now();
  if (cachedSession && now < sessionExpiresAt) {
    return cachedSession;
  }

  let session: Session;
  try {
    session = await getSessionOnce();
  } catch (error) {
    console.warn("getSession: первая попытка не удалась, повторяю:", error);
    session = await getSessionOnce();
  }

  cachedSession = session;
  sessionExpiresAt = now + SESSION_TTL_MS;
  return session;
}

/** Сбросить кэш сессии — вызывать, если downstream-запрос (calendar/game-header)
 * упал так, будто сессия протухла (например, ответ не похож на JSON). */
function invalidateSession() {
  cachedSession = null;
  sessionExpiresAt = 0;
}

async function fetchGameHeader(gameId: number, session: Session) {
  const response = await fetch(`${BASE_URL}/rest/game/header/`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json, */*",
      "Accept-Language": "ru-RU,ru;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/game/${gameId}/`,
      Cookie: session.cookie,
    },
    body: new URLSearchParams({
      page: "preview",
      "values[tournament]": "1436",
      "values[gameid]": String(gameId),
      sessid: session.sessid,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new UpstreamError(
      `Запрос game/header для игры ${gameId} вернул ошибку: ${response.status}`,
      response.status,
      snippet(body)
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const body = await response.text().catch(() => "");
    throw new UpstreamError(
      `game/header для игры ${gameId} вернул не-JSON ответ (content-type: ${contentType || "неизвестен"}). Возможно, khl.ru вернул страницу блокировки вместо данных.`,
      response.status,
      snippet(body)
    );
  }

  const json = (await response.json()) as KhlGameHeaderResponse;
  if ("data" in json) {
    if (!json.data) throw new UpstreamError(`khl.ru не отдал live-данные для игры ${gameId}`);
    return normalizeGameHeader(json.data);
  }
  return normalizeGameHeader(json);
}

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? process.env.SYNC_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const session = await getSession();
    let result;
    try {
      result = await syncLiveGames((gameId) => fetchGameHeader(gameId, session));
    } catch (error) {
      // Возможно, кэшированная сессия протухла раньше TTL — сбрасываем и пробуем один раз заново.
      invalidateSession();
      console.warn("Live sync: retry after clearing cached session:", error);
      const freshSession = await getSession();
      result = await syncLiveGames((gameId) => fetchGameHeader(gameId, freshSession));
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Live sync failed:", error);
    const isUpstream = error instanceof UpstreamError;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
        ...(isUpstream && error.status ? { upstreamStatus: error.status } : {}),
        ...(isUpstream && error.bodySnippet ? { upstreamBodySnippet: error.bodySnippet } : {}),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}

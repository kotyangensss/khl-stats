import { NextRequest, NextResponse } from "next/server";
import { syncKhlData } from "@/lib/sync";
import type { KhlCalendarResponse } from "@/lib/khl-client";
import { normalizeStandings } from "@/lib/standings";

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

async function getSession(): Promise<Session> {
  try {
    return await getSessionOnce();
  } catch (error) {
    console.warn("getSession: первая попытка не удалась, повторяю:", error);
    return await getSessionOnce();
  }
}

async function fetchCalendar(session: Session): Promise<KhlCalendarResponse> {
  const response = await fetch(`${BASE_URL}/rest/calendar/list/`, {
    method: "POST",
    cache: "no-store",
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

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new UpstreamError(
      `Запрос calendar/list вернул ошибку: ${response.status}`,
      response.status,
      snippet(body)
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const body = await response.text().catch(() => "");
    throw new UpstreamError(
      `calendar/list вернул не-JSON ответ (content-type: ${contentType || "неизвестен"}).`,
      response.status,
      snippet(body)
    );
  }

  const json = (await response.json()) as KhlCalendarResponse;
  if (json.status !== "success") {
    throw new UpstreamError(`khl.ru вернул статус "${json.status}" для calendar/list`);
  }
  return json;
}

async function fetchStandings(session: Session) {
  const response = await fetch(`${BASE_URL}/rest/standings/regular/`, {
    method: "POST",
    redirect: "manual",
    cache: "no-store",
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

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new UpstreamError(
      `Запрос standings вернул ошибку: ${response.status}`,
      response.status,
      snippet(body)
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const body = await response.text().catch(() => "");
    throw new UpstreamError(
      `standings вернул не-JSON ответ (content-type: ${contentType || "неизвестен"}).`,
      response.status,
      snippet(body)
    );
  }

  return normalizeStandings(await response.json());
}

export const dynamic = "force-dynamic";

// GitHub Actions будет дёргать этот роут по расписанию с заголовком
// Authorization: Bearer <SYNC_SECRET>, чтобы никто посторонний не мог
// вызывать синхронизацию вручную и спамить запросами в khl.ru.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.SYNC_SECRET}`;
  if (!process.env.SYNC_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    const [calendar, standings] = await Promise.all([
      fetchCalendar(session),
      fetchStandings(session),
    ]);
    const result = await syncKhlData(calendar, standings);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Sync failed:", err);
    const isUpstream = err instanceof UpstreamError;
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown error",
        ...(isUpstream && err.status ? { upstreamStatus: err.status } : {}),
        ...(isUpstream && err.bodySnippet ? { upstreamBodySnippet: err.bodySnippet } : {}),
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { syncKhlData } from "@/lib/sync";
import type { KhlCalendarResponse } from "@/lib/khl-client";
import { normalizeStandings } from "@/lib/standings";

const BASE_URL = "https://www.khl.ru";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36";

async function getSession() {
  let url = `${BASE_URL}/`;
  const cookieJar: string[] = [];
  let html = "";

  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(cookieJar.length ? { Cookie: cookieJar.join("; ") } : {}),
      },
    });
    cookieJar.push(...(response.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0]));
    const location = response.headers.get("location");
    if (!(response.status >= 300 && response.status < 400 && location)) {
      if (!response.ok) throw new Error(`Не удалось загрузить главную страницу khl.ru: ${response.status}`);
      html = await response.text();
      break;
    }
    url = new URL(location, url).toString();
  }

  const match = html.match(/sessid["'\s:=]+([a-f0-9]{32})/i);
  if (!match) throw new Error("Не удалось получить sessid с khl.ru");
  return { cookie: cookieJar.join("; "), sessid: match[1] };
}

async function fetchCalendar(session: { cookie: string; sessid: string }): Promise<KhlCalendarResponse> {
  const response = await fetch(`${BASE_URL}/rest/calendar/list/`, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      Cookie: session.cookie,
    },
    body: new URLSearchParams({ sessid: session.sessid }).toString(),
  });
  if (!response.ok) throw new Error(`Запрос calendar/list вернул ошибку: ${response.status}`);
  const json = (await response.json()) as KhlCalendarResponse;
  if (json.status !== "success") throw new Error(`khl.ru вернул статус "${json.status}"`);
  return json;
}

async function fetchStandings(session: { cookie: string; sessid: string }) {
  const response = await fetch(`${BASE_URL}/rest/standings/regular/`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      Cookie: session.cookie,
    },
    body: new URLSearchParams({ "values[type]": "regular", sessid: session.sessid }).toString(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Запрос standings вернул ошибку: ${response.status}`);
  return normalizeStandings(await response.json());
}

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
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}

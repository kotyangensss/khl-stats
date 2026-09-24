import { NextRequest, NextResponse } from "next/server";
import { syncLiveGames } from "@/lib/sync";
import { normalizeGameHeader } from "@/lib/khl-client";
import type { KhlGameHeaderResponse } from "@/lib/khl-client";

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

async function fetchGameHeader(gameId: number, session: { cookie: string; sessid: string }) {
  const response = await fetch(`${BASE_URL}/rest/game/header/`, {
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
    body: new URLSearchParams({ page: "preview", "values[tournament]": "1436", "values[gameid]": String(gameId), sessid: session.sessid }).toString(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Запрос game/header вернул ошибку: ${response.status}`);
  const json = (await response.json()) as KhlGameHeaderResponse;
  if ("data" in json) {
    if (!json.data) throw new Error(`khl.ru не отдал live-данные для игры ${gameId}`);
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
    return NextResponse.json({ ok: true, ...(await syncLiveGames((gameId) => fetchGameHeader(gameId, session))) });
  } catch (error) {
    console.error("Live sync failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
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
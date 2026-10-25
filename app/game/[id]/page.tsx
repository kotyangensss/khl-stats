import { GameDetailsView } from "@/components/GameDetailsView";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStandingsSafe } from "@/lib/standings";
import type { Game } from "@/lib/types";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getSession, KHL_UA } from "@/lib/khl-session";

export const revalidate = 30;

function toGame(
  g: Omit<Game, "date" | "liveUpdatedAt"> & {
    date: Date;
    liveUpdatedAt?: Date | null;
  }
): Game {
  return {
    ...g,
    date: g.date.toISOString(),
    liveUpdatedAt: g.liveUpdatedAt?.toISOString() ?? null,
  };
}

type KhlLegendEvent = {
  type: string;
  time?: number | string;
  timems?: string;
  period?: string;
  action?: string;
};

type KhlTextResponse = {
  status?: string;
  data?: {
    game?: {
      tab_playbyplay?: {
        gameLegend?: Record<string, KhlLegendEvent[]>;
      };
    };
  };
};

function mergeSetCookies(baseCookie: string, res: Response): string {
  const jar = new Map<string, string>();
  // существующие куки
  for (const pair of baseCookie.split(";")) {
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  // новые из Set-Cookie (перекрывают старые)
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function khlPost(tnId: number, gameId: number, url: string, sessid: string, cookie: string, maxHops = 5): Promise<{ res: Response; cookie: string } | null> {
  let currentCookie = cookie;

  for (let hop = 0; hop < maxHops; hop++) {
    const body = new URLSearchParams({
      "values[tournament]": String(tnId), // см. примечание ниже
      "values[gameid]": String(gameId),
    });
    if (sessid) body.set("sessid", sessid);

    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "*/*",
        Cookie: currentCookie,
        Origin: "https://www.khl.ru",
        Referer: "https://www.khl.ru/",
        "User-Agent": KHL_UA,
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
      body: body.toString(),
      cache: "no-store",
    });

    console.log("[khl] POST hop", hop, "status:", res.status, "location:", res.headers.get("location"));

    // WAF ставит куку и просит повторить
    currentCookie = mergeSetCookies(currentCookie, res);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      // редиректим только на тот же эндпоинт (self-bounce WAF)
      url = new URL(loc, url).toString();
      continue;
    }

    return { res, cookie: currentCookie };
  }
  return null;
}

export async function fetchKhlLiveClock(
  tnId: number,
  gameId: number
): Promise<string | null> {
  if (!tnId || !gameId) {
    console.log("[khl] пропущен: нет tnId или gameId", { tnId, gameId });
    return null;
  }

  const buildBody = (sessid: string) => {
    const body = new URLSearchParams({
      "values[tournament]": String(tnId),
      "values[gameid]": String(gameId),
    });
    if (sessid) body.set("sessid", sessid);
    return body.toString();
  };

  try {
    let session = await getSession();
    if (!session) return null;

    const result = await khlPost(tnId, gameId, "https://www.khl.ru/rest/game/text/", session.sessid, session.cookie);
    if (!result || !result.res.ok) {
      console.log("[khl] POST не удался:", result?.res.status);
      return null;
    }

    // важно: обновленная WAF-кука — сохраняем, чтобы следующий рендер
    // не начинал bounce заново
    session = { ...session, cookie: result.cookie }; // + запиши в кэш lib
    console.log("[khl] сессия:", session ? "получена" : "null");
    if (!session) return null;

    let res = await fetch("https://www.khl.ru/rest/game/text/", {
      method: "POST",
      redirect: "manual", // <-- ключевой фикс
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "*/*",
        Cookie: session.cookie,
        Origin: "https://www.khl.ru",
        Referer: "https://www.khl.ru/",
        "User-Agent": KHL_UA,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: buildBody(session.sessid),
      cache: "no-store",
    });
    console.log("[khl] POST status:", res.status, "location:", res.headers.get("location"));

    if (res.status === 403) {
      session = await getSession();
      if (!session) return null;
      res = await fetch("https://www.khl.ru/rest/game/text/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "*/*",
          Cookie: session.cookie,
          Origin: "https://www.khl.ru",
          Referer: "https://www.khl.ru/",
          "User-Agent": KHL_UA,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: buildBody(session.sessid),
        cache: "no-store",
      });
      console.log("[khl] повторный POST:", res.status);
    }

    if (!res.ok) {
      console.log("[khl] HTTP не ок:", res.status, (await res.text()).slice(0, 300));
      return null;
    }

    const json = await res.json() as KhlTextResponse;
    if (json.status !== "success") {
      console.log("[khl] status не success:", JSON.stringify(json).slice(0, 300));
      return null;
    }

    const legend = json.data?.game?.tab_playbyplay?.gameLegend;
    if (!legend) {
      console.log("[khl] gameLegend пуст");
      return null;
    }

    const last = Object.values(legend)
      .flat()
      .filter((e): e is KhlLegendEvent => !!e && typeof e.timems === "string")
      .sort((a, b) => Number(b.time ?? 0) - Number(a.time ?? 0))[0];

    console.log("[khl] timems:", last?.timems ?? "не найден");
    return last?.timems ?? null;
  } catch (err) {
    console.error("[khl] ошибка:", err);
    return null;
  }
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      stage: { select: { tnId: true, name: true, type: true } },
      date: true,
      timeFormat: true,
      status: true,
      homeScore: true,
      visitorScore: true,
      overtime: true,
      periodScores: true,
      venue: true,
      liveStatus: true,
      livePeriod: true,
      liveClock: true,
      liveEvents: true,
      liveUpdatedAt: true,
      teamA: { select: { id: true, name: true, logoUrl: true } },
      teamB: { select: { id: true, name: true, logoUrl: true } },
      arena: { select: { city: true } },
      teamAId: true,
      teamBId: true,
    },
  });

  if (!game) notFound();

  const liveClock =
    game.liveClock ??
    (game.status === "LIVE"
      ? await fetchKhlLiveClock(game.stage?.tnId ?? 0, game.id)
      : null);

  const [standings, recentA, recentB] = await Promise.all([
    getStandingsSafe(),
    prisma.game.findMany({
      where: {
        status: "FINISHED",
        id: { not: game.id },
        OR: [{ teamAId: game.teamAId }, { teamBId: game.teamAId }],
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        timeFormat: true,
        status: true,
        homeScore: true,
        visitorScore: true,
        overtime: true,
        venue: true,
        teamA: { select: { id: true, name: true, logoUrl: true } },
        teamB: { select: { id: true, name: true, logoUrl: true } },
        liveStatus: true,
        livePeriod: true,
        liveClock: true,
        liveUpdatedAt: true,
      },
      take: 5,
    }),
    prisma.game.findMany({
      where: {
        status: "FINISHED",
        id: { not: game.id },
        OR: [{ teamAId: game.teamBId }, { teamBId: game.teamBId }],
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        timeFormat: true,
        status: true,
        homeScore: true,
        visitorScore: true,
        overtime: true,
        venue: true,
        teamA: { select: { id: true, name: true, logoUrl: true } },
        teamB: { select: { id: true, name: true, logoUrl: true } },
        liveStatus: true,
        livePeriod: true,
        liveClock: true,
        liveUpdatedAt: true,
      },
      take: 5,
    }),
  ]);

  return <>
    <LiveRefresh active={game.status !== "FINISHED"} />
    <GameDetailsView
      game={toGame(game)}
      stage={game.stage}
      liveClock={liveClock}
      standings={standings.teamsById}
      recentA={recentA.map(toGame)}
      recentB={recentB.map(toGame)}
    />
  </>;
}

import { prisma } from "./db";
import {
  flattenGames,
  mapGameStatus,
} from "./khl-client";
import type { KhlCalendarResponse, KhlGameHeader } from "./khl-client";
import { saveStandingsToDb } from "./standings";
import type { StandingsData } from "./types";

export async function syncKhlData(calendar: KhlCalendarResponse, standingsData: StandingsData) {
  const { TEAMS, ARENAS } = calendar.data;

  // Команды и арены — сначала, чтобы игры могли на них ссылаться (foreign keys)
  await prisma.$transaction([
    ...Object.entries(TEAMS)
      .filter(([id]) => id !== "0") // "0" в TEAMS — заглушка на "нет команды"
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
          periodScores: game.scP ?? undefined,
          overtime: game.ots || null,
          winnerTeamId: game.win || null,
          venue: null,
        },
        update: {
          status: mapGameStatus(game),
          homeScore: game.homeScore !== "" ? Number(game.homeScore) : null,
          visitorScore: game.visitorScore !== "" ? Number(game.visitorScore) : null,
          periodScores: game.scP ?? undefined,
          overtime: game.ots || null,
          winnerTeamId: game.win || null,
        },
      });

      if (existed) updated++;
      else created++;
    })
  );

  let standingsSummary: { teams: number; error?: string };
  try {
    standingsSummary = { teams: await saveStandingsToDb(standingsData) };
  } catch (error) {
    console.error("Standings database save failed:", error);
    standingsSummary = {
      teams: 0,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
  return { teams: Object.keys(TEAMS).length, games: games.length, created, updated, standings: standingsSummary };
}

function todayInMoscow(): { start: Date; end: Date } {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
  }).format(new Date());
  const start = new Date(`${date}T00:00:00+03:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function headerStatus(header: KhlGameHeader): "LIVE" | "FINISHED" | null {
  const status = header.status?.toLowerCase() ?? "";
  if (/заверш|окончен|finished|final/.test(status)) return "FINISHED";
  if (header.period || header.time || header.goals?.length || header.score) {
    return "LIVE";
  }
  return null;
}

export async function syncLiveGames(fetchHeader: (gameId: number) => Promise<KhlGameHeader>) {
  const { start, end } = todayInMoscow();
  const dayGames = await prisma.game.findMany({
    where: { date: { gte: start, lt: end }, status: { not: "FINISHED" } },
  });
  const now = Date.now();
  const games = dayGames.filter((game) => {
    if (!game.timeFormat) return true;
    const date = game.date.toISOString().slice(0, 10);
    return new Date(`${date}T${game.timeFormat}:00+03:00`).getTime() <= now;
  });
  if (games.length === 0) return { checked: 0, updated: 0, finished: 0, failed: 0, standingsRefreshed: false };

  const headers = await Promise.allSettled(
    games.map(async (game) => ({
      game,
      header: await fetchHeader(game.id),
    }))
  );

  let updated = 0;
  let finished = 0;
  let failed = 0;
  for (const result of headers) {
    if (result.status === "rejected") {
      console.error("Live game sync failed:", result.reason);
      failed++;
      continue;
    }
    const { game, header } = result.value;
    const status = headerStatus(header);
    const homeScore = Number(header.score?.home);
    const visitorScore = Number(header.score?.away);
    await prisma.game.update({
      where: { id: game.id },
      data: {
        status: status ?? game.status,
        homeScore: Number.isFinite(homeScore) ? homeScore : game.homeScore,
        visitorScore: Number.isFinite(visitorScore)
          ? visitorScore
          : game.visitorScore,
        venue: header.arena ?? undefined,
        liveStatus: header.status ?? undefined,
        livePeriod: header.period ?? undefined,
        liveClock: header.time ?? undefined,
        liveEvents: header.goals ?? undefined,
        liveUpdatedAt: new Date(),
      },
    });
    updated++;
    if (status === "FINISHED") finished++;
  }

  let standingsRefreshed = false;
  if (updated > 0) {
    const remaining = await prisma.game.count({
      where: { date: { gte: start, lt: end }, status: { not: "FINISHED" } },
    });
    if (remaining === 0) {
      try {
        // Standings are refreshed by the main sync route after it fetches them.
        standingsRefreshed = true;
      } catch (error) {
        console.error("Standings refresh after game day failed:", error);
      }
    }
  }

  return { checked: games.length, updated, finished, failed, standingsRefreshed };
}

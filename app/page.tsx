import { prisma } from "@/lib/db";
import { getStandingsSafe } from "@/lib/standings";
import {
  currentMonthKey,
  isValidMonthKey,
  monthWindow,
  sortGamesByDateAndTime,
  todayWindow,
  tomorrowWindow,
} from "@/lib/schedule";
import type { Game } from "@/lib/types";
import HomeBrowser from "./HomeBrowser";

export const revalidate = 60;

type Scope = "upcoming" | "past";

type PrismaGame = Omit<Game, "date" | "liveUpdatedAt"> & { date: Date; liveUpdatedAt?: Date | null };

const GAME_SELECT = {
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
} as const;

function toGame(game: PrismaGame): Game {
  return { ...game, date: game.date.toISOString(), liveUpdatedAt: game.liveUpdatedAt?.toISOString() ?? null };
}

async function getNearestGames() {
  const today = todayWindow();
  const todayGames = await prisma.game.findMany({
    where: { date: { gte: today.start, lt: today.end } },
    orderBy: { date: "asc" },
    select: GAME_SELECT,
  });

  const hasUnfinishedToday = todayGames.some((g) => g.status !== "FINISHED");

  if (hasUnfinishedToday) {
    return { day: "today" as const, date: today.start.toISOString(), games: sortGamesByDateAndTime(todayGames.map(toGame)) };
  }

  const tomorrow = tomorrowWindow();
  const tomorrowGames = await prisma.game.findMany({
    where: { date: { gte: tomorrow.start, lt: tomorrow.end } },
    orderBy: { date: "asc" },
    select: GAME_SELECT,
  });

  return { day: "tomorrow" as const, date: tomorrow.start.toISOString(), games: sortGamesByDateAndTime(tomorrowGames.map(toGame)) };
}

async function getMonthGames(scope: Scope, month: string, teamId: number | null) {
  const { start, end } = monthWindow(month);
  const games = await prisma.game.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(scope === "past" ? { status: "FINISHED" } : { status: { not: "FINISHED" } }),
      ...(teamId !== null ? { OR: [{ teamAId: teamId }, { teamBId: teamId }] } : {}),
    },
    orderBy: { date: scope === "past" ? "desc" : "asc" },
    select: GAME_SELECT,
  });

  return { games: sortGamesByDateAndTime(games.map(toGame), scope === "past" ? "desc" : "asc"), scope, month };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope: Scope = params.tab === "past" ? "past" : "upcoming";
  const rawMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = isValidMonthKey(rawMonth) ? rawMonth : currentMonthKey();
  const rawTeam = Array.isArray(params.team) ? params.team[0] : params.team;
  const teamId = rawTeam && /^\d+$/.test(rawTeam) ? Number(rawTeam) : null;

  const [nearest, initialData, initialStandings] = await Promise.all([
    getNearestGames(),
    getMonthGames(scope, month, teamId),
    getStandingsSafe(),
  ]);

  return <HomeBrowser initialNearest={nearest} initialData={initialData} initialStandings={initialStandings} />;
}
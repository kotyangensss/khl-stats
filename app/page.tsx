import { prisma } from "@/lib/db";
import { getStandingsSafe } from "@/lib/standings";
import { pastWindow, upcomingWindow, sortGamesByDateAndTime } from "@/lib/schedule";
import type { Game } from "@/lib/types";
import HomeBrowser from "./HomeBrowser";

export const revalidate = 60;

type Scope = "upcoming" | "past";

type PrismaGame = Omit<Game, "date" | "liveUpdatedAt"> & {
  date: Date;
  liveUpdatedAt?: Date | null;
};

function toGame(game: PrismaGame): Game {
  return { ...game, date: game.date.toISOString(), liveUpdatedAt: game.liveUpdatedAt?.toISOString() ?? null };
}

async function getInitialGames(scope: Scope, page: number) {
  const { start, end } = scope === "upcoming" ? upcomingWindow(page) : pastWindow(page);
  const games = await prisma.game.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(scope === "past" ? { status: "FINISHED" } : { status: { not: "FINISHED" } }),
    },
    orderBy: { date: scope === "past" ? "desc" : "asc" },
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
  });
  return {
    games: sortGamesByDateAndTime(
      games.map((game) => toGame(game)),
      scope === "past" ? "desc" : "asc"
    ),
    scope,
    page,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope: Scope = params.tab === "past" ? "past" : "upcoming";
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number(rawPage ?? "1"));
  const [initialData, initialStandings] = await Promise.all([
    getInitialGames(scope, page),
    getStandingsSafe(),
  ]);

  return <HomeBrowser initialData={initialData} initialStandings={initialStandings} />;
}

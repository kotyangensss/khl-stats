import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentMonthKey, isValidMonthKey, monthWindow, sortGamesByDateAndTime } from "@/lib/schedule";
import type { Game } from "@/lib/types";

export const revalidate = 0;

type Scope = "upcoming" | "past";
type PrismaGame = Omit<Game, "date" | "liveUpdatedAt"> & { date: Date; liveUpdatedAt?: Date | null };

function toGame(game: PrismaGame): Game {
  return { ...game, date: game.date.toISOString(), liveUpdatedAt: game.liveUpdatedAt?.toISOString() ?? null };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scope: Scope = searchParams.get("scope") === "past" ? "past" : "upcoming";
  const rawMonth = searchParams.get("month");
  const month = isValidMonthKey(rawMonth) ? rawMonth : currentMonthKey();

  const rawTeam = searchParams.get("team");
  const teamId = rawTeam && /^\d+$/.test(rawTeam) ? Number(rawTeam) : null;

  const { start, end } = monthWindow(month);

  const games = await prisma.game.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(scope === "past" ? { status: "FINISHED" } : { status: { not: "FINISHED" } }),
      ...(teamId !== null
        ? { OR: [{ teamA: { id: teamId } }, { teamB: { id: teamId } }] }
        : {}),
    },
    orderBy: { date: scope === "past" ? "desc" : "asc" },
    select: {
      id: true, date: true, timeFormat: true, status: true, homeScore: true, visitorScore: true,
      overtime: true, venue: true,
      teamA: { select: { id: true, name: true, logoUrl: true } },
      teamB: { select: { id: true, name: true, logoUrl: true } },
      liveStatus: true, livePeriod: true, liveClock: true, liveUpdatedAt: true,
    },
  });

  return NextResponse.json({
    games: sortGamesByDateAndTime(games.map(toGame), scope === "past" ? "desc" : "asc"),
    scope,
    month,
    teamId
  });
}
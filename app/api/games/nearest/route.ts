import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sortGamesByDateAndTime, todayWindow, tomorrowWindow } from "@/lib/schedule";
import type { Game } from "@/lib/types";

export const revalidate = 0;

type PrismaGame = Omit<Game, "date" | "liveUpdatedAt"> & { date: Date; liveUpdatedAt?: Date | null };

const GAME_SELECT = {
  id: true, date: true, timeFormat: true, status: true, homeScore: true, visitorScore: true,
  overtime: true, venue: true,
  teamA: { select: { id: true, name: true, logoUrl: true } },
  teamB: { select: { id: true, name: true, logoUrl: true } },
  liveStatus: true, livePeriod: true, liveClock: true, liveUpdatedAt: true,
} as const;

function toGame(game: PrismaGame): Game {
  return { ...game, date: game.date.toISOString(), liveUpdatedAt: game.liveUpdatedAt?.toISOString() ?? null };
}

export async function GET() {
  const today = todayWindow();
  const todayGames = await prisma.game.findMany({
    where: { date: { gte: today.start, lt: today.end } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: GAME_SELECT,
  });

  const hasUnfinishedToday = todayGames.some((g) => g.status !== "FINISHED");

  if (hasUnfinishedToday) {
    return NextResponse.json({ day: "today", date: today.start.toISOString(), games: sortGamesByDateAndTime(todayGames.map(toGame)) });
  }

  const tomorrow = tomorrowWindow();
  const tomorrowGames = await prisma.game.findMany({
    where: { date: { gte: tomorrow.start, lt: tomorrow.end } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: GAME_SELECT,
  });

  return NextResponse.json({ day: "tomorrow", date: tomorrow.start.toISOString(), games: sortGamesByDateAndTime(tomorrowGames.map(toGame)) });
}
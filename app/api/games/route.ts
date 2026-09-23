import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { upcomingWindow, pastWindow } from "@/lib/schedule";

// /api/games?scope=upcoming&page=1  — сегодняшние (любой статус) + будущие,
//   окном по DAYS_PER_PAGE дней вперёд от начала сегодняшнего дня
// /api/games?scope=past&page=1      — завершённые матчи, окном назад
// /api/games?teamId=42&scope=upcoming — фильтр по команде поверх окна
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const scope = searchParams.get("scope") === "past" ? "past" : "upcoming";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const teamId = searchParams.get("teamId");

  const { start, end } = scope === "upcoming" ? upcomingWindow(page) : pastWindow(page);

  const where: Record<string, unknown> = { date: { gte: start, lt: end } };
  if (scope === "past") where.status = "FINISHED";
  if (teamId) where.OR = [{ teamAId: Number(teamId) }, { teamBId: Number(teamId) }];

  const games = await prisma.game.findMany({
    where,
    orderBy: { date: scope === "past" ? "desc" : "asc" },
    include: { teamA: true, teamB: true },
  });

  return NextResponse.json({
    games,
    scope,
    page,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  });
}

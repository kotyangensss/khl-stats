import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Примеры запросов:
//   /api/games?status=SCHEDULED&page=1&pageSize=20
//   /api/games?status=FINISHED&page=2
//   /api/games?teamId=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status"); // SCHEDULED | LIVE | FINISHED
  const teamId = searchParams.get("teamId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  const where: Prisma.GameWhereInput = {};

  if (status) where.status = status as Prisma.EnumGameStatusFilter["equals"];
  if (teamId) where.OR = [{ teamAId: Number(teamId) }, { teamBId: Number(teamId) }];
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  // Прошедшие матчи логичнее смотреть от новых к старым, будущие — от
  // ближайших к дальним.
  const orderDirection = status === "FINISHED" ? "desc" : "asc";

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy: { date: orderDirection },
      include: { teamA: true, teamB: true, arena: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.game.count({ where }),
  ]);

  return NextResponse.json({
    games,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

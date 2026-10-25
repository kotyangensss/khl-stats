import { TeamDetailsView } from "@/components/TeamDetailsView";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStandingsSafe } from "@/lib/standings";
import type { Game } from "@/lib/types";
import { sortGamesByDateAndTime } from "@/lib/schedule";

export const revalidate = 30;

export async function generateStaticParams() {
  const teams = await prisma.team.findMany({ select: { id: true } });
  return teams.map((team) => ({ id: String(team.id) }));
}

// Prisma возвращает date как объект Date — приводим к строке, как ожидает
// общий тип Game (и как приходит из /api/games на клиенте).
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

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = Number(id);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, logoUrl: true },
  });
  if (!team) notFound();

  const [upcomingRaw, pastRaw, standings] = await Promise.all([
    prisma.game.findMany({
      where: { status: { not: "FINISHED" }, OR: [{ teamAId: teamId }, { teamBId: teamId }] },
      orderBy: { date: "asc" },
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
      take: 15,
    }),
    prisma.game.findMany({
      where: { status: "FINISHED", OR: [{ teamAId: teamId }, { teamBId: teamId }] },
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
      take: 15,
    }),
    getStandingsSafe(),
  ]);

  const upcoming = sortGamesByDateAndTime(upcomingRaw, "asc");
  const past = sortGamesByDateAndTime(pastRaw, "desc");

  const stats = standings.teamsById[teamId];

  return <TeamDetailsView team={team} stats={stats} standings={standings.overall.teams} upcoming={upcoming.map(toGame)} past={past.map(toGame)} />;
}

import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStandingsSafe } from "@/lib/standings";
import { TeamLogo } from "@/components/TeamLogo";
import { GameRow } from "@/components/GameRow";
import { TeamStatsLine } from "@/components/TeamStatsLine";
import type { Game } from "@/lib/types";
import { colors } from "@/lib/theme";
import { sortGamesByDateAndTime } from "@/lib/schedule";

export const revalidate = 30;

export async function generateStaticParams() {
  const teams = await prisma.team.findMany({ select: { id: true } });
  return teams.map((team) => ({ id: String(team.id) }));
}

const sectionHeading: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "0.9rem",
  fontWeight: 600,
  letterSpacing: "0.03em",
  color: colors.muted,
  padding: "0 0 0.6rem",
};

const emptyText: CSSProperties = {
  color: colors.muted,
  fontSize: "0.95rem",
};

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
      where: { status: "SCHEDULED", OR: [{ teamAId: teamId }, { teamBId: teamId }] },
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

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, paddingBottom: "4rem" }}>
      <div style={{ padding: "clamp(1.25rem, 5vw, 3rem)" }}>
        <Link href="/" className="khl-back-link" style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem", textDecoration: "none" }}>
          ← Расписание
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginTop: "2rem", flexWrap: "wrap" }}>
          <TeamLogo team={team} size={80} />
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.75rem, 5vw, 2.75rem)", margin: 0 }}>
              {team.name}
            </h1>
            <TeamStatsLine stats={stats} />
          </div>
        </div>
      </div>

      <section style={{ padding: "0 clamp(1.25rem, 5vw, 3rem)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(1.5rem, 5vw, 3rem)" }}>
          <div>
            <div style={sectionHeading}>Прошедшие матчи</div>
            {past.length === 0 && <p style={emptyText}>Нет прошедших матчей.</p>}
            {past.map((g) => (
              <GameRow key={g.id} game={toGame(g)} showDate standings={standings.teamsById} highlightTeamId={teamId} />
            ))}
          </div>

          <div>
            <div style={sectionHeading}>Предстоящие матчи</div>
            {upcoming.length === 0 && <p style={emptyText}>Нет предстоящих матчей.</p>}
            {upcoming.map((g) => (
              <GameRow key={g.id} game={toGame(g)} showDate standings={standings.teamsById} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

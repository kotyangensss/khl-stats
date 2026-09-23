import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeStandings } from "@/lib/standings";
import { TeamLogo } from "@/components/TeamLogo";
import { GameRow } from "@/components/GameRow";
import type { Game } from "@/lib/types";
import { colors } from "@/lib/theme";

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
function toGame(g: any): Game {
  return { ...g, date: g.date.toISOString() };
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = Number(id);

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) notFound();

  const [upcoming, past, standings] = await Promise.all([
    prisma.game.findMany({
      where: { status: "SCHEDULED", OR: [{ teamAId: teamId }, { teamBId: teamId }] },
      orderBy: { date: "asc" },
      include: { teamA: true, teamB: true },
      take: 15,
    }),
    prisma.game.findMany({
      where: { status: "FINISHED", OR: [{ teamAId: teamId }, { teamBId: teamId }] },
      orderBy: { date: "desc" },
      include: { teamA: true, teamB: true },
      take: 15,
    }),
    computeStandings(),
  ]);

  const stats = standings[teamId];

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, paddingBottom: "4rem" }}>
      <div style={{ padding: "clamp(1.25rem, 5vw, 3rem)" }}>
        <Link href="/" style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem", textDecoration: "none" }}>
          ← Расписание
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginTop: "2rem", flexWrap: "wrap" }}>
          <TeamLogo team={team} size={80} />
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.75rem, 5vw, 2.75rem)", margin: 0 }}>
              {team.name}
            </h1>
            {stats && (
              <p style={{ fontFamily: "var(--font-display)", color: colors.muted, fontSize: "1rem", margin: "0.4rem 0 0" }}>
                {stats.wins}-{stats.losses}-{stats.otLosses} · {stats.points} очков · {stats.rank}-е место
              </p>
            )}
          </div>
        </div>
      </div>

      <section style={{ padding: "0 clamp(1.25rem, 5vw, 3rem)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(1.5rem, 5vw, 3rem)" }}>
          <div>
            <div style={sectionHeading}>Прошедшие матчи</div>
            {past.length === 0 && <p style={emptyText}>Нет прошедших матчей.</p>}
            {past.map((g) => (
              <GameRow key={g.id} game={toGame(g)} showDate standings={standings} />
            ))}
          </div>

          <div>
            <div style={sectionHeading}>Предстоящие матчи</div>
            {upcoming.length === 0 && <p style={emptyText}>Нет предстоящих матчей.</p>}
            {upcoming.map((g) => (
              <GameRow key={g.id} game={toGame(g)} showDate standings={standings} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

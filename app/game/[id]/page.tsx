import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeStandings } from "@/lib/standings";
import { TeamLogo } from "@/components/TeamLogo";
import { GameRow } from "@/components/GameRow";
import type { Game } from "@/lib/types";
import { overtimeLabel, formatDayHeading } from "@/lib/format";
import { colors } from "@/lib/theme";

function toGame(g: any): Game {
  return { ...g, date: g.date.toISOString() };
}

const sectionHeading: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "0.85rem",
  fontWeight: 600,
  letterSpacing: "0.03em",
  color: colors.muted,
  padding: "0 0 0.5rem",
};

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id: Number(id) },
    include: { teamA: true, teamB: true, arena: true },
  });

  if (!game) notFound();

  const [standings, recentA, recentB] = await Promise.all([
    computeStandings(),
    prisma.game.findMany({
      where: {
        status: "FINISHED",
        id: { not: game.id },
        OR: [{ teamAId: game.teamAId }, { teamBId: game.teamAId }],
      },
      orderBy: { date: "desc" },
      include: { teamA: true, teamB: true },
      take: 5,
    }),
    prisma.game.findMany({
      where: {
        status: "FINISHED",
        id: { not: game.id },
        OR: [{ teamAId: game.teamBId }, { teamBId: game.teamBId }],
      },
      orderBy: { date: "desc" },
      include: { teamA: true, teamB: true },
      take: 5,
    }),
  ]);

  const ot = overtimeLabel(game.overtime);
  const decided = game.status === "FINISHED";
  const aWon = decided && (game.homeScore ?? 0) > (game.visitorScore ?? 0);
  const bWon = decided && (game.visitorScore ?? 0) > (game.homeScore ?? 0);
  const periods = Array.isArray(game.periodScores) ? (game.periodScores as string[]) : [];
  const statsA = standings[game.teamAId];
  const statsB = standings[game.teamBId];

  const teamNameStyle = (won: boolean): CSSProperties => ({
    fontFamily: "var(--font-display)",
    fontWeight: won ? 700 : decided ? 500 : 600,
    fontSize: "1.4rem",
    color: won ? colors.win : decided ? colors.loss : colors.text,
  });

  const statsStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    color: colors.muted,
    fontSize: "0.85rem",
  };

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: "clamp(1.25rem, 5vw, 3rem)" }}>
      <Link href="/" style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem", textDecoration: "none" }}>
        ← Расписание
      </Link>

      <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
        <div style={{ color: colors.accent, fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 500 }}>
          {formatDayHeading(game.date.toISOString())}
          {game.timeFormat ? ` · ${game.timeFormat} МСК` : ""}
          {game.arena ? ` · ${game.arena.city}` : ""}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(1.5rem, 6vw, 4rem)",
            flexWrap: "wrap",
            marginTop: "2.5rem",
          }}
        >
          <Link
            href={`/team/${game.teamA.id}`}
            style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}
          >
            <TeamLogo team={game.teamA} size={120} />
            <span style={teamNameStyle(aWon)}>{game.teamA.name}</span>
            {statsA && (
              <span style={statsStyle}>
                {statsA.wins}-{statsA.losses}-{statsA.otLosses} · {statsA.rank}-е место
              </span>
            )}
          </Link>

          <div style={{ textAlign: "center", minWidth: "8rem" }}>
            {decided && (
              <>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(3rem, 8vw, 5rem)", lineHeight: 1 }}>
                  {game.homeScore}:{game.visitorScore}
                </div>
                {ot && (
                  <div style={{ color: colors.accent, fontFamily: "var(--font-display)", fontWeight: 600, marginTop: "0.5rem" }}>
                    {ot === "ОТ" ? "Победа в овертайме" : ot === "Б" ? "Победа по буллитам" : ot}
                  </div>
                )}
              </>
            )}
            {game.status === "LIVE" && (
              <>
                <div style={{ color: colors.live, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                  LIVE
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(3rem, 8vw, 5rem)", lineHeight: 1 }}>
                  {game.homeScore} : {game.visitorScore}
                </div>
              </>
            )}
            {game.status === "SCHEDULED" && (
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(2rem, 5vw, 3rem)", color: colors.accent }}>
                {game.timeFormat ?? "—"}
              </div>
            )}
          </div>

          <Link
            href={`/team/${game.teamB.id}`}
            style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}
          >
            <TeamLogo team={game.teamB} size={120} />
            <span style={teamNameStyle(bWon)}>{game.teamB.name}</span>
            {statsB && (
              <span style={statsStyle}>
                {statsB.wins}-{statsB.losses}-{statsB.otLosses} · {statsB.rank}-е место
              </span>
            )}
          </Link>
        </div>

        {periods.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "clamp(1rem, 4vw, 2.5rem)", marginTop: "3rem" }}>
            {periods.map((p, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ color: colors.muted, fontSize: "0.75rem", fontFamily: "var(--font-body)" }}>{i + 1}-й период</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.15rem", marginTop: "0.25rem" }}>{p}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(1.5rem, 5vw, 3rem)", marginTop: "3.5rem", textAlign: "left" }}>
        <div>
          <div style={sectionHeading}>Последние матчи: {game.teamA.name}</div>
          {recentA.length === 0 && <p style={{ color: colors.muted, fontSize: "0.9rem" }}>Пока нет сыгранных матчей.</p>}
          {recentA.map((g) => (
            <GameRow key={g.id} game={toGame(g)} showDate />
          ))}
        </div>

        <div>
          <div style={sectionHeading}>Последние матчи: {game.teamB.name}</div>
          {recentB.length === 0 && <p style={{ color: colors.muted, fontSize: "0.9rem" }}>Пока нет сыгранных матчей.</p>}
          {recentB.map((g) => (
            <GameRow key={g.id} game={toGame(g)} showDate />
          ))}
        </div>
      </div>
    </main>
  );
}

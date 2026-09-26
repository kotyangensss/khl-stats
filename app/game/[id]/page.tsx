import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStandingsSafe } from "@/lib/standings";
import { TeamLogo } from "@/components/TeamLogo";
import { GameRow } from "@/components/GameRow";
import type { Game } from "@/lib/types";
import { overtimeLabel, formatDayHeading } from "@/lib/format";
import { colors } from "@/lib/theme";
import { LiveRefresh } from "@/components/LiveRefresh";
import { TeamStatsLine } from "@/components/TeamStatsLine";
import { teamColors } from "@/lib/team-colors";

export const revalidate = 30;

export async function generateStaticParams() {
  const games = await prisma.game.findMany({ select: { id: true } });
  return games.map((game) => ({ id: String(game.id) }));
}

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
    select: {
      id: true,
      stage: { select: { tnId: true, name: true, type: true } },
      date: true,
      timeFormat: true,
      status: true,
      homeScore: true,
      visitorScore: true,
      overtime: true,
      periodScores: true,
      venue: true,
      liveStatus: true,
      livePeriod: true,
      liveClock: true,
      liveEvents: true,
      liveUpdatedAt: true,
      teamA: { select: { id: true, name: true, logoUrl: true } },
      teamB: { select: { id: true, name: true, logoUrl: true } },
      arena: { select: { city: true } },
      teamAId: true,
      teamBId: true,
    },
  });

  if (!game) notFound();

  const [standings, recentA, recentB] = await Promise.all([
    getStandingsSafe(),
    prisma.game.findMany({
      where: {
        status: "FINISHED",
        id: { not: game.id },
        OR: [{ teamAId: game.teamAId }, { teamBId: game.teamAId }],
      },
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
      take: 5,
    }),
    prisma.game.findMany({
      where: {
        status: "FINISHED",
        id: { not: game.id },
        OR: [{ teamAId: game.teamBId }, { teamBId: game.teamBId }],
      },
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
      take: 5,
    }),
  ]);

  const ot = overtimeLabel(game.overtime);
  const decided = game.status === "FINISHED";
  const aWon = decided && (game.homeScore ?? 0) > (game.visitorScore ?? 0);
  const bWon = decided && (game.visitorScore ?? 0) > (game.homeScore ?? 0);
  const periods = Array.isArray(game.periodScores) ? (game.periodScores as string[]) : [];
  const events = Array.isArray(game.liveEvents)
    ? (game.liveEvents as Array<{
      period?: number;
      time?: string;
      team?: string;
      scorer?: string;
      assists?: string[];
      score?: string;
    }>)
    : [];
  const statsA = standings.teamsById[game.teamAId];
  const statsB = standings.teamsById[game.teamBId];
  const isPlayoff = game.stage?.type === "playoff";
  const colorA = teamColors[game.teamA.id];
  const colorB = teamColors[game.teamB.id];

  const teamNameStyle = (won: boolean): CSSProperties => ({
    fontFamily: "var(--font-display)",
    fontWeight: won ? 700 : decided ? 500 : 600,
    fontSize: "1.4rem",
    color: decided && !won ? colors.muted : colors.text,
  });

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: "clamp(1.25rem, 5vw, 3rem)" }}>
      <LiveRefresh active={game.status !== "FINISHED"} />
      <Link href="/" className="khl-back-link" style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem", textDecoration: "none" }}>
        ← Расписание
      </Link>

      <div
        style={{
          textAlign: "center",
          marginTop: "2.5rem",
          padding: "2.5rem 1.5rem",
          borderRadius: "28px",
          background: [
            colorA ? `linear-gradient(90deg, ${colorA}55 0%, ${colorA}00 60%)` : "",
            colorB ? `linear-gradient(270deg, ${colorB}55 0%, ${colorB}00 60%)` : "",
          ].filter(Boolean).join(", "),
        }}
      >
        <div style={{ color: colors.accent, fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 500 }}>
          {formatDayHeading(game.date.toISOString())}
          {game.timeFormat ? ` · ${game.timeFormat} МСК` : ""}
          {game.venue ? ` · ${game.venue}` : game.arena ? ` · ${game.arena.city}` : ""}
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
            className="khl-team-hero"
            style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}
          >
            <TeamLogo team={game.teamA} size={120} />
            <span style={teamNameStyle(aWon)}>{game.teamA.name}</span>
            {!decided && <TeamStatsLine stats={statsA} />}
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
                {(game.liveStatus || game.liveClock) && (
                  <div style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                    {game.liveStatus}
                  </div>
                )}
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
            className="khl-team-hero"
            style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}
          >
            <TeamLogo team={game.teamB} size={120} />
            <span style={teamNameStyle(bWon)}>{game.teamB.name}</span>
            {!decided && <TeamStatsLine stats={statsB} />}
          </Link>
        </div>

        {periods.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "clamp(1rem, 4vw, 2.5rem)",
              marginTop: "3rem"
            }}
          >
            {periods.map((p, i) => {
              let label;

              if (i < 3) {
                label = `${i + 1}-й период`;
              } else if (isPlayoff) {
                label = `${i - 2}-й овертайм`;
              } else {
                label = i === 3 ? "Овертайм" : "Буллиты";
              }

              return (
                <div key={i} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      color: colors.muted,
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-body)"
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "1.15rem",
                      marginTop: "0.25rem"
                    }}
                  >
                    {p}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(events.length > 0 || game.status === "FINISHED") && (
        <section style={{ maxWidth: "56rem", margin: "3.5rem auto 0", textAlign: "left" }}>
          {events.length === 0 && (
            <p style={{ color: colors.muted, fontFamily: "var(--font-body)", fontSize: "0.95rem" }}>
              Данные об авторах голов пока не предоставлены источником.
            </p>
          )}
          {(() => {
            const periodLabel = (p?: number) => {
              if (p == null) return "Период не указан";
              if (p <= 3) return `${p}-й период`;
              if (isPlayoff) return `${p - 3}-й овертайм`;
              return p === 4 ? "Овертайм" : "Буллиты";
            };

            let lastPeriod: number | undefined;

            return events.map((event, index) => {
              const teamId = event.team === "home" ? game.teamA.id : event.team === "away" ? game.teamB.id : undefined;
              const teamColor = teamId ? teamColors[teamId] : undefined;
              const teamName = event.team === "home" ? game.teamA.name : event.team === "away" ? game.teamB.name : event.team;
              const isHome = event.team === "home";
              const isAway = event.team === "away";

              const showPeriodHeader = event.period !== lastPeriod;
              lastPeriod = event.period;

              const scorerBlock = (
                <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                  <strong style={{ fontSize: "1.1rem", fontWeight: 700, color: colors.text }}>
                    {event.scorer ?? "Автор не указан"}
                  </strong>
                  {event.assists?.length ? (
                    <span style={{ color: colors.muted, fontSize: "0.85rem" }}>
                      {event.assists.join(", ")}
                    </span>
                  ) : null}
                </span>
              );

              return (
                <div key={`${event.period}-${event.time}-${index}`}>
                  {showPeriodHeader && (
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1rem",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        textAlign: "center",
                        color: colors.accent,
                        padding: index === 0 ? "0 0 1rem" : "2rem 0 1rem",
                      }}
                    >
                      {periodLabel(event.period)}
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 8rem 1fr",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "0.9rem 0.5rem",
                      borderLeft: `3px solid ${isHome ? teamColor ?? "transparent" : "transparent"}`,
                      borderRight: `3px solid ${isAway ? teamColor ?? "transparent" : "transparent"}`,
                      fontFamily: "var(--font-body)",
                      fontSize: "1.05rem",
                    }}
                  >
                    <div style={{ textAlign: "right" }}>{isHome ? scorerBlock : null}</div>
                    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}>
                      <span style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>
                        {event.time ?? "—"}
                      </span>
                      <span style={{ color: colors.accent, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem" }}>
                        {event.score ?? ""}
                      </span>
                    </div>
                    <div style={{ textAlign: "left" }}>{isAway ? scorerBlock : null}</div>
                  </div>
                </div>
              );
            });
          })()}
        </section>
      )}

      {game.status !== "FINISHED" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(1.5rem, 5vw, 3rem)", marginTop: "3.5rem", textAlign: "left" }}>
          <div>
            <div style={sectionHeading}>Последние матчи: {game.teamA.name}</div>
            {recentA.length === 0 && <p style={{ color: colors.muted, fontSize: "0.9rem" }}>Пока нет сыгранных матчей.</p>}
            {recentA.map((g) => (
              <GameRow key={g.id} game={toGame(g)} showDate standings={standings.teamsById} highlightTeamId={game.teamA.id} />
            ))}
          </div>

          <div>
            <div style={sectionHeading}>Последние матчи: {game.teamB.name}</div>
            {recentB.length === 0 && <p style={{ color: colors.muted, fontSize: "0.9rem" }}>Пока нет сыгранных матчей.</p>}
            {recentB.map((g) => (
              <GameRow key={g.id} game={toGame(g)} showDate standings={standings.teamsById} highlightTeamId={game.teamB.id} isReversed={true} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

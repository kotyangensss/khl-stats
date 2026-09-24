import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStandingsSafe } from "@/lib/standings";
import { TeamLogo } from "@/components/TeamLogo";
import { GameRow } from "@/components/GameRow";
import type { Game } from "@/lib/types";
import { overtimeLabel, formatDayHeading, liveStatusLabel } from "@/lib/format";
import { colors } from "@/lib/theme";
import { LiveRefresh } from "@/components/LiveRefresh";
import { TeamStatsLine } from "@/components/TeamStatsLine";

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

  const teamNameStyle = (won: boolean): CSSProperties => ({
    fontFamily: "var(--font-display)",
    fontWeight: won ? 700 : decided ? 500 : 600,
    fontSize: "1.4rem",
    color: won ? colors.win : decided ? colors.loss : colors.text,
  });

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: "clamp(1.25rem, 5vw, 3rem)" }}>
      <LiveRefresh active={game.status !== "FINISHED"} />
      <Link href="/" style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem", textDecoration: "none" }}>
        ← Расписание
      </Link>

      <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
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
            style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}
          >
            <TeamLogo team={game.teamA} size={120} />
            <span style={teamNameStyle(aWon)}>{game.teamA.name}</span>
            <TeamStatsLine stats={statsA} />
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
                    {liveStatusLabel(game.liveStatus, game.livePeriod) ?? ""}{game.liveClock ? ` · ${game.liveClock}` : ""}
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
            style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}
          >
            <TeamLogo team={game.teamB} size={120} />
            <span style={teamNameStyle(bWon)}>{game.teamB.name}</span>
            <TeamStatsLine stats={statsB} />
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

      {(events.length > 0 || game.status === "FINISHED") && (
        <section style={{ maxWidth: "42rem", margin: "3rem auto 0", textAlign: "left" }}>
          <div style={sectionHeading}>Голы и авторы</div>
          {events.length === 0 && (
            <p style={{ color: colors.muted, fontFamily: "var(--font-body)", fontSize: "0.9rem" }}>
              Данные об авторах голов пока не предоставлены источником.
            </p>
          )}
          {events.map((event, index) => (
            <div key={`${event.period}-${event.time}-${index}`} style={{ display: "grid", gridTemplateColumns: "4rem 1fr auto", gap: "0.75rem", alignItems: "baseline", padding: "0.7rem 0", borderBottom: `1px solid ${colors.borderSoft}`, fontFamily: "var(--font-body)", fontSize: "0.9rem" }}>
              <span style={{ color: colors.muted }}>{event.time ?? "—"}</span>
              <span>
                <strong>{event.scorer ?? "Автор не указан"}</strong>
                {event.team ? ` · ${event.team === "home" ? game.teamA.name : event.team === "away" ? game.teamB.name : event.team}` : ""}
                {event.assists?.length ? ` · ассистенты: ${event.assists.join(", ")}` : ""}
              </span>
              <span style={{ color: colors.accent }}>{event.score ?? ""}</span>
            </div>
          ))}
        </section>
      )}

      {game.status !== "FINISHED" && (
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
      )}
    </main>
  );
}

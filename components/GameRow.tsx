"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { TeamLogo } from "./TeamLogo";
import { TeamStatsLine } from "./TeamStatsLine";
import type { Game, StandingsTeam } from "@/lib/types";
import { overtimeLabel, formatShortDate, liveStatusLabel } from "@/lib/format";
import { colors } from "@/lib/theme";

function TeamBlock({
  style,
  children,
}: {
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span style={{ ...style, pointerEvents: "none" }} className="khl-team-link">
      {children}
    </span>
  );
}

export function GameRow({
  game,
  showDate = false,
  standings,
  highlightTeamId,
  compactStats = false,
  showStats = true,
  isReversed = false,
}: {
  game: Game;
  showDate?: boolean;
  standings?: Record<number, StandingsTeam>;
  /** Команда, относительно которой подсвечивается результат строки */
  highlightTeamId?: number;
  compactStats?: boolean;
  showStats?: boolean;
  isReversed?: boolean;
}) {
  const ot = overtimeLabel(game.overtime);
  const decided = game.status === "FINISHED";
  const aWon = decided && (game.homeScore ?? 0) > (game.visitorScore ?? 0);
  const bWon = decided && (game.visitorScore ?? 0) > (game.homeScore ?? 0);
  const hasWinner = aWon || bWon;
  const highlightedTeamWon = highlightTeamId === game.teamA.id ? aWon : bWon;

  const rowAura = highlightTeamId && decided && hasWinner
    ? highlightedTeamWon
      ? `linear-gradient(${isReversed ? "270deg" : "90deg"}, ${colors.win}28, transparent 72%)`
      : `linear-gradient(${isReversed ? "270deg" : "90deg"}, ${colors.loss}28, transparent 72%)`
    : undefined;

  // Цвет текста больше не несёт победу/поражение — только жирность.
  const nameStyle = (won: boolean): CSSProperties => ({
    fontFamily: "var(--font-display)",
    fontWeight: won ? 700 : decided ? 400 : 500,
    color: colors.text,
  });

  const teamLinkStyle = (side: "right" | "left"): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "0.7rem",
    fontSize: "1.1rem",
    minWidth: 0,
    textDecoration: "none",
    justifyContent: side === "right" ? "flex-end" : "flex-start",
    textAlign: side,
    padding: "0.5rem 0",
    borderRadius: "10px",
  });

  return (
    <div style={{ position: "relative" }}>
      {/* Растянутая ссылка на весь матч — под контентом, даёт нативные
          "открыть в новой вкладке / копировать ссылку / перетащить",
          в отличие от прежнего onClick на div. */}
      <Link
        href={`/game/${game.id}`}
        aria-label={`${game.teamA.name} — ${game.teamB.name}`}
        className="khl-row"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          cursor: "pointer",
          borderBottom: `1px solid ${colors.borderSoft}`,
          background: rowAura,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, pointerEvents: "none", padding: "0.9rem 0 0.9rem 0.75rem" }}>
        {showDate && (
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.03em",
              color: colors.mutedDim,
              marginBottom: "0.5rem",
            }}
          >
            {formatShortDate(game.date)}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "1.25rem" }}>
          <TeamBlock style={teamLinkStyle("right")}>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.15rem", minWidth: 0 }}>
              <span style={nameStyle(aWon)}>{game.teamA.name}</span>
              {showStats && <TeamStatsLine stats={standings?.[game.teamA.id]} compact={compactStats} showRank={compactStats && game.status !== "FINISHED"} />}
            </span>
            <TeamLogo team={game.teamA} size={56} />
          </TeamBlock>

          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem", minWidth: "4.75rem" }}>
            {game.status === "SCHEDULED" && (
              <>
                <span style={{ fontFamily: "var(--font-display)", color: colors.accent, fontSize: "1.15rem", fontWeight: 600 }}>
                  {game.timeFormat ?? "—"}
                </span>
                <span style={{ fontFamily: "var(--font-body)", color: colors.mutedDim, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.03em" }}>
                  МСК
                </span>
              </>
            )}
            {game.status === "LIVE" && (
              <>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: colors.live,
                      animation: "live-pulse 1.4s ease-in-out infinite",
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", color: colors.live }}>
                    LIVE
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "1.4rem",
                    color: colors.text,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {game.homeScore} : {game.visitorScore}
                </span>
                {(game.liveStatus || game.liveClock) && (
                  <span style={{ fontFamily: "var(--font-body)", color: colors.muted, fontSize: "0.68rem" }}>
                    {liveStatusLabel(game.liveStatus, game.livePeriod) ?? ""}{game.liveClock ? ` · ${game.liveClock}` : ""}
                  </span>
                )}
              </>
            )}
            {game.status === "FINISHED" && (
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "1.4rem",
                  color: colors.text,
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: "0.35rem",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {game.homeScore}:{game.visitorScore}
                {ot && <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, color: colors.accent }}>{ot}</span>}
              </span>
            )}
          </span>

          <TeamBlock style={teamLinkStyle("left")}>
            <TeamLogo team={game.teamB} size={56} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.15rem", minWidth: 0 }}>
              <span style={nameStyle(bWon)}>{game.teamB.name}</span>
              {showStats && <TeamStatsLine stats={standings?.[game.teamB.id]} compact={compactStats} showRank={compactStats && game.status !== "FINISHED"} />}
            </span>
          </TeamBlock>
        </div>
      </div>
    </div>
  );
}

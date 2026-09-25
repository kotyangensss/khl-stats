"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { TeamLogo } from "./TeamLogo";
import { TeamStatsLine } from "./TeamStatsLine";
import type { Game, StandingsTeam } from "@/lib/types";
import { overtimeLabel, formatShortDate, liveStatusLabel } from "@/lib/format";
import { colors } from "@/lib/theme";

/** Ссылка на команду, если href задан; иначе обычный некликабельный блок
 * (на главной клик по команде должен вести только на страницу матча). */
function TeamBlock({
  href,
  style,
  children,
}: {
  href: string | null;
  style: CSSProperties;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} style={style}>
        {children}
      </Link>
    );
  }
  return <span style={style}>{children}</span>;
}

export function GameRow({
  game,
  showDate = false,
  standings,
  highlightTeamId,
  compactStats = false,
  showStats = true,
  teamLinksEnabled = true,
  isReversed = false,
}: {
  game: Game;
  showDate?: boolean;
  standings?: Record<number, StandingsTeam>;
  /** Команда, относительно которой подсвечивается результат строки */
  highlightTeamId?: number;
  compactStats?: boolean;
  showStats?: boolean;
  /** На главной клик по команде не должен вести на страницу команды — только на матч */
  teamLinksEnabled?: boolean;
  isReversed?: boolean;
}) {
  const router = useRouter();
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
  // На странице команды результат подсвечивается фоном всей строки.
  const nameStyle = (won: boolean): CSSProperties => ({
    fontWeight: won ? 700 : decided ? 400 : 500,
    color: colors.text,
  });

  const teamLinkStyle = (side: "right" | "left"): CSSProperties => {
    return {
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
    };
  };

  return (
    <div
      onClick={(e) => {
        // Если клик пришёлся на ссылку команды (или что-то внутри неё) —
        // не перехватываем его переходом на страницу матча.
        if ((e.target as HTMLElement).closest("a")) return;
        router.push(`/game/${game.id}`);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/game/${game.id}`);
      }}
      style={{ cursor: "pointer", borderBottom: `1px solid ${colors.borderSoft}`, padding: "0.9rem 0", background: rowAura }}
    >
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
        <TeamBlock href={teamLinksEnabled ? `/team/${game.teamA.id}` : null} style={teamLinkStyle("right")}>
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
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", color: colors.live }}>
                LIVE
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: colors.text }}>
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
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: colors.text, display: "inline-flex", alignItems: "baseline", gap: "0.35rem" }}>
              {game.homeScore}:{game.visitorScore}
              {ot && <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, color: colors.accent }}>{ot}</span>}
            </span>
          )}
        </span>

        <TeamBlock href={teamLinksEnabled ? `/team/${game.teamB.id}` : null} style={teamLinkStyle("left")}>
          <TeamLogo team={game.teamB} size={56} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.15rem", minWidth: 0 }}>
            <span style={nameStyle(bWon)}>{game.teamB.name}</span>
            {showStats && <TeamStatsLine stats={standings?.[game.teamB.id]} compact={compactStats} showRank={compactStats && game.status !== "FINISHED"} />}
          </span>
        </TeamBlock>
      </div>
    </div>
  );
}

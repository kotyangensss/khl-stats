"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { TeamLogo } from "./TeamLogo";
import type { Game } from "@/lib/types";
import { overtimeLabel } from "@/lib/format";
import { colors } from "@/lib/theme";

export function GameRow({ game }: { game: Game }) {
  const router = useRouter();
  const ot = overtimeLabel(game.overtime);
  const decided = game.status === "FINISHED";
  const aWon = decided && (game.homeScore ?? 0) > (game.visitorScore ?? 0);
  const bWon = decided && (game.visitorScore ?? 0) > (game.homeScore ?? 0);

  const nameStyle = (won: boolean) => ({
    fontWeight: won ? 700 : decided ? 400 : 500,
    color: won ? colors.text : decided ? colors.muted : colors.text,
  });

  const teamLinkStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.7rem",
    fontSize: "1.1rem",
    minWidth: 0,
    textDecoration: "none",
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
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: "1.25rem",
        padding: "0.9rem 0",
        borderBottom: `1px solid ${colors.borderSoft}`,
        cursor: "pointer",
      }}
    >
      <Link
        href={`/team/${game.teamA.id}`}
        style={{ ...teamLinkStyle, justifyContent: "flex-end", textAlign: "right" }}
      >
        <span style={nameStyle(aWon)}>{game.teamA.name}</span>
        <TeamLogo team={game.teamA} size={56} />
      </Link>

      <span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.15rem",
          minWidth: "4.75rem",
        }}
      >
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
          </>
        )}
        {game.status === "FINISHED" && (
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: colors.text, display: "inline-flex", alignItems: "baseline", gap: "0.35rem" }}>
            {game.homeScore}:{game.visitorScore}
            {ot && <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, color: colors.accent }}>{ot}</span>}
          </span>
        )}
      </span>

      <Link
        href={`/team/${game.teamB.id}`}
        style={{ ...teamLinkStyle, justifyContent: "flex-start", textAlign: "left" }}
      >
        <TeamLogo team={game.teamB} size={56} />
        <span style={nameStyle(bWon)}>{game.teamB.name}</span>
      </Link>
    </div>
  );
}

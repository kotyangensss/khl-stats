import type { StandingsTeam } from "@/lib/types";
import { colors } from "@/lib/theme";

export function TeamStatsLine({ stats, compact = false, showRank = false }: { stats?: StandingsTeam; compact?: boolean; showRank?: boolean }) {
  if (!stats) return null;

  return (
    <span style={{ color: colors.muted, display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", fontSize: "0.72rem", gap: "0.15rem" }}>
      {(!compact || showRank) && <span>{showRank ? `#${stats.rank}` : `#${stats.rank} · ${stats.points} очков`}</span>}
      <span>{compact ? `${stats.wins}-${stats.losses}-${stats.otLosses + stats.shootoutLosses}` : `GP ${stats.gamesPlayed} · W ${stats.wins} · OTW ${stats.otWins} · SOW ${stats.shootoutWins} · SOL ${stats.shootoutLosses} · OTL ${stats.otLosses} · L ${stats.losses}`}</span>
    </span>
  );
}
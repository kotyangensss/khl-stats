import type { StandingsTeam } from "@/lib/types";
import { colors } from "@/lib/theme";

function pluralizePoints(n: number): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  const mod10 = abs % 10;

  if (mod100 >= 11 && mod100 <= 14) return "очков";
  if (mod10 === 1) return "очко";
  if (mod10 >= 2 && mod10 <= 4) return "очка";
  return "очков";
}

export function TeamStatsLine({ stats, compact = false, showRank = false }: { stats?: StandingsTeam; compact?: boolean; showRank?: boolean }) {
  if (!stats) return null;

  return (
    <span style={{ color: colors.muted, display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", fontSize: "0.72rem", gap: "0.15rem" }}>
      {(!compact || showRank) && <span>{showRank ? `#${stats.rank}` : `#${stats.rank} · ${stats.points} ${pluralizePoints(stats.points)}`}</span>}
      <span>{compact 
      ? `${stats.wins + stats.otWins + stats.shootoutWins} · ${stats.losses} · ${stats.otLosses + stats.shootoutLosses}` 
      : `GP ${stats.gamesPlayed} · W ${stats.wins} · OTW ${stats.otWins} · SOW ${stats.shootoutWins} · OTL ${stats.otLosses} · SOL ${stats.shootoutLosses} · L ${stats.losses} · GF ${stats.goalsFor}  · GA ${stats.goalsAgainst}`}</span>
    </span>
  );
}
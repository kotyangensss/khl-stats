"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import type { StandingsData, StandingsGroup } from "@/lib/types";
import { colors } from "@/lib/theme";

const columns = [
  ["GP", "gamesPlayed"],
  ["W", "wins"],
  ["OTW", "otWins"],
  ["SOW", "shootoutWins"],
  ["SOL", "shootoutLosses"],
  ["OTL", "otLosses"],
  ["L", "losses"],
] as const;

type View = "overall" | "conference" | "division";

export function StandingsBrowser({ standings }: { standings: StandingsData }) {
  const [view, setView] = useState<View>("overall");
  const conferenceGroups = useMemo(() => standings.conferenceGroups, [standings.conferenceGroups]);
  const groups: StandingsGroup[] = view === "overall"
    ? [standings.overall]
    : view === "conference"
      ? conferenceGroups
      : standings.groups;

  return (
    <>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2.5rem" }}>
        {(["overall", "conference", "division"] as const).map((key) => (
          <button key={key} onClick={() => setView(key)} style={{
            background: "transparent",
            border: `1px solid ${key === view ? colors.accent : colors.border}`,
            color: key === view ? colors.accent : colors.muted,
            cursor: "pointer",
            fontFamily: "var(--font-display)",
            fontSize: "0.95rem",
            padding: "0.55rem 0.9rem",
          }}>
            {key === "overall" ? "Общая" : key === "conference" ? "Конференции" : "Дивизионы"}
          </button>
        ))}
      </nav>

      <div style={{ display: "grid", gap: "2.5rem" }}>
        {groups.map((group) => (
          <section key={`${group.conference}-${group.division}`}>
            <h2 style={{ color: colors.accent, fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 600, margin: "0 0 0.75rem", textAlign: "center" }}>
              {group.conference}{group.division ? ` · ${group.division}` : ""}
            </h2>
            <div style={{ maxWidth: "1120px", margin: "0 auto", overflowX: "auto", borderTop: `1px solid ${colors.border}` }}>
              <table style={{ borderCollapse: "collapse", minWidth: "820px", width: "100%", fontFamily: "var(--font-body)" }}>
                <thead>
                  <tr style={{ color: colors.muted, fontSize: "0.72rem", textAlign: "center" }}>
                    <th style={styles.rankHeader}>#</th>
                    <th style={styles.teamHeader}>Команда</th>
                    {columns.map(([label]) => <th key={label} style={styles.statHeader}>{label}</th>)}
                    <th style={styles.statHeader}>Шайбы</th>
                    <th style={styles.statHeader}>+/-</th>
                    <th style={styles.pointsHeader}>PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {group.teams.map((team) => (
                    <tr key={team.id} style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
                      <td style={{ ...styles.rankCell, color: team.playoff ? colors.win : colors.muted }}>{team.rank}</td>
                      <td style={styles.teamCell}>
                        <Link href={`/team/${team.id}`} style={{ alignItems: "center", color: colors.text, display: "flex", gap: "0.7rem", justifyContent: "center", textDecoration: "none" }}>
                          <TeamLogo team={{ id: team.id, name: team.name, logoUrl: team.logoUrl }} size={38} />
                          <span>{team.name}</span>
                        </Link>
                      </td>
                      {columns.map(([, key]) => <td key={key} style={styles.statCell}>{team[key]}</td>)}
                      <td style={styles.statCell}>{team.goalsFor}-{team.goalsAgainst}</td>
                      <td style={styles.statCell}>{team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}</td>
                      <td style={{ ...styles.pointsCell, color: colors.accent }}>{team.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

const styles = {
  rankHeader: { padding: "0.7rem 0.5rem", textAlign: "center" as const, width: "3rem" },
  teamHeader: { padding: "0.7rem 0.5rem", textAlign: "center" as const },
  statHeader: { padding: "0.7rem 0.45rem", textAlign: "center" as const, width: "3.5rem" },
  pointsHeader: { padding: "0.7rem 0.75rem", textAlign: "center" as const, width: "4rem" },
  rankCell: { padding: "0.8rem 0.5rem", textAlign: "center" as const, fontFamily: "var(--font-display)", fontWeight: 600 },
  teamCell: { padding: "0.55rem 0.5rem", fontSize: "1rem", minWidth: "15rem", textAlign: "center" as const },
  statCell: { padding: "0.8rem 0.45rem", textAlign: "center" as const, color: colors.muted },
  pointsCell: { padding: "0.8rem 0.75rem", textAlign: "center" as const, fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700 },
};

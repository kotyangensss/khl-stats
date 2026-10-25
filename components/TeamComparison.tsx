import Link from "next/link";
import type { StandingsTeam, Team } from "@/lib/types";
import { standingValue, standingsColumns } from "@/lib/standings-view";
import { TeamLogo } from "./TeamLogo";

export function TeamComparison({ teams, standings }: { teams: Team[]; standings: Record<number, StandingsTeam> }) {
  return <div className="standings-scroll" tabIndex={0} role="region" aria-label="Статистика команд — прокручиваемая таблица">
    <table className="standings-table comparison-table">
      <caption className="sr-only">Показатели команд в чемпионате</caption>
      <colgroup>{standingsColumns.map(column => <col key={column.key} className={`col-${column.key}`} />)}</colgroup>
      <thead><tr>{standingsColumns.map(column => <th key={column.key} scope="col" title={column.title}>{column.label}</th>)}</tr></thead>
      <tbody>{teams.map(team => <tr key={team.id}>
        <td>{standings[team.id]?.rank ?? "—"}</td>
        <th scope="row"><Link href={`/team/${team.id}`}><TeamLogo team={team} size={36} ring={false} /><span>{team.name}</span></Link></th>
        {standingsColumns.slice(2).map(column => {
          const stats = standings[team.id];
          const value = stats ? standingValue(stats, column.key) : null;
          return <td key={column.key}>{value === null ? "—" : column.key === "goalsForAverage" || column.key === "goalsAgainstAverage" ? Number(value).toFixed(2) : column.key === "goalDiff" && Number(value) > 0 ? `+${value}` : value}</td>;
        })}
      </tr>)}</tbody>
    </table>
    <p className="table-hint">В / ВО / ВБ — победы в основное время / овертайме / по буллитам. ПО / ПБ / П — поражения. ШЗ / ШП — шайбы; /И — в среднем за игру.</p>
  </div>;
}

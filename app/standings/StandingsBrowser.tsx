"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import type { StandingsData } from "@/lib/types";
import { cycleStandingsSort, sortStandingsGroups, sortStandingsTeams, standingValue, standingsColumns, type StandingsSort } from "@/lib/standings-view";
type View = "overall" | "conference" | "division";
const views: {
    key: View;
    label: string;
}[] = [{ key: "overall", label: "Чемпионат" }, { key: "conference", label: "Конференции" }, { key: "division", label: "Дивизионы" }];
const columns = [standingsColumns[0], standingsColumns[1], standingsColumns[2], standingsColumns[14], ...standingsColumns.slice(3, 14)];
export function StandingsBrowser({ standings }: {
    standings: StandingsData;
}) {
    const [view, setView] = useState<View>("overall");
    const [sort, setSort] = useState<StandingsSort | null>(null);
    const rankById = useMemo(() => new Map(standings.overall.teams.map(team => [team.id, team.rank])), [standings.overall.teams]);
    const groups = sortStandingsGroups(view === "overall" ? [standings.overall] : view === "conference" ? standings.conferenceGroups : standings.groups);
    return <>
    <div className="league-controls" role="group" aria-label="Группировка таблицы">
      {views.map(item => <button type="button" key={item.key} aria-pressed={view === item.key} onClick={() => { setView(item.key); setSort(null); }}>{item.label}</button>)}
    </div>
    <p className="league-sort-hint">Нажмите на заголовок столбца для сортировки. Третье нажатие — исходный порядок.<span> На телефоне таблицу можно листать вправо.</span></p>
    <div className="league-groups">
      {groups.map((group, groupIndex) => {
            const title = view === "overall" ? "Чемпионат" : view === "division" ? group.division : group.conference;
            const sourceOrder = sortStandingsTeams(group.teams, null, rankById);
            return <section key={`${group.conference}-${group.division}`} className="league-table-card" aria-labelledby={`league-group-${groupIndex}`}>
          <header><div><h2 id={`league-group-${groupIndex}`}>{title}</h2>{view === "division" && <span>{group.conference}</span>}</div><span>{group.teams.length} команд</span></header>
          <div className="league-table-scroll" tabIndex={0} role="region" aria-label={`${title} — прокручиваемая таблица`}>
            <table className="league-table">
              <caption className="flow-visually-hidden">{title}. Показатели команд; заголовки позволяют сортировать.</caption>
              <thead><tr>{columns.map(column => <th key={column.key} scope="col" className={`league-col-${column.key}`} aria-sort={sort?.key === column.key ? sort.dir === "asc" ? "ascending" : "descending" : "none"}>
                <button type="button" title={column.title} aria-label={`Сортировать: ${column.title}`} onClick={() => setSort(previous => cycleStandingsSort(previous, column.key))}>{column.label}<span aria-hidden="true">{sort?.key === column.key ? sort.dir === "asc" ? "↑" : "↓" : ""}</span></button>
              </th>)}</tr></thead>
              <tbody>{sortStandingsTeams(group.teams, sort, rankById).map(team => <tr key={team.id}>
                <td className={`league-col-rank${team.playoff ? " league-playoff" : ""}`}>{view === "overall" ? team.rank : sourceOrder.findIndex(item => item.id === team.id) + 1}</td>
                <th scope="row" className="league-col-name"><Link href={`/team/${team.id}`} aria-label={`Команда ${team.name}`}><TeamLogo team={team} size={30} ring={false}/><span>{team.name}</span></Link></th>
                {columns.slice(2).map(column => {
                        const value = standingValue(team, column.key);
                        return <td key={column.key} className={`league-col-${column.key}`}>{column.key === "goalsForAverage" || column.key === "goalsAgainstAverage" ? Number(value).toFixed(2) : column.key === "goalDiff" && Number(value) > 0 ? `+${value}` : value}</td>;
                    })}
              </tr>)}</tbody>
            </table>
            {group.teams.length === 0 && <p className="study-empty" role="status">Таблица пока недоступна. Попробуйте обновить страницу позже.</p>}
          </div>
        </section>;
        })}
    </div>
    <footer className="league-legend"><p><b>И</b> — игры · <b>Очки</b> — набранные очки · <b>В / ВО / ВБ</b> — победы в основное время / овертайме / по буллитам · <b>ПО / ПБ / П</b> — поражения · <b>ШЗ / ШП</b> — шайбы · <b>ШЗ/И / ШП/И</b> — в среднем за игру · <b>+/−</b> — разница шайб.</p><p><i aria-hidden="true"/>Отметка зоны плей-офф по данным КХЛ.</p></footer>
  </>;
}

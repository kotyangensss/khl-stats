import { avg } from "./calculations";
import type { StandingsGroup, StandingsTeam } from "./types";

export const standingsColumns = [
  { label: "#", title: "Место", key: "rank" },
  { label: "Команда", title: "Название команды", key: "name" },
  { label: "И", title: "Сыгранные матчи", key: "gamesPlayed" },
  { label: "В", title: "Победы в основное время", key: "wins" },
  { label: "ВО", title: "Победы в овертайме", key: "otWins" },
  { label: "ВБ", title: "Победы по буллитам", key: "shootoutWins" },
  { label: "ПО", title: "Поражения в овертайме", key: "otLosses" },
  { label: "ПБ", title: "Поражения по буллитам", key: "shootoutLosses" },
  { label: "П", title: "Поражения в основное время", key: "losses" },
  { label: "ШЗ", title: "Заброшенные шайбы", key: "goalsFor" },
  { label: "ШЗ/И", title: "В среднем заброшено за игру", key: "goalsForAverage" },
  { label: "ШП", title: "Пропущенные шайбы", key: "goalsAgainst" },
  { label: "ШП/И", title: "В среднем пропущено за игру", key: "goalsAgainstAverage" },
  { label: "+/−", title: "Разница шайб", key: "goalDiff" },
  { label: "Очки", title: "Очки", key: "points" },
] as const;

export type StandingsSortKey = typeof standingsColumns[number]["key"];
export type StandingsSort = { key: StandingsSortKey; dir: "asc" | "desc" };

export function standingValue(team: StandingsTeam, key: StandingsSortKey): number | string {
  if (key === "goalsForAverage") return avg(team.goalsFor, team.gamesPlayed);
  if (key === "goalsAgainstAverage") return avg(team.goalsAgainst, team.gamesPlayed);
  return team[key];
}

export function cycleStandingsSort(previous: StandingsSort | null, key: StandingsSortKey): StandingsSort | null {
  const first = key === "name" || key === "rank" ? "asc" : "desc";
  if (previous?.key !== key) return { key, dir: first };
  return previous.dir === first ? { key, dir: first === "asc" ? "desc" : "asc" } : null;
}

export function sortStandingsTeams(teams: StandingsTeam[], sort: StandingsSort | null, rankById: Map<number, number>): StandingsTeam[] {
  const rank = (team: StandingsTeam) => rankById.get(team.id) ?? team.rank;
  return [...teams].sort((a, b) => {
    if (!sort) return rank(a) - rank(b);
    let comparison: number;
    if (sort.key === "rank") comparison = rank(a) - rank(b);
    else if (sort.key === "name") comparison = a.name.localeCompare(b.name, "ru");
    else comparison = Number(standingValue(a, sort.key)) - Number(standingValue(b, sort.key));
    return comparison * (sort.dir === "asc" ? 1 : -1) || rank(a) - rank(b);
  });
}

const conferences = ["Восточная конференция", "Западная конференция"];
const divisions = ["Дивизион Чернышева", "Дивизион Харламова", "Дивизион Боброва", "Дивизион Тарасова"];

export function sortStandingsGroups(groups: StandingsGroup[]): StandingsGroup[] {
  const position = (list: string[], value: string) => { const i = list.indexOf(value); return i < 0 ? list.length : i; };
  return [...groups].sort((a, b) => position(conferences, a.conference) - position(conferences, b.conference)
    || position(divisions, a.division) - position(divisions, b.division));
}

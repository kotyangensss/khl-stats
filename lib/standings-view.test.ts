import assert from "node:assert/strict";
import { test } from "node:test";
import type { StandingsGroup, StandingsTeam } from "./types";
import { cycleStandingsSort, sortStandingsGroups, sortStandingsTeams, standingValue } from "./standings-view";

function team(id: number, rank: number, patch: Partial<StandingsTeam> = {}): StandingsTeam {
  return { id, rank, name: `Команда ${id}`, logoUrl: null, conference: "Восточная конференция", division: "Дивизион Чернышева", gamesPlayed: 10, wins: 3, otWins: 0, shootoutWins: 0, shootoutLosses: 0, otLosses: 0, losses: 7, goalsFor: 20, goalsAgainst: 25, goalDiff: -5, points: 6, playoff: false, ...patch };
}

test("default order follows source championship ranks without mutating input", () => {
  const teams = [team(1, 7), team(2, 2)];
  const sorted = sortStandingsTeams(teams, null, new Map());
  assert.deepEqual([sorted.map(t => t.id), teams.map(t => t.id)], [[2, 1], [1, 2]]);
});

test("equal points keep source championship order inside a group", () => {
  const teams = [team(1, 7), team(2, 2)];
  const sorted = sortStandingsTeams(teams, { key: "points", dir: "desc" }, new Map());
  assert.deepEqual(sorted.map(t => t.id), [2, 1]);
});

test("average goals sort numerically rather than by goals total", () => {
  const teams = [team(1, 1, { goalsFor: 40, gamesPlayed: 20 }), team(2, 2, { goalsFor: 30, gamesPlayed: 10 })];
  const sorted = sortStandingsTeams(teams, { key: "goalsForAverage", dir: "desc" }, new Map());
  assert.deepEqual(sorted.map(t => t.id), [2, 1]);
});

test("teams with no games have a finite zero average", () => {
  const value = standingValue(team(1, 1, { goalsAgainst: 0, gamesPlayed: 0 }), "goalsAgainstAverage");
  assert.equal(value, 0);
});

test("points header cycles descending, ascending, then source order", () => {
  const descending = cycleStandingsSort(null, "points");
  const ascending = cycleStandingsSort(descending, "points");
  assert.deepEqual([descending, ascending, cycleStandingsSort(ascending, "points")], [{ key: "points", dir: "desc" }, { key: "points", dir: "asc" }, null]);
});

test("team name header cycles ascending, descending, then source order", () => {
  const ascending = cycleStandingsSort(null, "name");
  const descending = cycleStandingsSort(ascending, "name");
  assert.deepEqual([ascending, descending, cycleStandingsSort(descending, "name")], [{ key: "name", dir: "asc" }, { key: "name", dir: "desc" }, null]);
});

test("conference and division order does not depend on incoming group order", () => {
  const west: StandingsGroup = { conference: "Западная конференция", division: "Дивизион Боброва", teams: [] };
  const east: StandingsGroup = { conference: "Восточная конференция", division: "Дивизион Чернышева", teams: [] };
  assert.deepEqual(sortStandingsGroups([west, east]).map(g => g.conference), [east.conference, west.conference]);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { recentTeamForm, neighbouringStandings } from "./team-overview";
import { games, standings } from "../tests/ui-preview/fixture";

test("recent form uses away team's real score and opponent, oldest first", () => {
  const finished = { ...games[3], homeScore: 3, visitorScore: 0 };
  const form = recentTeamForm([finished], finished.teamB.id);
  assert.deepEqual(form.map(row => [row.ownScore, row.opponentScore, row.opponent.id, row.result, row.home]), [[0, 3, finished.teamA.id, "loss", false]]);
});

test("recent form excludes unrelated and incomplete results and keeps five latest", () => {
  const finished = { ...games[3], teamA: games[0].teamA };
  const history = Array.from({ length: 7 }, (_, index) => ({ ...finished, id: index, date: `2026-10-${10 + index}T12:00:00Z` }));
  assert.deepEqual(recentTeamForm([...history, { ...finished, id: 99, homeScore: null }, games[0]], finished.teamA.id).map(row => row.game.id), [2, 3, 4, 5, 6]);
});

test("neighbour standings follow source ranks without mutating rows or inventing absent team", () => {
  const rows = [...standings.overall.teams].reverse();
  assert.deepEqual(neighbouringStandings(rows, 2).map(row => row.id), [1, 2, 3, 4]);
  assert.equal(rows[0].id, 4);
  assert.deepEqual(neighbouringStandings(rows, 100), []);
});

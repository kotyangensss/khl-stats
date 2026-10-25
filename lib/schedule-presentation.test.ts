import assert from "node:assert/strict";
import { test } from "node:test";
import type { Game } from "./types";
import { motionProgress, selectFeaturedGame, nearestMatchDay } from "./schedule-presentation";

function game(id: number, status: Game["status"]): Game {
  return { id, status, date: "2026-10-24T11:30:00.000Z", timeFormat: "14:30", homeScore: null, visitorScore: null, overtime: null, teamA: { id: 1, name: "А", logoUrl: null }, teamB: { id: 2, name: "Б", logoUrl: null } };
}

test("an empty day has no featured game", () => {
  assert.equal(selectFeaturedGame([]), undefined);
});

test("a live game is featured ahead of already finished or scheduled games", () => {
  const games = [game(1, "FINISHED"), game(2, "SCHEDULED"), game(3, "LIVE")];
  assert.equal(selectFeaturedGame(games)?.id, 3);
});

test("without a live game the first unfinished match is featured", () => {
  assert.equal(selectFeaturedGame([game(1, "FINISHED"), game(2, "SCHEDULED")])?.id, 2);
});

test("a finished day still links to a real supplied match", () => {
  assert.equal(selectFeaturedGame([game(1, "FINISHED")])?.id, 1);
});

test("scroll progress is clamped before and after the scene", () => {
  assert.deepEqual([motionProgress(50, 100, 400), motionProgress(300, 100, 400), motionProgress(600, 100, 400)], [0, 0.5, 1]);
});

test("an unscrollable scene never produces invalid transforms", () => {
  assert.equal(motionProgress(100, 0, 0), 0);
});
test("nearest matches use their calendar date rather than midnight shifted to the previous UTC date", () => {
  const supplied = [game(1, "SCHEDULED")];
  assert.equal(nearestMatchDay("2026-10-23T21:00:00.000Z", supplied), "2026-10-24");
});
test("an empty nearest day keeps the supplied date as fallback", () => {
  assert.equal(nearestMatchDay("2026-10-24T00:00:00.000Z", []), "2026-10-24");
});

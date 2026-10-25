import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalDemoClient, localDemoEnabled } from "./local-demo";

const date = new Date("2026-10-24T12:00:00+03:00");

test("local demo is opt-in and cannot be enabled in production or on Vercel", () => {
  const env = { KHL_LOCAL_DEMO: "1", NODE_ENV: "development" };
  assert.deepEqual([localDemoEnabled(env), localDemoEnabled({ ...env, NODE_ENV: "production" }), localDemoEnabled({ ...env, VERCEL: "1" }), localDemoEnabled({ NODE_ENV: "development" })], [true, false, false, false]);
});

test("the real query boundary filters different months and finished status", async () => {
  const db = createLocalDemoClient(date);
  const october = await db.game.findMany({ where: { date: { gte: new Date("2026-10-01"), lt: new Date("2026-11-01") }, status: "FINISHED" }, select: { id: true, date: true, status: true } });
  const january = await db.game.findMany({ where: { date: { gte: new Date("2027-01-01"), lt: new Date("2027-02-01") }, status: { not: "FINISHED" } }, select: { id: true, date: true, status: true } });
  const correctOctober = october.length > 0 && october.every(game => game.date.getUTCMonth() === 9 && game.status === "FINISHED");
  const correctJanuary = january.length > 0 && january.every(game => game.date.getUTCMonth() === 0 && game.status !== "FINISHED");
  assert.ok(correctOctober && correctJanuary);
});

test("team filters, recent form order, limit and selected fields work together", async () => {
  const db = createLocalDemoClient(date);
  const games = await db.game.findMany({ where: { status: "FINISHED", OR: [{ teamA: { id: 34 } }, { teamB: { id: 34 } }] }, orderBy: { date: "desc" }, take: 5, select: { id: true, date: true, teamAId: true, teamBId: true } });
  assert.ok(games.length === 5 && games.every((game, index) => (game.teamAId === 34 || game.teamBId === 34) && (!index || game.date <= games[index - 1].date)) && Object.keys(games[0]).length === 4);
});

test("game details include related teams and unknown ids remain missing", async () => {
  const db = createLocalDemoClient(date);
  const live = (await db.game.findMany({ where: { status: "LIVE" }, take: 1 }))[0];
  const detail = await db.game.findUnique({ where: { id: live.id }, select: { teamA: true, teamB: true, arena: true, stage: true, liveClock: true } });
  const missing = await db.game.findUnique({ where: { id: -1 } });
  assert.ok(detail?.teamA.name && detail.teamB.name && detail.arena?.city && detail.stage?.name && detail.liveClock && missing === null);
});

test("demo standings contain both conferences and all four divisions", async () => {
  const rows = await createLocalDemoClient(date).standingsRow.findMany({ orderBy: { rank: "asc" } });
  assert.deepEqual([rows.length, new Set(rows.map(row => row.conference)).size, new Set(rows.map(row => row.division)).size], [22, 2, 4]);
});

test("the demo refuses writes instead of reaching any external database", async () => {
  const db = createLocalDemoClient(date);
  await assert.rejects(db.team.deleteMany(), /read.only/i);
});

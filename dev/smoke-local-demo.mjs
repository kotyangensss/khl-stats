import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error("Use a localhost demo URL");
async function json(path) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  return response.json();
}
async function page(path, status = 200) {
  const response = await fetch(base + path);
  assert.equal(response.status, status, path);
  const html = await response.text();
  if (status === 200) assert.ok(html.includes("Локальный режим"), "Refusing to test a non-demo app");
  return html;
}
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
const [year, month] = today.split("-").map(Number);
const key = offset => {
  const date = new Date(Date.UTC(year, month - 1 + offset, 15));
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCFullYear()).slice(-2)}`;
};
const home = await page("/");
assert.ok(home.includes("Расписание и результаты") && home.includes("Фильтр по команде"));
const all = await json(`/api/games?scope=all&month=${key(0)}`);
assert.ok(["LIVE", "SCHEDULED", "FINISHED"].every(status => all.games.some(game => game.status === status)));
const nearest = await json("/api/games/nearest");
assert.ok(nearest.games.some(game => game.status === "LIVE" && game.teamA.id === 34));
const current = await json(`/api/games?scope=upcoming&month=${key(0)}`);
const future = await json(`/api/games?scope=upcoming&month=${key(3)}`);
assert.ok(current.games.length && future.games.length);
assert.ok(future.games.every(game => !current.games.some(other => other.id === game.id)));
const filtered = await json(`/api/games?scope=upcoming&month=${key(0)}&team=34`);
assert.ok(filtered.games.length && filtered.games.every(game => game.teamA.id === 34 || game.teamB.id === 34));
const past = await json(`/api/games?scope=past&month=${key(-1)}`);
assert.ok(past.games.length && past.games.every(game => game.status === "FINISHED"));
const standings = await json("/api/standings");
assert.equal(standings.overall.teams.length, 22);
assert.equal(standings.conferenceGroups.length, 2);
assert.equal(standings.groups.length, 4);
const live = nearest.games.find(game => game.status === "LIVE");
assert.ok((await page(`/game/${live.id}`)).includes("Авангард"));
assert.ok((await page("/team/34")).includes("Авангард"));
await page("/standings");
await page(`/?tab=past&month=${key(-1)}`);
// Next may already have streamed HTTP 200 before notFound() runs. Verify its 404 result.
for (const path of ["/game/0", "/team/0"]) {
  const missing = await page(path);
  assert.ok(missing.includes("NEXT_HTTP_ERROR_FALLBACK;404") && missing.includes('name="robots" content="noindex"'));
}
console.log(`PASS: Next pages, 3 APIs, distinct ${key(0)}/${key(3)} months, team filter, past results, 22 teams/2 conferences/4 divisions, game/team detail and 404 routes`);

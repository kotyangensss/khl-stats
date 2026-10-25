import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GameDetailsView } from "./GameDetailsView";
import { TeamDetailsView } from "./TeamDetailsView";
import { games, standings } from "../tests/ui-preview/fixture";

test("live match details preserve zero scores, team links and intermission without a stale clock", () => {
  const game = { ...games[1], liveStatus: "Перерыв" };
  const html = renderToStaticMarkup(<GameDetailsView game={game} liveClock="08:24" standings={standings.teamsById} recentA={[]} recentB={[]} />);
  assert.ok(html.includes("0 : 2") && html.includes("Перерыв") && !html.includes("08:24") && html.includes('href="/team/3"') && html.includes('href="/team/4"'));
});

test("scheduled match details retain all fifteen comparison columns and both teams", () => {
  const html = renderToStaticMarkup(<GameDetailsView game={games[0]} standings={standings.teamsById} recentA={[]} recentB={[]} />);
  assert.ok(html.includes("14:30") && html.includes("Авангард") && html.includes("Металлург") && (html.match(/scope="col"/g)?.length === 15));
});

test("finished playoff details keep overtime periods, goal scorers and assists", () => {
  const game = { ...games[3], overtime: "OT", periodScores: ["1:0", "0:1", "1:1", "1:0"], liveEvents: [{ period: 4, time: "02:15", team: "home", scorer: "Иван Иванов", assists: ["Пётр Петров"], score: "3:2" }] };
  const html = renderToStaticMarkup(<GameDetailsView game={game} stage={{ type: "playoff", name: "Плей-офф" }} standings={standings.teamsById} recentA={[]} recentB={[]} />);
  assert.ok(html.includes("3 : 2") && html.includes("1-й овертайм") && html.includes("Иван Иванов") && html.includes("Пётр Петров") && html.includes("02:15"));
});

test("team details preserve full season statistics and links to past and upcoming matches", () => {
  const team = games[0].teamA;
  const html = renderToStaticMarkup(<TeamDetailsView team={team} stats={standings.teamsById[team.id]} upcoming={[games[0]]} past={[{ ...games[3], teamA: team }]} />);
  assert.ok(html.includes("Авангард") && html.includes('href="/game/101"') && html.includes('href="/game/104"') && html.includes("Заброшено за игру") && html.includes("Пропущено за игру") && html.includes("Поражения по буллитам"));
});

test("a team without stats or matches has readable empty states", () => {
  const html = renderToStaticMarkup(<TeamDetailsView team={games[0].teamA} upcoming={[]} past={[]} />);
  assert.ok(html.includes("Статистика пока недоступна") && html.includes("Нет прошедших матчей") && html.includes("Нет предстоящих матчей") && !html.includes("NaN"));
});
test("a goal with a null period keeps the missing-period label", () => {
  const game = { ...games[3], liveEvents: [{ period: null, time: "02:15", team: "home", scorer: "Иван Иванов" }] };
  const html = renderToStaticMarkup(<GameDetailsView game={game} standings={standings.teamsById} recentA={[]} recentB={[]} />);
  assert.ok(html.includes("Период не указан") && !html.includes("null-й период"));
});

test("team overview presents actual opponents, away result and neighbouring standings", () => {
  const team = games[3].teamB;
  const html = renderToStaticMarkup(<TeamDetailsView team={team} stats={standings.teamsById[team.id]} standings={standings.overall.teams} upcoming={[]} past={[{ ...games[3], visitorScore: 0 }]} />);
  assert.ok(html.includes("0–3") && html.includes("В гостях") && html.includes("Поражение") && html.includes("Положение в таблице") && html.includes('href="/team/2"') && html.includes('aria-current="true"'));
});

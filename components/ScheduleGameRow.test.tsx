import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleGameRow } from "./ScheduleGameRow";
import { games, standings } from "../tests/ui-preview/fixture";

test("upcoming schedule rows retain both team standings positions", () => {
  const html = renderToStaticMarkup(<ScheduleGameRow game={games[0]} standings={standings.teamsById} showStats />);
  assert.ok(html.includes("#1") && html.includes("#2"));
});

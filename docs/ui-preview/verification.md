# Redesign verification

## Match and team pages

Both detail routes now use the same visual system as the homepage and standings. Gradient panels and logo rings have been removed; the match score is primary, histories are compact dated links, team season stats and the full 15-column comparison are available in native disclosure sections. Existing server queries and live refresh remain in place.

34 tests pass, including new rendered-view checks for live zero scores/intermission, hidden stale intermission clock, scheduled comparison columns, playoff overtime periods, goal scorers/assists, missing/null event periods, team season metrics, links and empty states. TypeScript passes; ESLint has five existing warnings in the untouched worker (the old unused variable in the replaced match markup disappeared). The real Next HTTP smoke check still passes. Browser checks cover the live match → team route, comparison disclosure with 15 columns/two rows, season disclosure via Enter and 390px iframe layouts for both actual application routes. A separately rendered history fixture verifies that an unknown match time wraps within its centre column at 390px. Both review findings (nullable period and long time label) were corrected and re-reviewed without remaining blockers.

![Match page](match.png)
![Team page](team.png)
![Match at 390px](match-mobile.png)
![Team at 390px](team-mobile.png)

## Working local application

The user subsequently requested a fully navigable localhost without external database access. `npm run dev:demo` now runs the actual Next server at `http://127.0.0.1:3000`. Its server-side read queries are intercepted by an explicitly opt-in, development-only Prisma extension backed by in-memory demo data; the UI and API routes are unchanged. This supersedes the isolated HTML harness as the preferred interactive preview.

28 unit/render/integration checks pass, TypeScript passes, and lint has only the same six existing warnings. `node dev/smoke-local-demo.mjs` passes against the running Next server: distinct October/January schedules, team filter, past results, 22 teams/two conferences/four divisions, game/team/standings routes and not-found results. Browser clicks additionally verified main → game → team → schedule and navigating forward to January. The local timezone check exposed duplicate nearest-day rows; the nearest-game calendar date now avoids UTC-midnight mismatch. Supplied live period text is no longer repeated by its numeric fallback.

The local mode cannot be enabled in production or on Vercel, refuses writes and uses no real credentials. It has a fixed live scenario and illustrative scores; it does not test database I/O or scraping. Full production build with real database access is still unverified.

## Earlier isolated component preview

Screenshots show the actual React components with explicit test fixtures, not production data.

- `npm test`: 19 passing checks. Sort cycles, stable source ranks, averages/zero games, grouping, featured-game selection, clamped motion progress, scheduled/live/finished/unknown scores, shootouts, intermission status and upcoming team ranks.
- `npx tsc --noEmit`: passes.
- `npm run lint`: no errors; six existing warnings in untouched game/worker files.
- `npm run build`: compiles and type-checks, then fails collecting `/team/[id]` data because this checkout has no `DATABASE_URL`. A complete build and database-backed route smoke test are still required in the configured deployment environment.
- Browser at 1024px: featured link, calendar anchors, complete headline exit, intro internal scroll stays zero, team search/select/reset, results, empty day, all 15 table columns, keyboard sorting and source-order reset, two conferences and four divisions.
- Points header and numeric cell centre both measured 955.71875px at the desktop test viewport; table scroll/content widths both 968px.
- Browser iframe at 390px: mobile hero framing and readable featured card; standings scrolling remains inside its container with pinned name/rank/points. Fixed an initial grid minimum-width overflow during this check.
- Reduced-motion fallback and listener/observer cleanup inspected in code; OS preference switching was not exercised in the browser.
- Two independent review axes (standards/spec) found live status and team rank omissions. Both were reproduced with failing tests in a separate RED commit, then fixed; both reviewers confirmed resolution.

Reproduce the isolated UI preview without database access:

```powershell
node tests/ui-preview/build.mjs <absolute-output-directory>
```

Serve that directory using an approved local server. Open `ui-preview.html`, `ui-preview.html?view=standings`, `ui-preview.html?empty=1` and `ui-mobile.html`. The harness replaces Next navigation/image adapters and API responses only inside the test bundle. Production imports no fixtures. It does not validate Next routing, database queries or real API refresh end to end.

![Homepage with updated uniform](home.png)
![Standings points alignment](standings.png)
![Standings at 390px](standings-mobile.png)

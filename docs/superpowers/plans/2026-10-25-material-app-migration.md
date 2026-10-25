# Material application migration

**Goal:** Transfer the approved dark Material/FotMob prototype into the real Next.js application and update kotyangensss/khl-stats PR #7.

**Spec:** The approved prototype in scripts/fluent-demo: neutral dark surfaces, red accents, date strip, full match/team routes, neighbour standings, result/opponent form, optional cat/puck/stick interactions. User explicitly approved implementation; do not stop for another design approval.

**Architecture:** Keep Next.js routes, Prisma/API adapters and real standings. Reuse local CSS and existing React components; no Fluent/MUI dependency installation. Client components own filters, date navigation and companion; server pages retain data queries. Use proper typed Game/StandingsData contracts, null-safe scores and loading/error states.

**Global constraints:** No worker/data-source rewrites, fake production data, main-branch push, force-push or merge. Existing fork PR #2 is not the deliverable. The existing upstream PR #7 is updated via its fork source branch because upstream grants no push permission. Keep local demo mode available only behind its existing flag.

## Review focus

- Calendar transitions across months, Moscow dates and restored URL/team filter.
- Missing match metadata, zero scores, live intermission/unknown periods.
- Standings rank/sort/grouping source order and missing team stats.
- Touch/reduced motion, cursor bounds and companion cleanup across navigation.
- 390px, desktop and 2K layout; readable team names; no drawers/native unstyled selectors.

## Task 1 — Schedule and shared shell (root)

- [x] Add failing tests in lib/material-schedule.test.ts for filtering home/away and LIVE, month ranges/date validation and grouping order. Commit RED checkpoint.
- [x] Implement lib/material-schedule.ts; extend the existing games API with explicit all-status scope while preserving existing upcoming/past callers.
- [x] Replace HomeBrowser visual shell with sticky date strip, styled team combobox, all/LIVE filter, loading/retry/empty states and real API polling. Dates load across months.
- [x] Update SiteHeader, layout and ScheduleGameRow to the approved surfaces; use Next links to existing routes and retain real score/status metadata.
- [x] Consolidate prototype CSS into app/material.css. Exclude ignored scripts from production type/lint checks. Run tests/typecheck/lint.

## Task 2 — Team and match pages (details agent)

- [x] Read existing DetailPages tests and server queries. Add RED coverage for actual opponent scores and neighbouring standings without dropping existing metadata tests.
- [x] Port team layout: compact identity, next match, last five opponents/results, neighbouring standings, full match list and collapsible season stats. Server supplies real full standings.
- [x] Port match surfaces while retaining live status/clock, venue, period scores, goals/assists, comparisons and recent games. Preserve empty/null handling. No invented arena or score.
- [x] Own files: components/TeamDetailsView.tsx, GameDetailsView.tsx, MatchHistory.tsx, app/team/[id]/page.tsx, app/material-details.css, relevant new lib/team-overview.ts/tests and DetailPages tests. Do not change shared SiteHeader/ScheduleGameRow/layout.

## Task 3 — Standings (standings agent)

- [x] Port approved table visual layout in app/standings/StandingsBrowser.tsx retaining existing lib/standings-view sorting/grouping. Use actual server props and Next links.
- [x] Preserve mobile sticky team/rank columns, horizontal scroll, legend/playoff markers and accessible sort state. Existing tests must remain valid; add meaningful RED coverage if logic changes.
- [x] Own only standings client and its component tests/dedicated styles if needed. Shared CSS comes from root's app/material.css.

## Task 4 — Companion (companion agent)

- [x] Port actual oneko actor and hockey logic into components/companion and lib/companion with typed production-safe exports and tests first. Preserve current goal/puck/cursor behavior.
- [x] Export CompanionProvider and CompanionControls: root wraps layout children in provider; SiteHeader renders controls. No Fluent dependency. Provider stays mounted through Next navigation; native accessible settings popover/menu, close with Escape/outside.
- [x] Use public/images/oneko.gif and preserve MIT license. Own app/companion.css, companion components/helpers/tests and assets only.
- [x] Confirm cleanup, reduced motion/touch, cursor restoration when disabled, safe localStorage and no synthetic score updates.

## Integration and delivery (root)

- [x] Review independent changes, run full tests/typecheck/lint and production build (demo is deliberately disabled in production); smoke API and browser routes at mobile/desktop/2K.
- [x] Copy only production migration files to the managed material-app worktree based on current upstream PR head 651b349; keep separate prototype/model experiments out of PR.
- [x] Fresh whole-branch review; resolve blockers with regression tests. Commit and fast-forward update the PR's existing source branch, no force-push.
- [x] Rewrite upstream PR #7 description/title around the final Material implementation, add verified screenshots and attach PR to this chat. Do not merge.

## Verification record

- 57 tests pass, TypeScript passes, ESLint has no errors (five pre-existing worker warnings).
- Database-free dev smoke passes for all routes/APIs, team filters, distinct months and 404s.
- Browser checked at 390x844 and 2560x1440: schedule filtering and month transition, team/match pages, standings groups, cat hide/show/goal and one actor across navigation.
- Production compilation and TypeScript pass. Full `next build` cannot finish page-data collection because DATABASE_URL is absent in this environment. No production fixture override was added.
- Implementation and review completed by the root agent after delegated agents became unavailable. No independent review result is claimed.

Delivery: upstream PR #7 updated to production commit 29dc9fc. GitHub confirms it remains OPEN. The Vercel status is failing with an authorization link; no deployment or merge is claimed.

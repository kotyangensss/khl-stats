# Hockey UI Redesign Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task in this chat. Steps use checkbox syntax for tracking.

**Goal:** Port the approved homepage and standings UI to the existing app and open a reviewed PR in the user's fork.

**Architecture:** Existing server pages and APIs supply all data. Client presentation modules own the hero/rail and table, with pure sorting and scroll helpers as tested interfaces. Shared navigation and scoped CSS keep the design consistent.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, existing tsx, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-24-hockey-ui-design.md`

## Global Constraints

- No new dependencies, schema/API changes, worker changes or committed credentials.
- Preserve current filters, dates, live refresh, results, links and all standings columns.
- Keep the source friend photo outside the repository; commit only the approved generated hero asset.
- Native page scroll, reduced-motion fallback and readable keyboard focus are required.

## Review Focus

- Empty nearest day: no broken featured link or empty pinned scene.
- Live and zero scores: the hero/rail must not render a scheduled time instead.
- Group sorting: displayed group ranks remain original ranks when sorting by another metric.
- Long names/small viewports: table scrolls locally; team and points axes stay visible.
- Resize, font loading and reduced motion: scene measurements update without stale transforms or nested scrolling.

### Task 1: Tested presentation interfaces

**Files:** `lib/standings-view.ts`, `lib/standings-view.test.ts`, `lib/schedule-presentation.ts`, `lib/schedule-presentation.test.ts`, `package.json`.

**Interfaces:** standings sort state/columns, immutable team/group sorting; featured-game selection and bounded scroll progress.

- [ ] Write failing tests for deterministic ranks, numeric averages (including zero games), sorting cycle, featured live selection and full headline exit.
- [ ] Run `npm test`, record RED and commit failing tests separately.
- [ ] Implement minimal helpers and run the tests green.

### Task 2: Approved schedule presentation

**Files:** `components/SiteHeader.tsx`, `components/ScheduleHero.tsx`, `components/GameStatus.tsx`, `components/ScheduleGameRow.tsx`, `app/HomeBrowser.tsx`, `app/layout.tsx`, `app/globals.css`, `lib/theme.ts`, `public/images/hockey-hero.webp`.

- [ ] Keep all existing request/filter state; replace presentation and add a labelled full-schedule anchor.
- [ ] Port the hero and nearest rail with measured scroll ranges, focus navigation and reduced motion.
- [ ] Use real props for dates, scores, links and empty states.
- [ ] Check rendered game-status variants and browser behaviour, then commit.

### Task 3: Standings presentation

**Files:** `app/standings/page.tsx`, `app/standings/StandingsBrowser.tsx`, shared CSS/navigation.

- [ ] Use the tested helpers and original data groups.
- [ ] Port the approved table, sticky axes, 15 accessible sort buttons, aligned points and responsive gutters.
- [ ] Preserve horizontal scroll and keyboard focus during sorting.
- [ ] Verify all three views, asc/desc/reset and missing/empty data, then commit.

### Task 4: Verification and PR

- [ ] Run tests, lint, typecheck, production build and relevant browser checks.
- [ ] Review the complete diff for Standards and Spec using Matt Pocock's review workflow; resolve actionable findings.
- [ ] Push only `feat/hockey-ui-redesign`, create a PR against `fantom2513/khl-stats:main`, attach it to this chat, and report verification and limitations.

## Execution notes

- The user approved implementation and PR creation after reviewing the prototypes; no further design gate is needed for this agreed scope.
- `graphify` is not installed. Respect the no-new-dependencies rule and use direct source inspection rather than installing it.
- No local `.env` exists. Build generation may use a local placeholder URL only for Prisma schema generation; do not access or mutate a live database for UI verification.

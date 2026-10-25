# Hockey UI redesign

Approved through the interactive homepage and standings prototypes in this chat.

## Scope

- Keep the site a KHL schedule: current data fetching, live refresh, month navigation, results, saved team filter, game links and team links remain.
- Homepage: black/white typography with a restrained red accent; the user-approved generated friend portrait; readable featured match; scroll-driven headline exit and horizontal nearest-match scene followed by the normal schedule.
- No “Omsk / KHL” header caption, official club photo attribution, prototype controls, artificial puck, purple palette or decorative colour gradients.
- Standings: championship/conference/division views, all 15 columns, keyboard-operable sorting, narrow responsive gutters, pinned team/rank and points columns. Centre “Очки” and values on the same axis independently of the sort arrow.
- No frozen prototype data, new dependencies, database changes, API changes or changes to the worker.

## Approaches

We compared a typographic poster, a pale ice layout and a dimensional arena. The user selected the poster typography, a photographic player hero, then a portrait generated from their friend's supplied photo. They approved the dark scroll-driven prototype and standings spacing refinement. Port that composition into the existing React application rather than shipping the standalone HTML mockups.

## Implementation decisions

- Keep the existing Next.js / React / Prisma stack. Use CSS and requestAnimationFrame; no animation dependency.
- Shared navigation and match presentation; keep data access on the existing server pages.
- Scope presentation CSS to the new homepage/standings components; maintain readable existing game/team pages with shared dark tokens.
- Dynamic dates, scores and selected teams always come from application props/API responses.
- Prefer live games for the featured link, otherwise the first upcoming game, falling back to a finished game only if supplied. Empty nearest days still link directly to the full schedule.
- Reduced motion shows a normal vertical nearest-game list. Keyboard users can skip directly to the schedule and reveal offscreen rail links on focus.
- Portrait is a local optimised asset; no user-uploaded source photo is committed.

## Follow-up: match and team pages

The user explicitly expanded the redesign to `/game/[id]` and `/team/[id]` after seeing the old match page. Use the same dark editorial typography and shared navigation, remove the gradient panels and logo rings, give the match score clear priority and show history as compact dated rows. Preserve live refresh, team/game/calendar links, all 15 comparison columns, period scores and overtime/shootout labels, goal scorers and assists, complete team season statistics and readable empty states. Keep server queries and external synchronization unchanged. Verify the actual Next routes and a 390px viewport, then update the existing upstream PR in concise Russian.

## Verification

Use Node's test runner with the existing tsx dependency for behaviour at the standings sorting and schedule-presentation interfaces. Verify live/finished/empty game rendering, group ranks and averages, preserved sort scroll position, complete headline exit, responsive spacing, keyboard navigation and reduced motion. Run lint, TypeScript and a production build; disclose any environment limitations accurately.
# Follow-up: hero uniform

The user requested a stronger Avangard forward reference during final verification: red shoulder panels, sleeve/hem bands and a hawk crest, with the approved face, pose and dark arena preserved.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Local UI testing without a database

```bash
npm run dev:demo
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). This runs the actual Next.js application, including server pages and API routes, with a read-only in-memory dataset: 22 teams, four divisions, past results, a live match and upcoming games from 120 days before to 180 days after startup. Month navigation, saved team filters, standings sorting, game details and team pages use the same application logic as the deployed site. Dates, scores and match IDs in this mode are illustrative. The live clock/score is a fixed scenario, not a live KHL feed.

The launcher binds to loopback only and enables `KHL_LOCAL_DEMO=1` for that process. Sample data is disabled in production and on Vercel; no real database credentials are used. Restarting regenerates the fixture dates. Ordinary `npm run dev` retains the existing database connection behavior.

For a fresh dependency install in PowerShell, Prisma's generator needs a syntactically valid CLI URL even though demo mode does not connect to it:

```powershell
$env:DIRECT_URL = 'postgresql://demo:demo@127.0.0.1:1/local_demo'
npm ci
npm run dev:demo
```

Checks:

```bash
npm test
node dev/smoke-local-demo.mjs
```

The HTTP smoke check requires the demo server to be running. It covers pages, API filters/month windows, standings groups, linked game/team details and missing IDs. It does not validate real PostgreSQL queries or the external KHL synchronizer.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Background sync

Standings are read from PostgreSQL. The GitHub Actions workflow refreshes games
and standings every 15 minutes through `POST /api/sync`.

Add these repository secrets:

- `SYNC_URL` — the deployed URL ending with `/api/sync`
- `SYNC_SECRET` — the same value as the app's `SYNC_SECRET` environment variable

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import snapshot from "./local-demo-teams.json";

/** Explicitly development-only: deployment settings can never enable sample data. */
export function localDemoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.KHL_LOCAL_DEMO === "1" && env.NODE_ENV === "development" && !env.VERCEL;
}

type Row = Record<string, unknown>;
type Query = { where?: Row; select?: Row; orderBy?: Row | Row[]; take?: number; skip?: number };
type DemoGame = Prisma.GameGetPayload<{ include: { teamA: true; teamB: true; arena: true; stage: true } }>;

function createData(now: Date) {
  const divisions = new Map(snapshot.divisions.flatMap(group => group.ids.map(id => [id, group.name.split(" · ")] as const)));
  const standings = snapshot.teams.map(team => {
    const values = team.values.map(Number);
    const [conference, division] = divisions.get(team.id) ?? ["", ""];
    return {
      teamId: team.id, name: team.name, logoUrl: team.logo, conference, division,
      rank: values[0], gamesPlayed: values[2], wins: values[3], otWins: values[4], shootoutWins: values[5],
      otLosses: values[6], shootoutLosses: values[7], losses: values[8], goalsFor: values[9],
      goalsAgainst: values[11], goalDiff: values[13], points: values[14], playoff: values[0] <= 16, updatedAt: now,
    };
  });
  const teams = standings.map(team => ({ id: team.teamId, name: team.name, logoUrl: team.logoUrl }));
  // Put the favourite team in the featured demo match without changing the real app's selection rules.
  const avangardIndex = teams.findIndex(team => team.id === 34);
  if (avangardIndex > 0) [teams[0], teams[avangardIndex]] = [teams[avangardIndex], teams[0]];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(now);
  const base = new Date(`${today}T12:00:00+03:00`);
  const year = base.getUTCFullYear();
  const seasonYear = base.getUTCMonth() >= 7 ? year : year - 1;
  const stage = { id: 1, tnId: 0, season: `${String(seasonYear).slice(-2)}/${String(seasonYear + 1).slice(-2)}`, type: "regular", name: "Демонстрационный регулярный чемпионат", createdAt: now, updatedAt: now };
  const arena = { id: 1, city: "Омск" };
  const games: DemoGame[] = [];
  for (let offset = -120; offset <= 180; offset += 2) {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() + offset);
    for (let match = 0; match < 4; match++) {
      const round = Math.floor((offset + 120) / 2);
      const first = offset === 0 ? match * 2 : (round + match * 2) % teams.length;
      const teamA = teams[first];
      const teamB = teams[(first + 1) % teams.length];
      const status = offset < 0 || (offset === 0 && match === 3) ? "FINISHED" : offset === 0 && match === 0 ? "LIVE" : "SCHEDULED";
      const finished = status === "FINISHED";
      const homeScore = finished ? 2 + round % 3 : status === "LIVE" ? 0 : null;
      const visitorScore = finished ? round % 2 : status === "LIVE" ? 0 : null;
      games.push({
        id: 9_700_000 + round * 4 + match, date, status, timeFormat: ["14:30", "17:00", "19:00", "19:30"][match],
        tnId: stage.tnId, stage, teamAId: teamA.id, teamBId: teamB.id, teamA, teamB, arenaId: arena.id, arena,
        homeScore, visitorScore, periodScores: finished ? [`1:${visitorScore}`, "1:0", `${homeScore! - 2}:0`] : [],
        overtime: finished && round % 7 === 0 ? "SO" : null, winnerTeamId: finished ? teamA.id : null,
        venue: offset === 0 && match === 0 ? "G-Drive Арена" : "Демонстрационная арена",
        liveStatus: status === "LIVE" ? "1 период" : finished ? "Матч завершён" : null,
        livePeriod: status === "LIVE" ? 1 : null, liveClock: status === "LIVE" ? "08:24" : null,
        liveEvents: finished ? [{ period: 1, time: "05:12", team: teamA.name, scorer: "Тестовый игрок", assists: [], score: "1:0" }] : [],
        liveUpdatedAt: status === "LIVE" ? now : null, createdAt: now, updatedAt: now,
      });
    }
  }
  return { Team: teams, Game: games, StandingsRow: standings, Arena: [arena], Stage: [stage] };
}

function scalar(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

/** Only the read operations used by this app are supported; unsupported queries fail loudly. */
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return (condition as Row[]).some(item => matches(row, item));
    if (key === "AND") return (Array.isArray(condition) ? condition : [condition]).every(item => matches(row, item as Row));
    if (key === "NOT") return !(Array.isArray(condition) ? condition : [condition]).some(item => matches(row, item as Row));
    const value = row[key];
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if (value && typeof value === "object" && !(value instanceof Date)) return matches(value as Row, condition as Row);
      return Object.entries(condition).every(([operator, expected]) => {
        const a = scalar(value) as number | string;
        const b = scalar(expected) as number | string;
        switch (operator) {
          case "equals": return a === b;
          case "not": return a !== b;
          case "gte": return a >= b;
          case "gt": return a > b;
          case "lt": return a < b;
          case "lte": return a <= b;
          case "in": return (expected as unknown[]).includes(value);
          default: throw new Error(`Unsupported local demo filter: ${operator}`);
        }
      });
    }
    return scalar(value) === scalar(condition);
  });
}

function project(row: Row, select?: Row): Row {
  if (!select) return structuredClone(row);
  return Object.fromEntries(Object.entries(select).filter(([, enabled]) => enabled).map(([key, config]) => {
    const value = row[key];
    return [key, typeof config === "object" && config && value ? project(value as Row, (config as Query).select) : structuredClone(value)];
  }));
}

export function createLocalDemoClient(now = new Date()) {
  const data = createData(now);
  // No real credentials enter this client. Every model query is intercepted before adapter I/O.
  const client = new PrismaClient({ adapter: new PrismaNeon({ connectionString: "postgresql://demo:demo@127.0.0.1:1/local_demo" }) });
  return client.$extends({ query: { $allModels: { async $allOperations({ model, operation, args }) {
    if (!["findMany", "findUnique", "findFirst", "count"].includes(operation)) throw new Error("Local demo is read-only");
    const rows = data[model as keyof typeof data];
    if (!rows) throw new Error(`Unsupported local demo model: ${model}`);
    const { where, orderBy, select, take, skip = 0 } = args as Query;
    let filtered = (rows as unknown as Row[]).filter(row => matches(row, where));
    if (orderBy) {
      const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
      filtered = [...filtered].sort((a, b) => {
        for (const order of orders) for (const [key, direction] of Object.entries(order)) {
          const x = scalar(a[key]) as number | string;
          const y = scalar(b[key]) as number | string;
          if (x !== y) return (x < y ? -1 : 1) * (direction === "desc" ? -1 : 1);
        }
        return 0;
      });
    }
    if (operation === "count") return filtered.length;
    if (operation === "findUnique" || operation === "findFirst") return filtered[0] ? project(filtered[0], select) : null;
    filtered = filtered.slice(skip, take === undefined ? undefined : skip + take);
    return filtered.map(row => project(row, select));
  } } } });
}

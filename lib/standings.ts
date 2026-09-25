import { prisma } from "./db";
import type { StandingsData, StandingsGroup, StandingsTeam } from "./types";

export function emptyStandings(): StandingsData {
  return {
    overall: { conference: "Общая таблица", division: "", teams: [] },
    conferenceGroups: [],
    groups: [],
    teamsById: {},
  };
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function goalsValue(value: unknown): [number, number] {
  if (typeof value === "string") {
    const [scored, conceded] = value.split("-").map(numberValue);
    return [scored, conceded];
  }
  return [0, 0];
}

function normalizeTeam(
  raw: Record<string, unknown>,
  group: Pick<StandingsGroup, "conference" | "division">
): StandingsTeam {
  const stats = (raw.stats ?? raw.s ?? {}) as Record<string, unknown>;
  const [goalsFor, goalsAgainst] = goalsValue(stats.goals ?? stats.g);
  const id = numberValue(raw.id ?? raw.clubid);
  const position = numberValue(raw.position ?? raw.r);

  return {
    id,
    name: String(raw.name ?? ""),
    logoUrl: typeof (raw.logo ?? raw.img) === "string" ? String(raw.logo ?? raw.img) : null,
    conference: group.conference,
    division: group.division,
    rank: position,
    gamesPlayed: numberValue(stats.gp),
    wins: numberValue(stats.w),
    otWins: numberValue(stats.otw),
    shootoutWins: numberValue(stats.sow),
    shootoutLosses: numberValue(stats.sol),
    otLosses: numberValue(stats.otl),
    losses: numberValue(stats.l),
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    points: numberValue(stats.pts),
    playoff: raw.is_out_playoff !== undefined
      ? !Boolean(raw.is_out_playoff)
      : Boolean(raw.playoff),
  };
}

function groupsFromPayload(payload: unknown): StandingsGroup[] {
  const groups: StandingsGroup[] = [];

  function visit(value: unknown, inherited?: Partial<StandingsGroup>) {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, inherited));
      return;
    }
    if (!value || typeof value !== "object") return;

    const object = value as Record<string, unknown>;
    const group = {
      conference: String(object.conference ?? inherited?.conference ?? ""),
      division: String(object.division ?? inherited?.division ?? ""),
    };
    if (Array.isArray(object.teams)) {
      const teams = object.teams
        .filter((team): team is Record<string, unknown> => Boolean(team && typeof team === "object"))
        .map((team) => normalizeTeam(team, group));
      if (teams.length > 0) groups.push({ ...group, teams });
    }

    Object.entries(object).forEach(([key, child]) => {
      if (key !== "teams") visit(child, group);
    });
  }

  visit(payload);
  return groups;
}

export function normalizeStandings(payload: unknown): StandingsData {
  const response = payload as {
    data?: { json?: { divisions?: unknown[] } };
  };
  const divisions = response.data?.json?.divisions;
  if (Array.isArray(divisions)) {
    const conferenceByDivision: Record<string, string> = {
      bobrov: "Западная конференция",
      tarasov: "Западная конференция",
      kharlamov: "Восточная конференция",
      chernyshev: "Восточная конференция",
    };
    const divisionNames: Record<string, string> = {
      bobrov: "Дивизион Боброва",
      tarasov: "Дивизион Тарасова",
      kharlamov: "Дивизион Харламова",
      chernyshev: "Дивизион Чернышева",
    };
    const groups = divisions.flatMap((division) => {
      if (!division || typeof division !== "object") return [];
      const value = division as { item?: string; rows?: unknown[] };
      const item = value.item ?? "";
      const group = {
        conference: conferenceByDivision[item] ?? "",
        division: divisionNames[item] ?? item,
      };
      const teams = (value.rows ?? [])
        .filter((team): team is Record<string, unknown> => Boolean(team && typeof team === "object"))
        .map((team) => normalizeTeam(team, group));
      return teams.length > 0 ? [{ ...group, teams }] : [];
    });
    const byId = Object.fromEntries(groups.flatMap((group) => group.teams.map((team) => [team.id, team])));
    const conferences = response.data?.json &&
      (response.data.json as { conferences?: Array<{ item?: string; rows?: unknown[] }> }).conferences;
    const conferenceNames: Record<string, string> = {
      west: "Западная конференция",
      east: "Восточная конференция",
    };
    const conferenceGroups = (conferences ?? []).flatMap((conference) => {
      const teams = (conference.rows ?? [])
        .filter((team): team is Record<string, unknown> => Boolean(team && typeof team === "object"))
        .map((team) => {
          const normalized = normalizeTeam(team, { conference: conferenceNames[conference.item ?? ""] ?? conference.item ?? "", division: "" });
          return byId[normalized.id] ? { ...byId[normalized.id], rank: normalized.rank } : normalized;
        });
      return teams.length > 0 ? [{ conference: conferenceNames[conference.item ?? ""] ?? conference.item ?? "", division: "", teams }] : [];
    });
    const leagueRows = response.data?.json &&
      (response.data.json as { league?: Record<string, { rows?: unknown[] }> }).league?.["0"]?.rows;
    const overallTeams = (leagueRows ?? [])
      .filter((team): team is Record<string, unknown> => Boolean(team && typeof team === "object"))
      .map((team) => {
        const normalized = normalizeTeam(team, { conference: "", division: "" });
        const known = byId[normalized.id];
        return known ? { ...known, rank: normalized.rank } : normalized;
      })
      .filter((team) => team.id > 0 && team.name.length > 0);
    const overall = { conference: "Общая таблица", division: "", teams: overallTeams };
    return {
      overall,
      conferenceGroups,
      groups,
      teamsById: Object.fromEntries(overallTeams.map((team) => [team.id, team])),
    };
  }

  const groups = groupsFromPayload(payload);
  const uniqueGroups: StandingsGroup[] = [];
  const seen = new Set<number>();

  for (const group of groups) {
    const teams = group.teams.filter((team) => {
      if (seen.has(team.id)) return false;
      seen.add(team.id);
      return true;
    });
    if (teams.length > 0) uniqueGroups.push({ ...group, teams });
  }

  return {
    overall: uniqueGroups[0] ?? { conference: "Общая таблица", division: "", teams: [] },
    conferenceGroups: uniqueGroups,
    groups: uniqueGroups,
    teamsById: Object.fromEntries(
      uniqueGroups.flatMap((group) => group.teams.map((team) => [team.id, team]))
    ),
  };
}

function groupsFromRows(rows: Awaited<ReturnType<typeof prisma.standingsRow.findMany>>): StandingsData {
  const teams = rows.map((row) => ({
    id: row.teamId,
    name: row.name,
    logoUrl: row.logoUrl,
    conference: row.conference,
    division: row.division,
    rank: row.rank,
    gamesPlayed: row.gamesPlayed,
    wins: row.wins,
    otWins: row.otWins,
    shootoutWins: row.shootoutWins,
    shootoutLosses: row.shootoutLosses,
    otLosses: row.otLosses,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDiff: row.goalDiff,
    points: row.points,
    playoff: row.playoff,
  }));

  function withGroupRanks(groupTeams: typeof teams): typeof teams {
    return [...groupTeams]
      .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
      .map((team, index) => ({ ...team, rank: index + 1 }));
  }

  const grouped = new Map<string, typeof teams>();
  for (const team of teams) {
    const key = `${team.conference}\u0000${team.division}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(team);
  }

  const groups = Array.from(grouped, ([key, groupTeams]) => {
    const [conference, division] = key.split("\u0000");
    return { conference, division, teams: withGroupRanks(groupTeams) };
  });

  const conferenceGroups = new Map<string, typeof teams>();
  for (const team of teams) {
    if (!conferenceGroups.has(team.conference)) conferenceGroups.set(team.conference, []);
    conferenceGroups.get(team.conference)!.push(team);
  }

  return {
    overall: { conference: "Общая таблица", division: "", teams },
    conferenceGroups: Array.from(conferenceGroups, ([conference, conferenceTeams]) => ({
      conference,
      division: "",
      teams: withGroupRanks(conferenceTeams),
    })),
    groups,
    teamsById: Object.fromEntries(teams.map((team) => [team.id, team])),
  };
}
export async function getStandingsFromDb(): Promise<StandingsData> {
  return groupsFromRows(await prisma.standingsRow.findMany({ orderBy: [{ rank: "asc" }, { teamId: "asc" }] }));
}

export async function saveStandingsToDb(value: StandingsData): Promise<number> {
  const rows = Object.values(value.teamsById);
  await prisma.$transaction([
    prisma.standingsRow.deleteMany(),
    ...rows.map((team) => prisma.standingsRow.create({
      data: {
        teamId: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        conference: team.conference,
        division: team.division,
        rank: team.rank,
        gamesPlayed: team.gamesPlayed,
        wins: team.wins,
        otWins: team.otWins,
        shootoutWins: team.shootoutWins,
        shootoutLosses: team.shootoutLosses,
        otLosses: team.otLosses,
        losses: team.losses,
        goalsFor: team.goalsFor,
        goalsAgainst: team.goalsAgainst,
        goalDiff: team.goalDiff,
        points: team.points,
        playoff: team.playoff,
      },
    })),
  ]);
  return rows.length;
}

export async function getStandingsSafe(): Promise<StandingsData> {
  try {
    return await getStandingsFromDb();
  } catch {
    return emptyStandings();
  }
}

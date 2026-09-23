import { getSession } from "./khl-client";
import type { StandingsData, StandingsGroup, StandingsTeam } from "./types";

const STANDINGS_URL = "https://www.khl.ru/rest/standings/regular/";
const CACHE_TTL = 60_000;

let cached: { value: StandingsData; expiresAt: number } | null = null;

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

function normalizeStandings(payload: unknown): StandingsData {
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

export async function getStandings(forceRefresh = false): Promise<StandingsData> {
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;

  const session = await getSession();
  const body = new URLSearchParams({
    "values[type]": "regular",
    sessid: session.sessid,
  });
  let cookie = session.cookie;
  let response: Response | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    response = await fetch(STANDINGS_URL, {
      method: "POST",
      redirect: "manual",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://www.khl.ru",
        Referer: "https://www.khl.ru/",
        Cookie: cookie,
      },
      body: body.toString(),
      cache: "no-store",
    });

    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) {
      cookie = [cookie, ...setCookie.map((value) => value.split(";")[0])]
        .filter(Boolean)
        .join("; ");
    }

    const location = response.headers.get("location");
    if (!(response.status >= 300 && response.status < 400 && location)) break;
  }

  if (!response) throw new Error("Не удалось выполнить запрос standings");
  if (!response.ok) throw new Error(`Запрос standings вернул ошибку: ${response.status}`);

  const value = normalizeStandings(await response.json());
  cached = { value, expiresAt: Date.now() + CACHE_TTL };
  return value;
}

export type Team = { id: number; name: string; logoUrl: string | null };

export type StandingsTeam = {
  id: number;
  name: string;
  logoUrl: string | null;
  conference: string;
  division: string;
  rank: number;
  gamesPlayed: number;
  wins: number;
  otWins: number;
  shootoutWins: number;
  shootoutLosses: number;
  otLosses: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  playoff: boolean;
};

export type StandingsGroup = {
  conference: string;
  division: string;
  teams: StandingsTeam[];
};

export type StandingsData = {
  overall: StandingsGroup;
  conferenceGroups: StandingsGroup[];
  groups: StandingsGroup[];
  teamsById: Record<number, StandingsTeam>;
};

/** Backwards-compatible name for match-card consumers. */
export type TeamStats = StandingsTeam;
export type Game = {
  id: number;
  date: string;
  timeFormat: string | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  visitorScore: number | null;
  overtime: string | null;
  periodScores?: unknown;
  arena?: { city: string } | null;
  venue?: string | null;
  liveStatus?: string | null;
  livePeriod?: number | null;
  liveClock?: string | null;
  liveEvents?: unknown;
  liveUpdatedAt?: string | null;
  teamA: Team;
  teamB: Team;
};

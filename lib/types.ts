export type Team = { id: number; name: string; logoUrl: string | null };

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
  teamA: Team;
  teamB: Team;
};

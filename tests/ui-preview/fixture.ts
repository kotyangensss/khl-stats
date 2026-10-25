import type { Game, StandingsData, StandingsTeam } from "../../lib/types";

// Browser-only fixtures. Never imported by the application or its API routes.
const names = ["Авангард", "Металлург", "Динамо Минск", "Локомотив"];
const teams: StandingsTeam[] = names.map((name, index) => ({
  id: index + 1, name, logoUrl: null,
  conference: index < 2 ? "Восточная конференция" : "Западная конференция",
  division: ["Дивизион Чернышева", "Дивизион Харламова", "Дивизион Боброва", "Дивизион Тарасова"][index],
  rank: index + 1, gamesPlayed: 20, wins: 12 - index, otWins: 1, shootoutWins: 1,
  shootoutLosses: 1, otLosses: 1, losses: 4 + index, goalsFor: 60 - index * 3,
  goalsAgainst: 40 + index * 2, goalDiff: 20 - index * 5, points: 30 - index * 2, playoff: index < 2,
}));
export const standings: StandingsData = {
  overall: { conference: "Чемпионат", division: "", teams },
  conferenceGroups: [teams.slice(0, 2), teams.slice(2)].map(group => ({ conference: group[0].conference, division: "", teams: group })),
  groups: teams.map(team => ({ conference: team.conference, division: team.division, teams: [team] })),
  teamsById: Object.fromEntries(teams.map(team => [team.id, team])),
};
export const games: Game[] = [
  { id: 101, date: "2026-10-24T11:30:00.000Z", timeFormat: "14:30", status: "SCHEDULED", homeScore: null, visitorScore: null, overtime: null, teamA: teams[0], teamB: teams[1] },
  { id: 102, date: "2026-10-24T14:00:00.000Z", timeFormat: "17:00", status: "LIVE", homeScore: 0, visitorScore: 2, overtime: null, livePeriod: 2, liveClock: "12:34", teamA: teams[2], teamB: teams[3] },
  { id: 103, date: "2026-10-25T11:30:00.000Z", timeFormat: "14:30", status: "SCHEDULED", homeScore: null, visitorScore: null, overtime: null, teamA: teams[0], teamB: teams[2] },
  { id: 104, date: "2026-10-23T11:30:00.000Z", timeFormat: "14:30", status: "FINISHED", homeScore: 3, visitorScore: 2, overtime: "SO", teamA: teams[1], teamB: teams[3] },
];

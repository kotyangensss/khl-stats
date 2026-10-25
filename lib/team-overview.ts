import type { Game, StandingsTeam, Team } from "./types";
import { parseTimeMinutes } from "./schedule";
export type TeamFormEntry = {
    game: Game;
    home: boolean;
    opponent: Team;
    ownScore: number;
    opponentScore: number;
    result: "win" | "loss" | "draw";
};
export function recentTeamForm(games: Game[], teamId: number): TeamFormEntry[] {
    return games.filter(game => game.status === "FINISHED" && game.homeScore != null && game.visitorScore != null && (game.teamA.id === teamId || game.teamB.id === teamId))
        .sort((a, b) => b.date.localeCompare(a.date) || parseTimeMinutes(b.timeFormat) - parseTimeMinutes(a.timeFormat)).slice(0, 5).reverse().map(game => {
        const home = game.teamA.id === teamId;
        const ownScore = (home ? game.homeScore : game.visitorScore)!;
        const opponentScore = (home ? game.visitorScore : game.homeScore)!;
        return { game, home, opponent: home ? game.teamB : game.teamA, ownScore, opponentScore, result: ownScore === opponentScore ? "draw" : ownScore > opponentScore ? "win" : "loss" };
    });
}
export function neighbouringStandings(teams: StandingsTeam[], teamId: number): StandingsTeam[] {
    const ranked = [...teams].sort((a, b) => a.rank - b.rank);
    const index = ranked.findIndex(team => team.id === teamId);
    if (index < 0)
        return [];
    const start = Math.max(0, Math.min(index - 2, ranked.length - 5));
    return ranked.slice(start, start + 5);
}

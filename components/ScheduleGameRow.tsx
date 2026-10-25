import Link from "next/link";
import type { Game, StandingsTeam } from "@/lib/types";
import { TeamLogo } from "./TeamLogo";
import { TeamStatsLine } from "./TeamStatsLine";
import { GameStatus } from "./GameStatus";

export function ScheduleGameRow({ game, standings, showStats }: { game: Game; standings: Record<number, StandingsTeam>; showStats: boolean }) {
  return <Link className="schedule-game" href={`/game/${game.id}`}>
    <div className="schedule-club"><TeamLogo team={game.teamA} size={56} ring={false} /><div><strong>{game.teamA.name}</strong>{showStats && <TeamStatsLine stats={standings[game.teamA.id]} compact showRank={game.status !== "FINISHED"} />}</div></div>
    <GameStatus game={game} />
    <div className="schedule-club visitor"><TeamLogo team={game.teamB} size={56} ring={false} /><div><strong>{game.teamB.name}</strong>{showStats && <TeamStatsLine stats={standings[game.teamB.id]} compact showRank={game.status !== "FINISHED"} />}</div></div>
    <span className="row-arrow" aria-hidden="true">↗</span>
  </Link>;
}

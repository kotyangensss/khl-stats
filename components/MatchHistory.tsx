import Link from "next/link";
import type { Game } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import { TeamLogo } from "./TeamLogo";
import { GameStatus } from "./GameStatus";

export function MatchHistory({ games, emptyText }: { games: Game[]; emptyText: string }) {
  if (!games.length) return <p className="details-empty">{emptyText}</p>;
  return <div className="match-history">
    {games.map(game => <Link key={game.id} href={`/game/${game.id}`} className={`history-match${game.status === "SCHEDULED" && !game.timeFormat ? " time-pending" : ""}`}>
      <time dateTime={game.date}>{formatShortDate(game.date)}</time>
      <span className="history-club"><TeamLogo team={game.teamA} size={28} ring={false} /><span>{game.teamA.name}</span></span>
      <GameStatus game={game} />
      <span className="history-club history-visitor"><TeamLogo team={game.teamB} size={28} ring={false} /><span>{game.teamB.name}</span></span>
      <span className="history-arrow" aria-hidden="true">↗</span>
    </Link>)}
  </div>;
}

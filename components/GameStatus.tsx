import type { Game } from "../lib/types";
import { overtimeLabel } from "../lib/format";

export function GameStatus({ game }: { game: Game }) {
  const scheduled = game.status === "SCHEDULED";
  const liveLabel = game.liveStatus || (game.livePeriod ? `${game.livePeriod} период` : null);
  return <div className={`game-status ${game.status === "LIVE" ? "is-live" : ""}`}>
    <strong>{scheduled ? game.timeFormat || "Время уточняется" : `${game.homeScore ?? "—"} : ${game.visitorScore ?? "—"}`}</strong>
    <span>{scheduled ? "МСК" : game.status === "LIVE" ? `LIVE${liveLabel ? ` · ${liveLabel}` : ""}${game.liveClock ? ` · ${game.liveClock}` : ""}` : `Завершён${game.overtime ? ` · ${overtimeLabel(game.overtime)}` : ""}`}</span>
  </div>;
}

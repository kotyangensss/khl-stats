export type GameStatus = "SCHEDULED" | "LIVE" | "FINISHED";

type CalendarStatus = {
  approved: number;
  homeScore: string | number;
  visitorScore: string | number;
};

type HeaderStatus = {
  isOnline?: boolean;
  status?: string;
};

export function statusFromCalendar(
  game: CalendarStatus,
  current: GameStatus = "SCHEDULED"
): GameStatus {
  if (game.approved === 1 || current === "FINISHED") return "FINISHED";
  if (Number(game.homeScore) > 0 || Number(game.visitorScore) > 0) return "LIVE";
  return current;
}

export function statusFromHeader(header: HeaderStatus, current: GameStatus): GameStatus {
  if (/заверш|оконч|finished|final/i.test(header.status ?? "")) return "FINISHED";
  if (header.isOnline === true) return "LIVE";
  return current;
}

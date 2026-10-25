import type { Game } from "./types";
import { dayKey } from "./format";

export function nearestMatchDay(date: string, games: Game[]): string {
  return dayKey(games[0]?.date ?? date);
}

export function selectFeaturedGame(games: Game[]): Game | undefined {
  return games.find(game => game.status === "LIVE")
    ?? games.find(game => game.status === "SCHEDULED")
    ?? games[0];
}

export function motionProgress(scrollY: number, top: number, distance: number): number {
  if (distance <= 0) return 0;
  return Math.max(0, Math.min(1, (scrollY - top) / distance));
}

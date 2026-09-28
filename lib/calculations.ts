export function avg(value: number, games: number): number {
  return games > 0 ? value / games : 0;
}
import type { Game } from './types';
export function validDay(value: string | null | undefined): value is string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function shiftDay(day: string, count: number): string {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
}
export function monthFromDay(day: string): string { return day.slice(5, 7) + day.slice(2, 4); }
export function moscowToday(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find(item => item.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}
export function filterSchedule(games: Game[], teamId: number | null, live: boolean): Game[] {
    return games.filter(game => (teamId === null || game.teamA.id === teamId || game.teamB.id === teamId) && (!live || game.status === 'LIVE'));
}

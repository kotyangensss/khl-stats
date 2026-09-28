// ВАЖНО про часовой пояс: "сегодня" здесь считается по локальному времени
// сервера (обычно UTC на Vercel), а не по московскому. Для показа расписания
// с точностью до дня разница в 3 часа почти никогда не критична, но если
// когда-нибудь понадобится точность — здесь нужно будет явно сдвигать на
// UTC+3 вместо системного часового пояса.

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Окно "сегодня": [начало сегодня, начало завтра) */
export function todayWindow() {
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Окно "завтра": [начало завтра, начало послезавтра) */
export function tomorrowWindow() {
  const start = startOfToday();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function parseTimeMinutes(value: string | null | undefined): number {
  if (!value) return 24 * 60;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 24 * 60;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 24 * 60;
  return hours * 60 + minutes;
}

export function sortGamesByDateAndTime<T extends { date: Date | string; timeFormat?: string | null }>(
  games: T[],
  direction: "asc" | "desc" = "asc"
): T[] {
  return [...games].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    if (aTime !== bTime) return direction === "asc" ? aTime - bTime : bTime - aTime;
    return parseTimeMinutes(a.timeFormat) - parseTimeMinutes(b.timeFormat);
  });
}

// ---- Пагинация по месяцам ----
// Ключ месяца — "MMYY", напр. "1026" = октябрь 2026, "0127" = январь 2027.

export function monthKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}${yy}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function isValidMonthKey(key: string | undefined | null): key is string {
  return !!key && /^\d{4}$/.test(key);
}

function parseMonthKey(key: string): { year: number; month: number } {
  const match = /^(\d{2})(\d{2})$/.exec(key);
  if (!match) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  return { month: Number(match[1]) - 1, year: 2000 + Number(match[2]) };
}

/** Границы месяца по ключу: [начало месяца, начало следующего месяца) */
export function monthWindow(key: string): { start: Date; end: Date } {
  const { year, month } = parseMonthKey(key);
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
}

export function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  return monthKey(new Date(year, month + delta, 1));
}

const MONTHS_FULL = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

/** "Октябрь 2026" по ключу "1026" */
export function formatMonthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  const name = MONTHS_FULL[month] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}
// ВАЖНО про часовой пояс: "сегодня" здесь считается по локальному времени
// сервера (обычно UTC на Vercel), а не по московскому. Для показа расписания
// с точностью до дня разница в 3 часа почти никогда не критична, но если
// когда-нибудь понадобится точность — здесь нужно будет явно сдвигать на
// UTC+3 вместо системного часового пояса.

export const DAYS_PER_PAGE = 7;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "Предстоящие": окно вперёд от начала сегодняшнего дня */
export function upcomingWindow(page: number) {
  const start = startOfToday();
  start.setDate(start.getDate() + (page - 1) * DAYS_PER_PAGE);
  const end = new Date(start);
  end.setDate(end.getDate() + DAYS_PER_PAGE);
  return { start, end };
}

/** "Прошедшие": окно назад от начала завтрашнего дня, включая завершённые сегодня */
export function pastWindow(page: number) {
  const end = startOfToday();
  end.setDate(end.getDate() + 1);
  end.setDate(end.getDate() - (page - 1) * DAYS_PER_PAGE);
  const start = new Date(end);
  start.setDate(start.getDate() - DAYS_PER_PAGE);
  return { start, end };
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Короткая подпись диапазона дат для кнопок пагинации, напр. "24–30 сен" */
export function formatRange(start: Date, endExclusive: Date): string {
  const end = new Date(endExclusive);
  end.setDate(end.getDate() - 1); // конец окна включительно

  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = `${start.getDate()}${sameMonth ? "" : ` ${MONTHS_SHORT[start.getMonth()]}`}`;
  const endLabel = `${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;

  return `${startLabel}–${endLabel}`;
}

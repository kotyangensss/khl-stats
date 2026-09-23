const WEEKDAYS = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function formatDayHeading(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Компактный формат даты для узких списков, напр. на странице команды: "24 сен" */
export function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function logoSrc(logoUrl: string | null) {
  if (!logoUrl) return null;
  return logoUrl.startsWith("http") ? logoUrl : `https:${logoUrl}`;
}

export function overtimeLabel(ots: string | null | undefined): string | null {
  if (!ots) return null;
  const v = ots.toLowerCase();
  if (v.includes("so") || v.includes("bs") || v.includes("б")) return "Б"; // буллиты
  if (v.includes("ot") || v.includes("о")) return "ОТ"; // овертайм
  return ots; // неизвестный формат — показываем как есть, а не скрываем
}

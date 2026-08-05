const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function fmtD(date) {
  const p = date.split("-");
  return `${parseInt(p[2], 10)} ${MONTHS[parseInt(p[1], 10) - 1]}`;
}

export function fmtW(date) {
  return WEEKDAYS[new Date(`${date}T12:00:00`).getDay()];
}

export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const MONTH_LABELS = MONTHS;

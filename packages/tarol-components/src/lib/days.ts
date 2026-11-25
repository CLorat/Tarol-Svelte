// Calendar days as ISO strings `YYYY-MM-DD` (a backend `DateOnly`): the arithmetic runs on UTC dates, so no time zone or
// daylight saving change moves a day.

const date = (day: string): Date => new Date(`${day}T12:00:00Z`);
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const pad = (n: number): string => String(n).padStart(2, '0');

/** The day `n` days after `day` (before it for a negative `n`). */
export function addDays(day: string, n: number): string {
  const d = date(day);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** The same day `n` months later, clamped to the month's last day (31 January + 1 month = 28 or 29 February). */
export function addMonths(day: string, n: number): string {
  const d = date(day);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  first.setUTCDate(Math.min(d.getUTCDate(), last));
  return iso(first);
}

/** The first day of the week that contains `day`; `firstDay` 0 = Sunday … 6 = Saturday. */
export function startOfWeek(day: string, firstDay: number): string {
  return addDays(day, -((date(day).getUTCDay() - firstDay + 7) % 7));
}

/** The seven days of the week that contains `day`. */
export function weekOf(day: string, firstDay: number): string[] {
  const start = startOfWeek(day, firstDay);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Six weeks from the week of the month's first day: every month fits, and the grid keeps its height (no layout shift). */
export function monthGrid(day: string, firstDay: number): string[][] {
  const start = startOfWeek(`${day.slice(0, 8)}01`, firstDay);
  return Array.from({ length: 6 }, (_, w) => weekOf(addDays(start, 7 * w), firstDay));
}

/** The last day of the month of `day`. */
export function endOfMonth(day: string): string {
  return addDays(addMonths(`${day.slice(0, 8)}01`, 1), -1);
}

/** Today in the browser's time zone. */
export function localToday(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A day as a `Date` for `Intl.DateTimeFormat` with `timeZone: 'UTC'`. */
export const asDate = date;

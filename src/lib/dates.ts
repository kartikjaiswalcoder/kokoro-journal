// Date helpers. All keys are local YYYY-MM-DD to avoid timezone drift.

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

// First day of the month containing key, as a Date.
export function firstOfMonth(year: number, month0: number): Date {
  return new Date(year, month0, 1);
}

// Number of days in a given month (month0 = 0..11). Handles leap years correctly.
export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

// Build a 6x7 grid (42 cells) for the month, with leading/trailing blanks.
// Monday-first week.
export function buildMonthGrid(year: number, month0: number): (string | null)[] {
  const first = firstOfMonth(year, month0);
  const jsDow = first.getDay(); // 0=Sun..6=Sat
  const mondayDow = (jsDow + 6) % 7; // 0=Mon..6=Sun
  const total = daysInMonth(year, month0);
  const cells: (string | null)[] = [];
  for (let i = 0; i < mondayDow; i++) cells.push(null);
  for (let day = 1; day <= total; day++) {
    cells.push(toDateKey(new Date(year, month0, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatLongDate(key: string): string {
  const d = parseDateKey(key);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${d.getDate()}`;
}

// "Sun" — short weekday shown under the flower in All Entries.
export function formatWeekdayShort(key: string): string {
  return parseDateKey(key).toLocaleDateString("en-US", { weekday: "short" });
}

// "Sunday, Nov 22, 2026" — Reflections card header.
export function formatReflectionDate(key: string): string {
  const d = parseDateKey(key);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${formatShortDate(key)}`;
}

// "Nov 22, 2026"
export function formatShortDate(key: string): string {
  const d = parseDateKey(key);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Is the given date key strictly after today?
export function isFutureKey(key: string): boolean {
  return key > todayKey();
}

// Compute the current journaling streak from a set of date keys with entries.
// - Counts consecutive on-time days backwards.
// - If today has no entry yet, the user still has the whole day to keep the
//   streak alive, so counting starts from yesterday instead of resetting.
// - `isOnTime` (optional): a day only counts if it returns true (excludes backfills).
export function computeStreak(
  entryKeys: Set<string>,
  isOnTime?: (key: string) => boolean,
): number {
  if (entryKeys.size === 0) return 0;
  const onTime = isOnTime ?? (() => true);
  const counts = (k: string) => entryKeys.has(k) && onTime(k);
  let cursor = todayKey();
  if (!counts(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (counts(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

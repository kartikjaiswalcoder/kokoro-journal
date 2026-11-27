import { addDays, parseDateKey, todayKey } from "./dates";

// Search used by All Entries (entry text) and Reflections (AI summaries).
// - Case, accents and punctuation don't matter ("cafe" finds "Café", "didnt" finds "didn't").
// - A whole phrase or sentence matches when it appears from the start of a word.
// - Otherwise every typed word must match somewhere (text, date, weekday, month, year or mood),
//   each from the start of a word: "rain" finds "raining", "ain" does not.
// - Dates can be typed many ways: "tuesday", "tue", "17th nov", "november 17 2026", "17/11/26",
//   "2026-11-17", "today", "yesterday".
// - Numbers match whole numbers only: "1" or "nov 1" finds the 1st, never the 2nd, 11th or 12th.
//   A lone number means a day (or a full year like "2026"), not a month number.

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
function isMonthWord(word: string): boolean {
  return word.length >= 3 && MONTHS.some((m) => m.startsWith(word) || (word === "sept" && m === "september"));
}

function dateWords(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = d.toLocaleDateString("en-US", { month: "long" });
  const words = [
    weekday, weekday.slice(0, 3), monthName, monthName.slice(0, 3),
    monthName === "September" ? "sept" : "",
    String(day), String(day).padStart(2, "0"),
    String(year),
    dateKey === todayKey() ? "today" : "",
    dateKey === addDays(todayKey(), -1) ? "yesterday" : "",
  ];
  return normalizeSearchText(words.join(" "));
}

// Ready-made date phrases so a typed date in any common order matches as a whole.
function datePhrases(dateKey: string): string[] {
  const d = parseDateKey(dateKey);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const yy = String(year).slice(-2);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = d.toLocaleDateString("en-US", { month: "long" });
  const short = monthName.slice(0, 3);
  return [
    dateKey,
    `${weekday} ${monthName} ${day} ${year}`, `${weekday} ${day} ${monthName} ${year}`,
    `${monthName} ${day} ${year}`, `${day} ${monthName} ${year}`,
    `${short} ${day} ${year}`, `${day} ${short} ${year}`,
    `${day}/${month}/${year}`, `${month}/${day}/${year}`, `${day}/${month}/${yy}`, `${month}/${day}/${yy}`,
    `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`,
    `${monthName} ${year}`, `${short} ${year}`,
  ].map(normalizeSearchText);
}

// Words match from their start ("rain" finds "raining"); a search ending in a number must end
// exactly there, so "1" never matches "12" and "nov 1" never matches "nov 12".
function startsAtWord(haystack: string, needle: string): boolean {
  return /\d$/.test(needle) ? ` ${haystack} `.includes(` ${needle} `) : ` ${haystack}`.includes(` ${needle}`);
}

export function matchesJournalSearch(dateKey: string, text: string, query: string, tags: string[] = []): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  const body = normalizeSearchText(text);
  const extra = normalizeSearchText(tags.join(" "));
  // A lone number is a day of the month or a full year ("1", "01", "2026"), or a number in the text.
  if (/^\d+$/.test(needle)) return startsAtWord(`${body} ${extra} ${dateWords(dateKey)}`, needle);
  const phrases = datePhrases(dateKey);
  if (startsAtWord(body, needle) || phrases.some((p) => startsAtWord(p, needle))) return true;
  const words = needle.split(" ");
  // A month with a number ("nov 1", "1st november") is about that day: its numbers must be the date's.
  const dateText = `${dateWords(dateKey)} ${phrases.join(" ")}`;
  if (words.some(isMonthWord) && words.some((w) => /^\d+$/.test(w) && !startsAtWord(dateText, w))) return false;
  const haystack = `${body} ${extra} ${dateWords(dateKey)} ${phrases.join(" ")}`;
  return words.every((word) => startsAtWord(haystack, word));
}

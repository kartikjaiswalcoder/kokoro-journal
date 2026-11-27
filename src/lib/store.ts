import { supabase } from "@/integrations/supabase/client";
import type { JournalEntry, Mood } from "@/types";
import { computeStreak } from "./dates";
import { toDateKey } from "./dates";
import { MAX_DAY_PHOTOS, PHOTO_BUCKET } from "./photo-rules";

// Load all entries (single-tenant). Cached in memory + localStorage for instant UI.
const CACHE_KEY = "kokoro_entries_v1";

type EntryMap = Record<string, JournalEntry>;

function loadCache(): EntryMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as EntryMap) : {};
  } catch {
    return {};
  }
}

function saveCache(entries: EntryMap) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

let cache: EntryMap = loadCache();
const listeners = new Set<() => void>();
let storeVersion = 0;

export function getStoreVersion(): number {
  return storeVersion;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  storeVersion += 1;
  saveCache(cache);
  listeners.forEach((fn) => fn());
}

export function getAllEntries(): JournalEntry[] {
  return Object.values(cache);
}

export function getEntry(dateKey: string): JournalEntry | undefined {
  return cache[dateKey];
}

export function getEntryDates(): Set<string> {
  return new Set(Object.keys(cache));
}

// Days that ever had an on-time entry. Deleting an entry later doesn't
// remove its day, so deletions never lower the streak.
const STREAK_DAYS_KEY = "kokoro_streak_days";
let streakDays: Set<string> = (() => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(STREAK_DAYS_KEY) || "[]"));
  } catch {
    return new Set<string>();
  }
})();
let streakDaysLoaded = false;

function recordStreakDays(): boolean {
  let added = false;
  for (const k of Object.keys(cache)) {
    if (isOnTime(k) && !streakDays.has(k)) {
      streakDays.add(k);
      added = true;
    }
  }
  if (added) {
    try {
      localStorage.setItem(STREAK_DAYS_KEY, JSON.stringify([...streakDays]));
    } catch {
      // ignore
    }
  }
  return added;
}

async function persistStreakDays(): Promise<void> {
  if (!streakDaysLoaded) return;
  await supabase
    .from("app_settings")
    .upsert(
      { streak_days: [...streakDays], updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
}

export function currentStreak(): number {
  recordStreakDays();
  return computeStreak(streakDays);
}

// An entry counts toward the streak only if it was written on its own day,
// not backfilled on a later date. We check created_at's local date against
// the entry_date. Backfilled entries (created after their day) don't extend
// the streak, so writing on yesterday after already writing today won't bump it.
function isOnTime(key: string): boolean {
  const entry = cache[key];
  if (!entry || !entry.created_at) return false;
  const createdDay = toDateKey(new Date(entry.created_at));
  return createdDay === key;
}

// Longest streak ever reached, persisted in app_settings.
const LONGEST_CACHE_KEY = "kokoro_longest_streak";
let longestStreakCached: number = (() => {
  try {
    return Number(localStorage.getItem(LONGEST_CACHE_KEY)) || 0;
  } catch {
    return 0;
  }
})();
const longestListeners = new Set<() => void>();

export function getLongestStreak(): number {
  return longestStreakCached;
}
export function subscribeLongestStreak(fn: () => void): () => void {
  longestListeners.add(fn);
  return () => longestListeners.delete(fn);
}
function setLongestStreak(v: number) {
  longestStreakCached = v;
  try {
    localStorage.setItem(LONGEST_CACHE_KEY, String(v));
  } catch {
    // ignore
  }
  longestListeners.forEach((fn) => fn());
}

export async function loadLongestStreak(): Promise<void> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("longest_streak, streak_days")
    .maybeSingle();
  if (error) return;
  for (const d of data?.streak_days ?? []) streakDays.add(d);
  streakDaysLoaded = true;
  recordStreakDays();
  try {
    localStorage.setItem(STREAK_DAYS_KEY, JSON.stringify([...streakDays]));
  } catch {
    // ignore
  }
  void persistStreakDays();
  emit();
  setLongestStreak(data?.longest_streak ?? 0);
}

// Bump the persisted longest streak if the current streak beats it.
export async function maybeUpdateLongestStreak(): Promise<void> {
  const current = currentStreak();
  if (current <= longestStreakCached) return;
  setLongestStreak(current);
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { longest_streak: current, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}

// Saves show up instantly: the in-memory entry changes first and the database write follows
// in the background. Writes for the same day run one after another so a later save always
// lands last and can use the id a first-time insert gets back.
const PENDING_ID = "pending:";
const writeChains = new Map<string, Promise<unknown>>();
const localVersions = new Map<string, number>();

function queueWrite<T>(dateKey: string, task: () => Promise<T>): Promise<T> {
  const previous = writeChains.get(dateKey) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  const tail = run.catch(() => {});
  writeChains.set(dateKey, tail);
  void tail.then(() => {
    if (writeChains.get(dateKey) === tail) writeChains.delete(dateKey);
  });
  return run;
}

function bumpVersion(dateKey: string): number {
  const v = (localVersions.get(dateKey) ?? 0) + 1;
  localVersions.set(dateKey, v);
  return v;
}

// Apply a finished write, unless a newer local change already replaced it.
function settle(dateKey: string, version: number, row: JournalEntry) {
  if (localVersions.get(dateKey) === version) cache[dateKey] = row;
  else if (cache[dateKey]) cache[dateKey] = { ...cache[dateKey], id: row.id, created_at: row.created_at };
}

function revert(dateKey: string, version: number, before: JournalEntry | undefined) {
  if (localVersions.get(dateKey) !== version) return;
  if (before) cache[dateKey] = before;
  else delete cache[dateKey];
  emit();
}

function serverId(dateKey: string): string | null {
  const id = cache[dateKey]?.id;
  return id && !id.startsWith(PENDING_ID) ? id : null;
}

// Fetch from Supabase and merge into cache.
export async function refreshFromServer(): Promise<void> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: true });

  if (error) throw error;
  const next: EntryMap = {};
  for (const row of data ?? []) {
    next[row.entry_date] = row as JournalEntry;
  }
  // Keep days with a save still on its way.
  for (const key of writeChains.keys()) {
    const local = cache[key];
    if (local) next[key] = local;
  }
  cache = next;
  if (recordStreakDays()) void persistStreakDays();
  emit();
}

// Upsert an entry (insert or update by entry_date). The cache updates immediately.
// Photos are saved with the entry when given; leaving them out keeps the day's photos as they are.
export function saveEntry(
  dateKey: string,
  content: string,
  mood: Mood | null,
  photos?: string[],
): Promise<JournalEntry> {
  const before = cache[dateKey];
  const nextPhotos = photos ? photos.slice(0, MAX_DAY_PHOTOS) : undefined;
  const photoPatch = nextPhotos ? { photos: nextPhotos } : {};
  const now = new Date().toISOString();
  const clearSummary = !!before && (before.content !== content || (before.mood ?? null) !== (mood ?? null));
  const optimistic: JournalEntry = before
    ? { ...before, content, mood: mood ?? null, updated_at: now, ...photoPatch, ...(clearSummary ? { ai_summary: null, ai_summary_created_at: null } : {}) }
    : { id: `${PENDING_ID}${dateKey}`, entry_date: dateKey, content, mood: mood ?? null, created_at: now, updated_at: now, ai_summary: null, ai_summary_created_at: null, photos: nextPhotos ?? [] };
  const version = bumpVersion(dateKey);
  cache[dateKey] = optimistic;
  if (recordStreakDays()) void persistStreakDays();
  emit();
  void maybeUpdateLongestStreak().catch(() => {});

  return queueWrite(dateKey, async () => {
    try {
      const id = serverId(dateKey);
      let result: JournalEntry;
      if (id) {
        const { data, error } = await supabase
          .from("journal_entries")
          .update({
            content,
            mood: mood ?? null,
            updated_at: now,
            ...photoPatch,
            ...(clearSummary ? { ai_summary: null, ai_summary_created_at: null } : {}),
          })
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        result = data as JournalEntry;
      } else {
        const { data, error } = await supabase
          .from("journal_entries")
          .insert({ entry_date: dateKey, content, mood: mood ?? null, ...photoPatch })
          .select("*")
          .single();
        if (error) throw error;
        result = data as JournalEntry;
      }
      settle(dateKey, version, result);
      emit();
      return result;
    } catch (error) {
      revert(dateKey, version, before);
      throw error;
    }
  });
}

// Save an AI summary onto an entry. The cache updates immediately.
export function saveAISummary(
  dateKey: string,
  summary: string,
): Promise<JournalEntry> {
  const before = cache[dateKey];
  if (!before) return Promise.reject(new Error("Entry does not exist yet"));
  const now = new Date().toISOString();
  const version = bumpVersion(dateKey);
  cache[dateKey] = { ...before, ai_summary: summary, ai_summary_created_at: now, updated_at: now };
  emit();
  return queueWrite(dateKey, async () => {
    try {
      const id = serverId(dateKey);
      if (!id) throw new Error("Entry does not exist yet");
      const { data, error } = await supabase
        .from("journal_entries")
        .update({ ai_summary: summary, ai_summary_created_at: now, updated_at: now })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const updated = data as JournalEntry;
      settle(dateKey, version, updated);
      emit();
      return updated;
    } catch (error) {
      revert(dateKey, version, before);
      throw error;
    }
  });
}

// Delete an entry (after any save still on its way for that day), including its photos.
export async function deleteEntry(dateKey: string): Promise<void> {
  if (!cache[dateKey]) return;
  const photos = cache[dateKey]?.photos ?? [];
  await queueWrite(dateKey, async () => {
    const id = serverId(dateKey);
    if (!id) return;
    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", id);
    if (error) throw error;
  });
  bumpVersion(dateKey);
  delete cache[dateKey];
  emit();
  void maybeUpdateLongestStreak();
  if (photos.length > 0) {
    void Promise.resolve()
      .then(() => supabase.storage.from(PHOTO_BUCKET).remove(photos))
      .catch(() => {});
  }
}

// Determine if an AI summary is stale (entry text changed after the summary was made).
export function isSummaryStale(dateKey: string): boolean {
  const e = cache[dateKey];
  if (!e || !e.ai_summary || !e.ai_summary_created_at) return false;
  return new Date(e.updated_at) > new Date(e.ai_summary_created_at);
}

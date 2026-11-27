// Sort orders for All Entries and Reflections (browser-safe, pure).
export type EntrySort = "newest" | "oldest" | "updated";

export const ENTRY_SORT_OPTIONS: { value: EntrySort; label: string }[] = [
  { value: "newest", label: "Newest to Oldest" },
  { value: "oldest", label: "Oldest to Newest" },
  { value: "updated", label: "Recently Updated" },
];

type Sortable = { entry_date: string; updated_at?: string | null; created_at?: string | null };

function editedAt(e: Sortable): number {
  const t = Date.parse(e.updated_at ?? e.created_at ?? "");
  return Number.isNaN(t) ? 0 : t;
}

// Returns a new array; ties fall back to newest journal date first.
export function sortEntries<T extends Sortable>(entries: T[], sort: EntrySort): T[] {
  const byDateDesc = (a: T, b: T) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0);
  return [...entries].sort((a, b) => {
    if (sort === "oldest") return -byDateDesc(a, b);
    if (sort === "updated") return editedAt(b) - editedAt(a) || byDateDesc(a, b);
    return byDateDesc(a, b);
  });
}

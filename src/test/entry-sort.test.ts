import { describe, it, expect } from "vitest";
import { sortEntries } from "@/lib/entry-sort";

const rows = [
  { entry_date: "2026-11-10", updated_at: "2026-11-22T10:00:00Z" },
  { entry_date: "2026-11-20", updated_at: "2026-11-20T09:00:00Z" },
  { entry_date: "2026-11-01", updated_at: null },
];
const dates = (r: typeof rows) => r.map((e) => e.entry_date);

describe("sortEntries", () => {
  it("Newest to Oldest puts the latest journal date first", () => {
    expect(dates(sortEntries(rows, "newest"))).toEqual(["2026-11-20", "2026-11-10", "2026-11-01"]);
  });
  it("Oldest to Newest puts the earliest journal date first", () => {
    expect(dates(sortEntries(rows, "oldest"))).toEqual(["2026-11-01", "2026-11-10", "2026-11-20"]);
  });
  it("Recently Updated orders by last edit, missing timestamps last", () => {
    expect(dates(sortEntries(rows, "updated"))).toEqual(["2026-11-10", "2026-11-20", "2026-11-01"]);
  });
});

import { loadSort, saveSort } from "@/lib/entry-sort";
describe("saved sort", () => {
  it("defaults to Newest and remembers the chosen sort per list", () => {
    localStorage.clear();
    expect(loadSort("entries")).toBe("newest");
    saveSort("entries", "oldest");
    expect(loadSort("entries")).toBe("oldest");
    expect(loadSort("reflections")).toBe("newest");
  });
});

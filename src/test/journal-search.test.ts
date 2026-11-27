import { describe, expect, it } from "vitest";
import { matchesJournalSearch } from "@/lib/journal-search";

const text = "Walked by the river and had coffee with Mira.";
describe("journal search", () => {
  it("finds entries by weekday and by date", () => {
    expect(matchesJournalSearch("2026-11-17", text, "tuesday")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", text, "Nov 17")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", text, "17/11/2026")).toBe(true);
  });
  it("finds entries by words or phrases from the text", () => {
    expect(matchesJournalSearch("2026-11-17", text, "coffee with mira")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", text, "tuesday river")).toBe(true);
  });
  it("understands full weekdays, ordinals, month names and short years", () => {
    expect(matchesJournalSearch("2026-11-17", text, "17th november")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", text, "Tuesday, November 17th")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", text, "17/11/26")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", text, "november 2026")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", text, "wednesday")).toBe(false);
  });
  it("ignores accents and apostrophes and matches from the start of words", () => {
    const note = "Didn't sleep. Café visit while it was raining.";
    expect(matchesJournalSearch("2026-11-17", note, "cafe")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", note, "didnt sleep")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", note, "rain")).toBe(true);
    expect(matchesJournalSearch("2026-11-17", note, "ain")).toBe(false);
  });
  it("finds entries by their mood", () => {
    expect(matchesJournalSearch("2026-11-17", text, "calm river", ["Calm"])).toBe(true);
    expect(matchesJournalSearch("2026-11-17", text, "anxious", ["Calm"])).toBe(false);
  });
  it("shows nothing for unrelated searches", () => {
    expect(matchesJournalSearch("2026-11-17", text, "volcano")).toBe(false);
    expect(matchesJournalSearch("2026-11-17", text, "river volcano")).toBe(false);
  });
});

describe("journal search by exact day", () => {
  it("a lone number finds only that day", () => {
    expect(matchesJournalSearch("2026-11-01", "", "1")).toBe(true);
    expect(matchesJournalSearch("2026-11-02", "", "1")).toBe(false);
    expect(matchesJournalSearch("2026-11-12", "", "1")).toBe(false);
    expect(matchesJournalSearch("2026-01-05", "", "1")).toBe(false);
  });
  it("month and day finds only that day", () => {
    expect(matchesJournalSearch("2026-11-01", "", "nov 1")).toBe(true);
    expect(matchesJournalSearch("2026-11-01", "", "November 1")).toBe(true);
    expect(matchesJournalSearch("2026-11-02", "", "nov 1")).toBe(false);
    expect(matchesJournalSearch("2026-11-12", "", "November 1")).toBe(false);
    expect(matchesJournalSearch("2026-11-02", "1 cup of tea", "nov 1")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { formatReflectionDate, formatShortDate, formatWeekdayShort } from "@/lib/dates";

describe("entry card date formats", () => {
  it("All Entries header reads like Nov 22, 2026", () => {
    expect(formatShortDate("2026-11-22")).toBe("Nov 22, 2026");
  });
  it("All Entries flower label is the short weekday", () => {
    expect(formatWeekdayShort("2026-11-22")).toBe("Sun");
  });
  it("Reflections header reads like Sunday, Nov 22, 2026", () => {
    expect(formatReflectionDate("2026-11-22")).toBe("Sunday, Nov 22, 2026");
  });
});

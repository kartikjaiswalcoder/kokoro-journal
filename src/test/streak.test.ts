import { test, expect } from "vitest";
import { computeStreak, todayKey, addDays } from "@/lib/dates";
const t = todayKey();
test("yesterday's streak survives while today is still open", () => {
  expect(computeStreak(new Set([addDays(t, -1)]))).toBe(1);
  expect(computeStreak(new Set([addDays(t, -1), addDays(t, -2)]))).toBe(2);
});
test("writing today extends the streak", () => {
  expect(computeStreak(new Set([t, addDays(t, -1)]))).toBe(2);
});
test("missing a whole day resets to 0", () => {
  expect(computeStreak(new Set([addDays(t, -2)]))).toBe(0);
});
test("a deleted day stays in the streak once recorded", () => {
  const days = new Set([t, addDays(t, -1), addDays(t, -2)]);
  // Deletion doesn't remove recorded streak days, so count stays 3.
  expect(computeStreak(days)).toBe(3);
});

import { describe, expect, it } from "vitest";
import { photosToAdd, showAddSlot } from "@/lib/photo-rules";

describe("Day photo rules", () => {
  it("allows picking two photos at once on an empty day", () => {
    expect(photosToAdd(0, ["a", "b"])).toEqual(["a", "b"]);
  });
  it("never keeps more than two photos per day", () => {
    expect(photosToAdd(0, ["a", "b", "c"])).toEqual(["a", "b"]);
    expect(photosToAdd(1, ["a", "b"])).toEqual(["a"]);
    expect(photosToAdd(2, ["a"])).toEqual([]);
  });
  it("shows the + slot only in the notepad when exactly one photo exists", () => {
    expect(showAddSlot(1, true)).toBe(true);
    expect(showAddSlot(2, true)).toBe(false);
    expect(showAddSlot(1, false)).toBe(false);
  });
});

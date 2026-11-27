// Pure, browser-safe rules for day photos (keepsakes).
export const MAX_DAY_PHOTOS = 2;
export const PHOTO_BUCKET = "journal-photos";

// How many of the picked files fit, given the photos the day already has.
export function photosToAdd<T>(currentCount: number, picked: T[]): T[] {
  return picked.slice(0, Math.max(0, MAX_DAY_PHOTOS - currentCount));
}

// The "+" slot under the frame shows only while editing a day with exactly one photo.
export function showAddSlot(count: number, editable: boolean): boolean {
  return editable && count === 1;
}

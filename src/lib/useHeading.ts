import { useSyncExternalStore } from "react";
import { subscribeHeading, getHeading } from "./settings";

const fallback = "";
let cached = fallback;

function getSnapshot(): string {
  const h = getHeading();
  if (h !== cached) cached = h;
  return cached;
}

export function useHeading(): string {
  return useSyncExternalStore(subscribeHeading, getSnapshot, () => fallback);
}

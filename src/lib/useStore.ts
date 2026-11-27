import { useSyncExternalStore } from "react";
import { subscribe, getStoreVersion } from "./store";

// Subscribe components to store changes (cache + server refresh).
export function useStore(): number {
  return useSyncExternalStore(
    subscribe,
    getStoreVersion,
    () => 0,
  );
}

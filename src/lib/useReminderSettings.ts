import { useSyncExternalStore } from "react";
import { getReminderSettings, subscribeReminderSettings } from "./reminders";

export function useReminderSettings() {
  return useSyncExternalStore(subscribeReminderSettings, getReminderSettings, getReminderSettings);
}

// Pure, browser-safe rules for when daily journaling reminders go out.

export const FOLLOW_UP_MINUTES = 15;
const SEND_WINDOW_MINUTES = 10; // tolerate a late or skipped scheduler tick
const FOLLOW_UP_WINDOW_MINUTES = 45;

export const REMINDER_MESSAGES = {
  remind: {
    title: "Time to write 🌸",
    body: "Your page for today is waiting. Take a quiet moment for yourself.",
    tag: "kokoro-reminder",
  },
  missed: {
    title: "Still a little time for today 🌱",
    body: "You haven't written yet. Even one line about your day counts.",
    tag: "kokoro-reminder",
  },
} as const;

export type ReminderAction = "remind" | "missed" | null;

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date (YYYY-MM-DD) and minutes since midnight in the given time zone. */
export function localClock(now: Date, timeZone: string): { dateKey: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function parseReminderTime(value: string | null | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Which notification (if any) is due right now for one person. */
export function reminderAction(input: {
  now: Date;
  timeZone: string;
  reminderTime: string | null;
  sentOn: string | null;
  missedSentOn: string | null;
}): { action: ReminderAction; dateKey: string } {
  const target = parseReminderTime(input.reminderTime);
  const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";
  const { dateKey, minutes } = localClock(input.now, timeZone);
  if (target === null) return { action: null, dateKey };
  const since = minutes - target;
  if (input.sentOn !== dateKey) {
    return { action: since >= 0 && since < SEND_WINDOW_MINUTES ? "remind" : null, dateKey };
  }
  if (input.missedSentOn !== dateKey && since >= FOLLOW_UP_MINUTES && since < FOLLOW_UP_MINUTES + FOLLOW_UP_WINDOW_MINUTES) {
    return { action: "missed", dateKey };
  }
  return { action: null, dateKey };
}

// The "Set a reminder" invite never appears on someone's first visits, then only now and then.
export const REMINDER_PROMPT_FIRST_VISIT = 3;
export const REMINDER_PROMPT_EVERY_VISITS = 4;

export function shouldOfferReminderPrompt(visit: number): boolean {
  return visit >= REMINDER_PROMPT_FIRST_VISIT && (visit - REMINDER_PROMPT_FIRST_VISIT) % REMINDER_PROMPT_EVERY_VISITS === 0;
}

// The "turn on notifications for this device" invite: only where the account already has a
// reminder time but this device has never been asked (not granted, not blocked), on the same
// gentle visit rhythm, and never again once someone ticks "Don't ask again on this device".
export function shouldOfferDevicePrompt(input: {
  reminderTime: string | null;
  permission: NotificationPermission | "unsupported";
  embedded: boolean;
  dismissedOnDevice: boolean;
  visit: number;
}): boolean {
  if (!input.reminderTime || input.embedded || input.dismissedOnDevice) return false;
  if (input.permission !== "default") return false;
  return shouldOfferReminderPrompt(input.visit);
}

import { describe, expect, it } from "vitest";
import { reminderAction, FOLLOW_UP_MINUTES, shouldOfferReminderPrompt, shouldOfferDevicePrompt } from "@/lib/reminder-schedule";

// 2026-11-17 15:30 UTC is 21:00 in Kolkata (UTC+5:30).
const at = (iso: string) => new Date(iso);
const base = { timeZone: "Asia/Kolkata", reminderTime: "21:00", sentOn: null, missedSentOn: null };

describe("daily journaling reminders", () => {
  it("sends the reminder at the chosen local time", () => {
    expect(reminderAction({ ...base, now: at("2026-11-17T15:30:00Z") })).toEqual({ action: "remind", dateKey: "2026-11-17" });
  });

  it("does not send before the chosen time or twice in one day", () => {
    expect(reminderAction({ ...base, now: at("2026-11-17T15:29:00Z") }).action).toBeNull();
    expect(reminderAction({ ...base, sentOn: "2026-11-17", now: at("2026-11-17T15:31:00Z") }).action).toBeNull();
  });

  it("sends the follow-up 15 minutes after the reminder, once", () => {
    expect(FOLLOW_UP_MINUTES).toBe(15);
    const sent = { ...base, sentOn: "2026-11-17" };
    expect(reminderAction({ ...sent, now: at("2026-11-17T15:44:00Z") }).action).toBeNull();
    expect(reminderAction({ ...sent, now: at("2026-11-17T15:45:00Z") }).action).toBe("missed");
    expect(reminderAction({ ...sent, missedSentOn: "2026-11-17", now: at("2026-11-17T15:50:00Z") }).action).toBeNull();
  });

  it("uses each person's own time zone", () => {
    const ny = { ...base, timeZone: "America/New_York" };
    expect(reminderAction({ ...ny, now: at("2026-11-17T15:30:00Z") }).action).toBeNull();
    expect(reminderAction({ ...ny, now: at("2026-11-18T02:00:00Z") })).toEqual({ action: "remind", dateKey: "2026-11-17" });
  });

  it("sends nothing when no reminder time is set", () => {
    expect(reminderAction({ ...base, reminderTime: null, now: at("2026-11-17T15:30:00Z") }).action).toBeNull();
  });
});

describe("reminder invite pop-up", () => {
  it("never shows on the first two visits", () => {
    expect(shouldOfferReminderPrompt(1)).toBe(false);
    expect(shouldOfferReminderPrompt(2)).toBe(false);
  });
  it("shows only every fourth visit after that", () => {
    expect(shouldOfferReminderPrompt(3)).toBe(true);
    expect(shouldOfferReminderPrompt(4)).toBe(false);
    expect(shouldOfferReminderPrompt(6)).toBe(false);
    expect(shouldOfferReminderPrompt(7)).toBe(true);
  });
});

describe("per-device notification invite", () => {
  const base = { reminderTime: "21:00", permission: "default" as const, embedded: false, dismissedOnDevice: false, visit: 3 };
  it("shows on a device that was never asked, on visits 3, 7, 11", () => {
    expect(shouldOfferDevicePrompt(base)).toBe(true);
    expect(shouldOfferDevicePrompt({ ...base, visit: 7 })).toBe(true);
    expect(shouldOfferDevicePrompt({ ...base, visit: 1 })).toBe(false);
    expect(shouldOfferDevicePrompt({ ...base, visit: 4 })).toBe(false);
  });
  it("never shows where notifications are allowed or blocked", () => {
    expect(shouldOfferDevicePrompt({ ...base, permission: "granted" })).toBe(false);
    expect(shouldOfferDevicePrompt({ ...base, permission: "denied" })).toBe(false);
  });
  it("never shows without a reminder time or after don't-ask-again on this device", () => {
    expect(shouldOfferDevicePrompt({ ...base, reminderTime: null })).toBe(false);
    expect(shouldOfferDevicePrompt({ ...base, dismissedOnDevice: true })).toBe(false);
  });
});

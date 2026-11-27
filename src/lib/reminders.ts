import { supabase } from "@/integrations/supabase/client";

// Public half of the notification signing key (the private half is a server secret).
export const VAPID_PUBLIC_KEY = "BCjwFXy39uigqTIkyPButLjh51oqAtfVPZHHSg9Imx1Hdn6xKnoSyOVNOhFFiXrdGLcTZsakpc59o7gtl_owqfk";
// Per-account keys, so one Google login's choices never affect another on the same device.
const DISMISSED_KEY = "kokoro_reminder_prompt_dismissed";
const VISITS_KEY = "kokoro_app_visits";
// Per account and per device: "Don't ask again on this device" for the notification invite.
const DEVICE_DISMISSED_KEY = "kokoro_device_reminders_dismissed";

export type ReminderSettings = { time: string | null; promptDismissed: boolean; loaded: boolean; userId: string | null };

let state: ReminderSettings = { time: null, promptDismissed: false, loaded: false, userId: null };
const listeners = new Set<() => void>();

function set(next: Partial<ReminderSettings>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

export function getReminderSettings(): ReminderSettings {
  return state;
}

export function subscribeReminderSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function localDismissed(userId: string | null): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${DISMISSED_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

// Counts app opens for this account on this device (once per page load).
let visitThisLoad: number | null = null;
export function countAppVisit(userId: string): number {
  if (visitThisLoad !== null) return visitThisLoad;
  let visits = 1;
  try {
    visits = (Number(localStorage.getItem(`${VISITS_KEY}:${userId}`)) || 0) + 1;
    localStorage.setItem(`${VISITS_KEY}:${userId}`, String(visits));
  } catch {
    // ignore
  }
  visitThisLoad = visits;
  return visits;
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id ?? null;
  const { data, error } = await supabase
    .from("app_settings")
    .select("reminder_time,reminder_prompt_dismissed")
    .maybeSingle();
  if (error) throw error;
  set({
    time: data?.reminder_time ?? null,
    promptDismissed: !!data?.reminder_prompt_dismissed || localDismissed(userId),
    loaded: true,
    userId,
  });
  return state;
}

export async function saveReminderTime(time: string | null): Promise<void> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { error } = await supabase.from("app_settings").upsert(
    {
      reminder_time: time,
      reminder_timezone: timeZone,
      // A new time starts fresh, so today's reminder can still go out.
      reminder_sent_on: null,
      reminder_missed_sent_on: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  set({ time });
}

export async function dismissReminderPrompt(): Promise<void> {
  try {
    if (state.userId) localStorage.setItem(`${DISMISSED_KEY}:${state.userId}`, "1");
  } catch {
    // ignore
  }
  set({ promptDismissed: true });
  const { error } = await supabase
    .from("app_settings")
    .upsert({ reminder_prompt_dismissed: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("Couldn't save reminder prompt choice:", error.message);
}

export type PushSetup =
  | { status: "enabled"; subscription: PushSubscriptionJSON }
  | { status: "unsupported" | "ios-install" | "open-in-new-tab" | "denied" | "failed" };

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// True when this browser already has a working notification setup, or can't get one by
// pressing Save again (so Save may show as done). False means Save should stay available.
export async function thisDeviceIsSetUp(): Promise<boolean> {
  try {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return true;
    if (window.top !== window.self || Notification.permission !== "granted") return true;
    const registration = await navigator.serviceWorker.getRegistration("/");
    return Boolean(await registration?.pushManager.getSubscription());
  } catch {
    return true;
  }
}

export function deviceReminderPromptDismissed(userId: string | null): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${DEVICE_DISMISSED_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

export function dismissDeviceReminderPrompt(userId: string | null): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${DEVICE_DISMISSED_KEY}:${userId}`, "1");
  } catch {
    // ignore
  }
}

export function isEmbedded(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

export function pushSupported(): boolean {
  return typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export type DeviceStatus = "active" | "off" | "denied" | "unsupported" | "ios-install" | "embedded";

// Whether this device will receive the account's reminders.
export async function deviceNotificationStatus(): Promise<DeviceStatus> {
  try {
    if (!pushSupported()) return isIOS() ? "ios-install" : "unsupported";
    if (isEmbedded()) return "embedded";
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission !== "granted") return "off";
    const registration = await navigator.serviceWorker.getRegistration("/");
    return (await registration?.pushManager.getSubscription()) ? "active" : "off";
  } catch {
    return "unsupported";
  }
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

// Call from a click: browsers only show the permission prompt after a user action.
export async function enablePushOnThisDevice(): Promise<PushSetup> {
  const supported = typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  if (!supported) return { status: isIOS() ? "ios-install" : "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  try {
    const registration = await navigator.serviceWorker.register("/push-sw.js");
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
    }));
    return { status: "enabled", subscription: subscription.toJSON() };
  } catch (error) {
    console.error("Push setup failed:", error);
    return { status: "failed" };
  }
}

export function formatReminderTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

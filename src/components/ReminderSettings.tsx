import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Check, AlertCircle, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useReminderSettings } from "@/lib/useReminderSettings";
import { deviceNotificationStatus, dismissReminderPrompt, enablePushOnThisDevice, formatReminderTime, saveReminderTime, thisDeviceIsSetUp } from "@/lib/reminders";
import type { DeviceStatus, PushSetup } from "@/lib/reminders";
import { savePushSubscription, sendTestReminder } from "@/lib/reminders.functions";
import { FOLLOW_UP_MINUTES } from "@/lib/reminder-schedule";

type Note = { tone: "ok" | "warn"; text: string } | null;

const PUSH_NOTES: Record<Exclude<PushSetup["status"], "enabled">, string> = {
  "open-in-new-tab": "Time saved. To allow notifications, open Kokoro in its own browser tab and press Save there once.",
  "ios-install": "Time saved. On iPhone or iPad, add Kokoro to your Home Screen first (Share → Add to Home Screen), open it from there and press Save once.",
  denied: "Time saved, but notifications are blocked. Allow them for this site in your browser settings, then press Save again.",
  unsupported: "Time saved, but this browser can't show notifications.",
  failed: "Time saved, but this device couldn't be set up for notifications. Please press Save again.",
};

const DEVICE_NOTES: Record<Exclude<PushSetup["status"], "enabled">, string> = {
  "open-in-new-tab": "Open Kokoro in its own browser tab to turn on notifications here.",
  "ios-install": "On iPhone or iPad, add Kokoro to your Home Screen first (Share → Add to Home Screen), then turn it on from there.",
  denied: "Notifications are blocked on this device. Allow them for this site in your browser settings.",
  unsupported: "This browser can't show notifications.",
  failed: "This device couldn't be set up right now. Please try again.",
};

export default function ReminderSettings() {
  const settings = useReminderSettings();
  const savePush = useServerFn(savePushSubscription);
  const sendTest = useServerFn(sendTestReminder);
  const [time, setTime] = useState(settings.time ?? "21:00");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  // False when pressing Save again could still fix notifications on this device.
  const [deviceOk, setDeviceOk] = useState(true);
  // Whether this particular device gets the account's reminders.
  const [device, setDevice] = useState<DeviceStatus | null>(null);

  function refreshDevice() {
    void deviceNotificationStatus().then(setDevice);
  }

  useEffect(() => {
    let alive = true;
    void thisDeviceIsSetUp().then((ok) => { if (alive) setDeviceOk(ok); });
    void deviceNotificationStatus().then((s) => { if (alive) setDevice(s); });
    return () => { alive = false; };
  }, []);

  async function enableHere() {
    setBusy(true);
    setNote(null);
    const push = await enablePushOnThisDevice();
    try {
      const keys = push.status === "enabled" ? push.subscription.keys : undefined;
      if (push.status === "enabled" && push.subscription.endpoint && keys?.["p256dh"] && keys["auth"]) {
        await savePush({ data: { endpoint: push.subscription.endpoint, keys: { p256dh: keys["p256dh"], auth: keys["auth"] } } });
        setDeviceOk(true);
        setNote({ tone: "ok", text: "Notifications are on for this device 🌸" });
      } else {
        const status = push.status === "enabled" ? "failed" : push.status;
        setNote({ tone: "warn", text: DEVICE_NOTES[status] });
      }
    } catch (e) {
      console.error(e);
      setNote({ tone: "warn", text: DEVICE_NOTES.failed });
    } finally {
      setBusy(false);
      refreshDevice();
    }
  }

  useEffect(() => {
    if (settings.time) setTime(settings.time);
  }, [settings.time]);

  async function save() {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setNote({ tone: "warn", text: "Pick a time first." });
      return;
    }
    setBusy(true);
    setNote(null);
    // Ask for permission first, while the tap still counts as the user's action.
    const push = await enablePushOnThisDevice();
    try {
      await saveReminderTime(time);
      const keys = push.status === "enabled" ? push.subscription.keys : undefined;
      if (push.status === "enabled" && push.subscription.endpoint && keys?.["p256dh"] && keys["auth"]) {
        await savePush({ data: { endpoint: push.subscription.endpoint, keys: { p256dh: keys["p256dh"], auth: keys["auth"] } } });
        setDeviceOk(true);
        setNote({ tone: "ok", text: `Reminder set for ${formatReminderTime(time)} every day 🌸` });
        refreshDevice();
      } else {
        const status = push.status === "enabled" ? "failed" : push.status;
        setDeviceOk(status !== "denied" && status !== "failed");
        setNote({ tone: "warn", text: PUSH_NOTES[status] });
      }
    } catch (e) {
      console.error(e);
      setNote({ tone: "warn", text: "Couldn't save your reminder. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setNote(null);
    try {
      await saveReminderTime(null);
      // Turning reminders off is a deliberate choice: never invite again for this account.
      await dismissReminderPrompt();
      setNote({ tone: "ok", text: "Daily reminder turned off." });
    } catch {
      setNote({ tone: "warn", text: "Couldn't turn it off. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setNote(null);
    try {
      const { sent } = await sendTest();
      setNote(sent
        ? { tone: "ok", text: "Test sent, it should pop up in a moment." }
        : { tone: "warn", text: "No device is set up yet. Press Save in a browser that allows notifications." });
    } catch {
      setNote({ tone: "warn", text: "Couldn't send a test right now." });
    } finally {
      setBusy(false);
    }
  }

  // Stays "Saved" (and not clickable) until the time is changed.
  const saved = Boolean(settings.time) && time === settings.time && deviceOk;

  return (
    <div id="daily-reminder" className="rounded-2xl bg-sakura-50/70 border border-sakura-100 p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center w-9 h-9 rounded-2xl bg-sakura-100 text-sakura-500 shrink-0">
          {settings.time ? <Bell size={16} /> : <BellOff size={16} />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-charcoal">Daily reminder</p>
          <p className="text-xs text-charcoal/50">
            {settings.time ? `Every day at ${formatReminderTime(settings.time)}` : "Not set yet"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-charcoal/65 leading-relaxed">
        A gentle nudge at your writing time, and one more {FOLLOW_UP_MINUTES} minutes later if you
        haven't written yet.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Reminder time"
          className="rounded-full border border-sakura-200 bg-white px-3.5 py-1.5 text-sm text-charcoal outline-none focus:ring-2 focus:ring-sakura-200 transition-shadow"
        />
        <button
          onClick={save}
          disabled={busy || saved}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-br from-sakura-400 to-sakura-500 text-white px-4 py-2 text-sm font-semibold shadow-soft enabled:hover:from-sakura-500 enabled:hover:to-sakura-600 transition-all disabled:opacity-60 disabled:cursor-default"
        >
          {saved ? <Check size={14} /> : <Bell size={14} />}
          {busy ? "Saving…" : saved ? "Saved" : settings.time ? "Save" : "Set reminder"}
        </button>
      </div>

      {settings.time && device && device !== "unsupported" && (
        <div className="mt-2.5">
          {device === "active" ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-sage-600">
              <Check size={13} className="shrink-0" />
              Notifications active on this device
            </p>
          ) : device === "off" ? (
            <button
              onClick={enableHere}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full border border-sakura-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-sakura-600 hover:bg-sakura-100 transition-colors disabled:opacity-60"
            >
              <BellRing size={13} />
              Enable notifications on this device
            </button>
          ) : (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-charcoal/60">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-sakura-400" />
              {device === "denied" ? DEVICE_NOTES.denied : device === "embedded" ? DEVICE_NOTES["open-in-new-tab"] : DEVICE_NOTES["ios-install"]}
            </p>
          )}
        </div>
      )}

      {settings.time && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button
            onClick={test}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-sakura-600 hover:bg-sakura-100 transition-colors disabled:opacity-60"
          >
            <Send size={12} />
            Send a test
          </button>
          <button
            onClick={turnOff}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-charcoal/45 hover:text-sakura-600 hover:bg-sakura-100 transition-colors disabled:opacity-60"
          >
            <BellOff size={12} />
            Turn off
          </button>
        </div>
      )}

      {note && (
        <p role="status" className={`mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed animate-fadeIn ${note.tone === "ok" ? "text-sage-600" : "text-charcoal/65"}`}>
          {note.tone === "ok"
            ? <Check size={13} className="mt-0.5 shrink-0" />
            : <AlertCircle size={13} className="mt-0.5 shrink-0 text-sakura-400" />}
          {note.text}
        </p>
      )}
    </div>
  );
}

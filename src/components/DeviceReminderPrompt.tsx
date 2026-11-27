import { useState } from "react";
import { BellRing, Check, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { SakuraBlossom, Leaf } from "./Decor";
import { enablePushOnThisDevice, formatReminderTime } from "@/lib/reminders";
import { savePushSubscription } from "@/lib/reminders.functions";

// Shown on a device that hasn't allowed notifications yet, when the account already has a
// reminder time set elsewhere. Same look as the "Set a reminder!" pop-up.
export default function DeviceReminderPrompt({
  time,
  onDone,
}: {
  time: string;
  onDone: (dontAskAgain: boolean) => void;
}) {
  const savePush = useServerFn(savePushSubscription);
  const [dontAsk, setDontAsk] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");

  async function enable() {
    setState("busy");
    const push = await enablePushOnThisDevice();
    const keys = push.status === "enabled" ? push.subscription.keys : undefined;
    if (push.status === "enabled" && push.subscription.endpoint && keys?.["p256dh"] && keys["auth"]) {
      try {
        await savePush({ data: { endpoint: push.subscription.endpoint, keys: { p256dh: keys["p256dh"], auth: keys["auth"] } } });
        setState("done");
        window.setTimeout(() => onDone(false), 1300);
        return;
      } catch (e) {
        console.error(e);
      }
    }
    // Blocked in the browser: it won't ask here again anyway.
    if (push.status === "denied") {
      onDone(dontAsk);
      return;
    }
    setState("failed");
  }

  const close = () => onDone(dontAsk);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm animate-fadeIn" onClick={close} />
      <div
        role="dialog"
        aria-label="Turn on reminders for this device"
        className="relative w-full max-w-[320px] rounded-3xl bg-white border-2 border-sakura-100 shadow-paper px-6 pt-7 pb-6 text-center animate-slideUp"
      >
        <SakuraBlossom size={24} className="absolute top-3 left-3 text-sakura-200" />
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full bg-sakura-50 text-charcoal/50 hover:bg-sakura-100 hover:text-sakura-600 transition-colors"
        >
          <X size={16} />
        </button>
        <Leaf size={16} className="absolute bottom-3 left-3 text-sage-200" />
        <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-sakura-100 text-sakura-500">
          <BellRing size={20} />
        </span>
        <p className="mt-3 text-lg font-semibold text-charcoal">Reminders are set for {formatReminderTime(time)}</p>
        <p className="mt-1.5 text-sm text-charcoal/60 leading-relaxed">
          Turn on notifications for this device so you never miss your daily reflection.
        </p>
        {state === "done" ? (
          <p role="status" className="mt-5 flex items-center justify-center gap-1.5 rounded-full bg-sage-100 text-sage-600 px-4 py-2.5 text-sm font-semibold animate-fadeIn">
            <Check size={15} />
            Enabled
          </p>
        ) : (
          <button
            onClick={enable}
            disabled={state === "busy"}
            autoFocus
            className="mt-5 w-full rounded-full bg-gradient-to-br from-sakura-400 to-sakura-500 text-white px-4 py-2.5 text-sm font-semibold shadow-soft hover:from-sakura-500 hover:to-sakura-600 transition-all disabled:opacity-60"
          >
            {state === "busy" ? "Turning on…" : "Enable"}
          </button>
        )}
        {state === "failed" && (
          <p role="status" className="mt-2.5 text-xs text-charcoal/60 leading-relaxed animate-fadeIn">
            This device couldn't be set up right now. You can try again here or in Settings.
          </p>
        )}
        {state !== "done" && (
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-charcoal/55 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontAsk}
              onChange={(e) => setDontAsk(e.target.checked)}
              className="w-3.5 h-3.5 accent-sakura-500 cursor-pointer"
            />
            Don't ask again on this device
          </label>
        )}
      </div>
    </div>
  );
}

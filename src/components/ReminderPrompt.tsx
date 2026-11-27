import { useState } from "react";
import { Bell, X } from "lucide-react";
import { SakuraBlossom, Leaf } from "./Decor";

export default function ReminderPrompt({ onDone }: { onDone: (dontShowAgain: boolean, openSettings: boolean) => void }) {
  const [dontShow, setDontShow] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm animate-fadeIn" onClick={() => onDone(dontShow, false)} />
      <div
        role="dialog"
        aria-label="Set a reminder"
        className="relative w-full max-w-[320px] rounded-3xl bg-white border-2 border-sakura-100 shadow-paper px-6 pt-7 pb-6 text-center animate-slideUp"
      >
        <SakuraBlossom size={24} className="absolute top-3 left-3 text-sakura-200" />
        <button
          onClick={() => onDone(dontShow, false)}
          aria-label="Close"
          className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full bg-sakura-50 text-charcoal/50 hover:bg-sakura-100 hover:text-sakura-600 transition-colors"
        >
          <X size={16} />
        </button>
        <Leaf size={16} className="absolute bottom-3 left-3 text-sage-200" />
        <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-sakura-100 text-sakura-500">
          <Bell size={20} />
        </span>
        <p className="mt-3 text-lg font-semibold text-charcoal">Set a reminder!</p>
        <p className="mt-1.5 text-sm text-charcoal/60 leading-relaxed">
          Pick a time in Settings and Kokoro will gently remind you to write every day.
        </p>
        <button
          onClick={() => onDone(dontShow, true)}
          autoFocus
          className="mt-5 w-full rounded-full bg-gradient-to-br from-sakura-400 to-sakura-500 text-white px-4 py-2.5 text-sm font-semibold shadow-soft hover:from-sakura-500 hover:to-sakura-600 transition-all"
        >
          Okay
        </button>
        <label className="mt-3 inline-flex items-center gap-2 text-xs text-charcoal/55 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            className="w-3.5 h-3.5 accent-sakura-500 cursor-pointer"
          />
          Don't show this again
        </label>
      </div>
    </div>
  );
}

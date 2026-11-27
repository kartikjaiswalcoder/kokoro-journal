import { X } from "lucide-react";
import ProfileCard from "./ProfileCard";
import ReminderSettings from "./ReminderSettings";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-paper border-2 border-sakura-100 p-6 animate-slideUp max-h-[calc(100dvh-2rem)] overflow-y-auto scrollbar-soft">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-charcoal">Settings</h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="grid place-items-center w-8 h-8 rounded-full bg-sakura-50 text-charcoal/50 hover:bg-sakura-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          <ProfileCard />
          <ReminderSettings />
          <div className="rounded-2xl bg-sakura-50/70 border border-sakura-100 p-4">
            <p className="text-charcoal/65 leading-relaxed">
              <span className="font-semibold text-sakura-600">AI Summary</span> uses a server-side
              connection — your journal still works perfectly without it.
            </p>
          </div>

          <p className="text-xs text-charcoal/40 text-center pt-1">
            Kokoro · 心 — A little space to meet yourself.
          </p>
        </div>
      </div>
    </div>
  );
}

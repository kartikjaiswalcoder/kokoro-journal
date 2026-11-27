import { X, Sparkles, Share2, AlertCircle, RotateCw, Check } from "lucide-react";
import { SakuraBlossom } from "./Decor";

export type AIState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; summary: string }
  | { kind: "error"; message: string };

export default function AISummaryPopup({
  ai,
  stale,
  toast,
  onClose,
  onRetry,
  onShare,
}: {
  ai: AIState;
  stale: boolean;
  toast: string | null;
  onClose: () => void;
  onRetry: () => void;
  onShare: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-3xl bg-white border-2 border-sakura-100 shadow-paper px-6 py-6 animate-slideUp">
        <SakuraBlossom size={28} className="absolute top-3 right-12 text-sakura-200" />
        <button
          onClick={onClose}
          aria-label="Close summary"
          className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full bg-sakura-50 text-charcoal/50 hover:bg-sakura-100 hover:text-sakura-600 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-9 h-9 rounded-2xl bg-sakura-100 text-sakura-500">
            <Sparkles size={16} />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-sakura-400 font-semibold">
              Day summary
            </p>
            {stale && ai.kind === "success" && (
              <p className="text-[11px] text-charcoal/40">Outdated, your entry has changed</p>
            )}
          </div>
        </div>

        <div className="mt-4 min-h-[72px]">
          {ai.kind === "loading" && (
            <div className="flex items-center gap-2 text-sm text-sakura-600">
              <Sparkles size={15} className="animate-pulse" />
              Gathering the highlights…
            </div>
          )}
          {ai.kind === "success" && (
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-charcoal/85">{ai.summary}</p>
          )}
          {ai.kind === "error" && (
            <div className="flex items-start gap-2 text-sm text-charcoal/70">
              <AlertCircle size={15} className="text-sakura-400 mt-0.5 shrink-0" />
              <p className="leading-relaxed">{ai.message}</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {ai.kind === "success" && !stale && (
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 rounded-full bg-white border border-sakura-200 text-sakura-600 px-4 py-2 text-sm font-semibold hover:bg-sakura-50 transition-colors"
            >
              <Share2 size={14} />
              Share
            </button>
          )}
          {(ai.kind === "success" || ai.kind === "error") && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-sakura-600 hover:bg-sakura-50 transition-colors"
            >
              <RotateCw size={14} />
              {ai.kind === "error" ? "Try again" : "Regenerate"}
            </button>
          )}
        </div>

        {toast && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap rounded-full bg-charcoal/85 text-white px-4 py-2.5 text-sm font-medium shadow-paper animate-toastIn">
            <Check size={15} className="text-sakura-300" />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

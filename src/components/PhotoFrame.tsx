import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, Loader2, Minus, Plus, X } from "lucide-react";
import type { Mood } from "@/types";
import { usePhotoUrls } from "@/lib/photos";
import { showAddSlot } from "@/lib/photo-rules";

function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const startX = useRef<number | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => {
      startX.current = e.touches[0]?.clientX ?? null;
    },
    onTouchEnd: (e: TouchEvent) => {
      const start = startX.current;
      const end = e.changedTouches[0]?.clientX;
      startX.current = null;
      if (start == null || end == null) return;
      const dx = end - start;
      if (Math.abs(dx) > 40) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

// Centered keepsake frame over the screen. Pass onRemove/onAdd only in the notepad;
// All Entries and Reflections open it read-only. `mood` themes the frame when it opens on its
// own; inside the notepad it follows the notepad's mood instead.
export default function PhotoFrame({
  paths,
  label,
  onClose,
  onRemove,
  onAdd,
  adding = false,
  mood,
}: {
  paths: string[];
  label: string;
  onClose: () => void;
  onRemove?: (path: string) => void;
  onAdd?: () => void;
  adding?: boolean;
  mood?: Mood;
}) {
  const urls = usePhotoUrls(paths);
  const count = paths.length;
  const many = count > 1;
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count === 0) onClose();
    else if (count > prevCount.current) setIndex(count - 1);
    else setIndex((i) => Math.min(i, count - 1));
    prevCount.current = count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // No looping: the first and last photos are the ends.
  const go = (d: number) => setIndex((i) => Math.min(count - 1, Math.max(0, i + d)));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "escape") {
        e.preventDefault();
        if (full) setFull(false);
        else onClose();
      } else if (key === "arrowleft" || key === "a") {
        e.preventDefault();
        go(-1);
      } else if (key === "arrowright" || key === "d") {
        e.preventDefault();
        go(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, onClose, count]);

  const swipe = useSwipe(go);
  const path = paths[index];
  const url = urls[index];
  const atStart = index <= 0;
  const atEnd = index >= count - 1;
  const arrow =
    "grid place-items-center shrink-0 w-9 h-9 rounded-full bg-sakura-100 border border-sakura-200 text-sakura-500 shadow-soft hover:bg-sakura-200 hover:border-sakura-300 hover:text-sakura-600 transition-colors disabled:opacity-35 disabled:pointer-events-none";

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${mood ? "mood-scope" : ""}`}
      data-mood-theme={mood}
      role="dialog"
      aria-modal="true"
      aria-label="Photo keepsake"
    >
      <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm animate-fadeIn" onClick={onClose} />


      <div className="relative w-full max-w-[480px] flex items-center justify-center gap-2 sm:gap-3 animate-slideUp">
        {/* Arrow slots always keep their space so adding/removing a photo never shifts the frame. */}
        {many ? (
          <button onClick={() => go(-1)} disabled={atStart} aria-label="Previous photo" className={arrow}>
            <ChevronLeft size={18} />
          </button>
        ) : (
          <span aria-hidden className="shrink-0 w-9 h-9" />
        )}

        <div className="relative flex-1 min-w-0 max-w-[400px]">
          {/* Back floats just above the frame's top-left: about twice as far up as it is out to the left. */}
          <button
            onClick={onClose}
            autoFocus
            aria-label="Go back"
            title="Go back"
            className="absolute -top-14 -left-3.5 sm:-top-16 sm:-left-4 z-10 grid place-items-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sakura-50/75 border border-sakura-100/80 text-sakura-500 shadow-none hover:bg-sakura-100 hover:border-sakura-200 hover:text-sakura-600 transition-colors animate-fadeIn"
          >
            <ArrowLeft size={17} className="sm:w-[19px] sm:h-[19px]" />
          </button>
          <figure className="relative m-0 rounded-3xl bg-sakura-100 border-2 border-sakura-200 shadow-paper p-2.5">
            {onRemove && path && (
              <button
                onClick={() => onRemove(path)}
                aria-label="Remove this photo"
                title="Remove this photo"
                className="absolute -top-2 -right-2 z-10 grid place-items-center w-6 h-6 rounded-full bg-rose-200 text-rose-700 shadow-soft hover:bg-rose-300 transition-colors"
              >
                <Minus size={14} strokeWidth={2.75} />
              </button>
            )}

            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-sakura-50" {...swipe}>
              {url ? (
                <button onClick={() => setFull(true)} aria-label="View photo full screen" className="block w-full h-full cursor-zoom-in">
                  <img key={url} src={url} alt={`Photo from ${label}`} draggable={false} className="w-full h-full object-cover select-none animate-fadeIn" />
                </button>
              ) : (
                <div className="grid place-items-center w-full h-full">
                  <Loader2 size={22} className="animate-spin text-sakura-300" />
                </div>
              )}
            </div>
          </figure>

          {/* Kept out of the layout so one photo sits at the same height as two. */}
          {(many || (onAdd && showAddSlot(count, true))) && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 flex items-center justify-center">
              {many ? (
                <span className="flex items-center gap-1.5" aria-label={`Photo ${index + 1} of ${count}`}>
                  {paths.map((p, i) => (
                    <span key={p} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-4 bg-sakura-400" : "w-1.5 bg-sakura-200"}`} />
                  ))}
                </span>
              ) : (
                <button
                  onClick={onAdd}
                  disabled={adding}
                  aria-label="Add a second photo"
                  title="Add a second photo"
                  className="grid place-items-center w-11 h-11 rounded-full bg-sakura-50/70 border border-dashed border-sakura-200 text-sakura-500 shadow-none hover:bg-sakura-100 hover:border-sakura-300 hover:text-sakura-600 transition-colors disabled:opacity-70"
                >
                  {adding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                </button>
              )}
            </div>
          )}
        </div>

        {many ? (
          <button onClick={() => go(1)} disabled={atEnd} aria-label="Next photo" className={arrow}>
            <ChevronRight size={18} />
          </button>
        ) : (
          <span aria-hidden className="shrink-0 w-9 h-9" />
        )}
      </div>

      {full && url && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-charcoal/90 animate-fadeIn cursor-zoom-out" onClick={() => setFull(false)} {...swipe}>
          <img src={url} alt={`Photo from ${label}`} draggable={false} className="max-h-[92vh] max-w-[94vw] object-contain rounded-xl shadow-paper select-none" />
          <button
            onClick={() => setFull(false)}
            aria-label="Close full view"
            className="absolute top-4 right-4 grid place-items-center w-9 h-9 rounded-full bg-ivory-50/15 text-ivory-50 hover:bg-ivory-50/25 transition-colors"
          >
            <X size={18} />
          </button>
          {many && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                disabled={atStart}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-ivory-50/15 text-ivory-50 hover:bg-ivory-50/25 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); go(1); }}
                disabled={atEnd}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-ivory-50/15 text-ivory-50 hover:bg-ivory-50/25 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Small round photo used in the notepad bubble and on All Entries / Reflections rows.
export function PhotoThumb({
  paths,
  onClick,
  size = 38,
  busy = false,
  label = "Open photos",
}: {
  paths: string[];
  onClick: () => void;
  size?: number;
  busy?: boolean;
  label?: string;
}) {
  const [url] = usePhotoUrls(paths.slice(0, 1));
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="group/thumb relative shrink-0 rounded-full"
      style={{ width: size, height: size }}
    >
      <span className="block w-full h-full overflow-hidden rounded-full bg-sakura-50 ring-2 ring-sakura-200 group-hover/thumb:ring-sakura-500 shadow-soft transition-all">
        {url ? (
          <img src={url} alt="" draggable={false} className="w-full h-full object-cover" />
        ) : (
          <span className="grid place-items-center w-full h-full text-sakura-300">
            <Camera size={14} />
          </span>
        )}
      </span>
      {busy && (
        <span className="absolute inset-0 grid place-items-center rounded-full bg-background/60">
          <Loader2 size={14} className="animate-spin text-sakura-500" />
        </span>
      )}
      {paths.length > 1 && (
        <span className="absolute -top-1 -right-1 grid place-items-center min-w-4 h-4 px-1 rounded-full bg-sakura-500 text-[9px] font-bold leading-none text-ivory-50 ring-2 ring-background">
          {paths.length}
        </span>
      )}
    </button>
  );
}

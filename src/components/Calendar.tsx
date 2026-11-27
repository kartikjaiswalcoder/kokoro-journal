import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import {
  buildMonthGrid,
  WEEKDAYS,
  MONTH_NAMES,
  parseDateKey,
  todayKey,
  addDays,
} from "@/lib/dates";
import { getEntryDates, getEntry } from "@/lib/store";
import { useStore } from "@/lib/useStore";
import { MOOD_THEME } from "@/types";
import type { Mood } from "@/types";

export default function Calendar({
  year,
  month0,
  selectedKey,
  onPrev,
  onNext,
  onToday,
  onSelect,
  onOpen,
  keyboardEnabled = true,
}: {
  year: number;
  month0: number;
  selectedKey: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (key: string) => void;
  onOpen: (key: string) => void;
  keyboardEnabled?: boolean;
}) {
  useStore(); // re-render on store changes
  const cells = useMemo(() => buildMonthGrid(year, month0), [year, month0]);
  const entryDates = getEntryDates();
  const today = todayKey();
  const [showSel, setShowSel] = useState(true);

  // Hide the selection outline when clicking anywhere that isn't a date tile.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest?.("[data-day-tile]")) setShowSel(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (event.altKey || event.ctrlKey || event.metaKey ||
        target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='dialog'], [aria-modal='true']")) return;
      // Enter opens the selected date's notepad (same as double-clicking it),
      // but only while the selector is visibly on a date.
      if (event.key === "Enter") {
        if (!showSel || !selectedKey) return;
        event.preventDefault();
        onOpen(selectedKey);
        return;
      }
      const offsets: Record<string, number> = {
        ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1,
        ArrowUp: -7, w: -7, ArrowDown: 7, s: 7,
      };
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const offset = offsets[key];
      if (offset === undefined) return;
      event.preventDefault();
      // The first press only spawns the selector — on today (if the open
      // month is the current one) or the month's first day — without moving.
      // With a visible selection in this month, keys move it from its date.
      const selectedDate = parseDateKey(selectedKey);
      const spawning = !(showSel &&
        selectedDate.getFullYear() === year && selectedDate.getMonth() === month0);
      const base = spawning
        ? (cells.includes(today) ? today : cells.find((cell) => cell !== null))
        : selectedKey;
      if (!base) return;
      setShowSel(true);
      if (spawning) {
        onSelect(base);
        return;
      }
      const nextKey = addDays(base, offset);
      const nextDate = parseDateKey(nextKey);
      // Keys never switch months: an edge move stays on the same date.
      const inOpenMonth = nextDate.getFullYear() === year && nextDate.getMonth() === month0;
      onSelect(inOpenMonth ? nextKey : base);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [keyboardEnabled, showSel, selectedKey, year, month0, cells, today, onSelect, onOpen]);

  return (
    <section className="rounded-3xl bg-ivory-50/80 backdrop-blur-sm border border-sakura-100 shadow-soft p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-charcoal">
            {MONTH_NAMES[month0]} <span className="text-charcoal/40 font-medium">{year}</span>
          </h2>
          <p className="text-xs text-charcoal/50 mt-0.5 whitespace-nowrap">A map of your days</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setShowSel(true);
              onToday();
            }}
            className="flex items-center gap-1.5 rounded-full bg-sakura-100 text-sakura-700 px-3 py-1.5 text-xs font-semibold hover:bg-sakura-200 transition-colors"
          >
            <CalendarCheck size={14} />
            Today
          </button>
          <button
            onClick={onPrev}
            aria-label="Previous month"
            className="grid place-items-center w-8 h-8 rounded-full bg-white/70 border border-sakura-100 text-charcoal/60 hover:bg-sakura-50 hover:text-sakura-600 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNext}
            aria-label="Next month"
            className="grid place-items-center w-8 h-8 rounded-full bg-white/70 border border-sakura-100 text-charcoal/60 hover:bg-sakura-50 hover:text-sakura-600 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-charcoal/40 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day tiles */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {cells.map((key, i) => {
          if (!key) {
            return <div key={i} className="aspect-square sm:aspect-[5/4] rounded-2xl bg-transparent" />;
          }
          const date = parseDateKey(key);
          const dayNum = date.getDate();
          const isToday = key === today;
          const isSelected = showSel && key === selectedKey;
          const hasEntry = entryDates.has(key);
          const entry = getEntry(key);
          const mood = (entry?.mood ?? null) as Mood | null;
          const inMonth = date.getMonth() === month0;
          const theme = mood ? MOOD_THEME[mood] : null;

          // Tile background: mood-tinted when a mood is set, else default entry treatment.
          let tileBg: string;
          if (isSelected) {
            tileBg = theme
              ? `${theme.tintBg} ${theme.accentText} border-sakura-400`
              : "border-sakura-400 bg-white/50";
          } else if (hasEntry && theme) {
            tileBg = `${theme.tintBg} border-transparent hover:brightness-97`;
          } else if (isToday) {
            tileBg = "border-charcoal/15 bg-white/50";
          } else if (hasEntry) {
            tileBg = "border-transparent bg-white/50 hover:bg-sakura-50/50";
          } else if (inMonth) {
            tileBg = "border-transparent bg-white/50 hover:bg-sakura-50/50";
          } else {
            tileBg = "border-transparent bg-transparent text-charcoal/30";
          }

          return (
            <button
              key={key}
              data-day-tile
              aria-label={key}
              aria-pressed={isSelected}
              onClick={() => {
                setShowSel(true);
                onSelect(key);
              }}
              onDoubleClick={() => onOpen(key)}
              className={`group relative aspect-square sm:aspect-[5/4] rounded-2xl border transition-all p-2 flex flex-col items-center justify-center ${tileBg} shadow-tile`}
            >
              <span className="flex flex-col items-center justify-center">
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? "text-charcoal/70"
                      : inMonth
                        ? hasEntry
                          ? (theme ? theme.accentText : "text-charcoal/70")
                          : "text-charcoal/70"
                        : "text-charcoal/30"
                  }`}
                >
                  {dayNum}
                </span>

                {isToday && (
                  <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-charcoal/40 leading-none text-center">
                    today
                  </span>
                )}
              </span>

              {isSelected && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sakura-400" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

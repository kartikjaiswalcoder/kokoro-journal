import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ENTRY_SORT_OPTIONS, type EntrySort } from "@/lib/entry-sort";
import { MOODS, type Mood } from "@/types";

const TRIGGER =
  "h-8 w-auto gap-1.5 rounded-full border border-sakura-200 bg-sakura-50/80 px-3 text-xs font-medium text-sakura-700 shadow-soft transition-colors hover:bg-sakura-100/70 focus:outline-none focus:ring-2 focus:ring-sakura-200 focus:ring-offset-0 inline-flex items-center";

const ITEM = "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-sakura-50 hover:text-sakura-600";
const ON = "bg-sakura-50/70 text-sakura-700 font-medium";
const OFF = "text-charcoal/75";
const HEADING = "px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sakura-600/60";

type Props = {
  value: EntrySort;
  onChange: (value: EntrySort) => void;
  moods: Mood[];
  onMoodsChange: (moods: Mood[]) => void;
};

// One "Sort & Filter" menu: sort order (single choice) + mood filter (multi-select).
export default function EntrySortSelect({ value, onChange, moods, onMoodsChange }: Props) {
  const toggle = (m: Mood) => onMoodsChange(moods.includes(m) ? moods.filter((x) => x !== m) : [...moods, m]);
  const sortLabel = ENTRY_SORT_OPTIONS.find((o) => o.value === value)?.label;
  const filterLabel = moods.length === 0 ? null : moods.length === 1 ? MOODS.find((m) => m.key === moods[0])?.label : `${moods.length} moods`;
  return (
    <div className="-mt-2 mb-4 flex justify-end">
      <Popover>
        <PopoverTrigger aria-label="Sort and filter" className={TRIGGER}>
          <SlidersHorizontal size={13} className="text-sakura-500" />
          <span className="text-sakura-600/60">Sort & Filter</span>
          <span>{sortLabel}</span>
          {filterLabel && (
            <>
              <span className="text-sakura-600/40">·</span>
              <span>{filterLabel}</span>
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-sakura-500" />
            </>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 rounded-2xl border-sakura-100 bg-ivory-50 p-1 shadow-paper">
          <div className={HEADING}>Sort by</div>
          {ENTRY_SORT_OPTIONS.map((o) => {
            const on = o.value === value;
            return (
              <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)} className={`${ITEM} ${on ? ON : OFF}`}>
                <span className="flex-1">{o.label}</span>
                <Check size={13} className={`text-sakura-500 transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
          <div className="my-1 border-t border-sakura-100" />
          <div className={HEADING}>Filter by mood</div>
          <button type="button" onClick={() => onMoodsChange([])} aria-pressed={moods.length === 0} className={`${ITEM} ${moods.length === 0 ? ON : OFF}`}>
            <span className="flex-1">All moods</span>
            <Check size={13} className={`text-sakura-500 transition-opacity ${moods.length === 0 ? "opacity-100" : "opacity-0"}`} />
          </button>
          {MOODS.map((m) => {
            const on = moods.includes(m.key);
            return (
              <button key={m.key} type="button" onClick={() => toggle(m.key)} aria-pressed={on} className={`${ITEM} ${on ? ON : OFF}`}>
                <span>{m.emoji}</span>
                <span className="flex-1">{m.label}</span>
                <Check size={13} className={`text-sakura-500 transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Sort choice is remembered per list (across tabs and reloads); mood filters are not.
export function usePersistedSort(list: "entries" | "reflections") {
  const key = `kokoro:sort:${list}`;
  const [sort, setSortState] = useState<EntrySort>(() => {
    try {
      const v = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return v === "newest" || v === "oldest" || v === "updated" ? v : "newest";
    } catch { return "newest"; }
  });
  const setSort = (v: EntrySort) => {
    setSortState(v);
    try { window.localStorage.setItem(key, v); } catch { /* ignore */ }
  };
  return [sort, setSort] as const;
}

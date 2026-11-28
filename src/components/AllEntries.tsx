import { useMemo, useState } from "react";
import JournalSearch from "./JournalSearch";
import EntrySortSelect from "./EntrySortSelect";
import { sortEntries, loadSort, saveSort, type EntrySort } from "@/lib/entry-sort";
import PhotoFrame, { PhotoThumb } from "./PhotoFrame";
import { matchesJournalSearch } from "@/lib/journal-search";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles } from "lucide-react";
import { SakuraBlossom, Leaf } from "./Decor";
import { getAllEntries, getEntry } from "@/lib/store";
import { useStore } from "@/lib/useStore";
import { formatLongDate, formatShortDate, formatWeekdayShort } from "@/lib/dates";
import { MOOD_MAP } from "@/types";
import type { Mood } from "@/types";

// Soft pastel capsule for each mood.
const MOOD_PILL: Record<Mood, string> = {
  happy: "bg-blossom-100/80 text-blossom-600",
  excited: "bg-orange-100/80 text-orange-700",
  calm: "bg-sage-100/80 text-sage-700",
  okay: "bg-stone-100 text-stone-600",
  sad: "bg-blue-100/80 text-blue-700",
  anxious: "bg-red-100/80 text-red-700",
};

export default function AllEntries({ onOpen }: { onOpen: (key: string) => void }) {
  const version = useStore();
  const [query, setQuery] = useState("");
  const [sort, setSortState] = useState<EntrySort>(() => loadSort("entries"));
  const setSort = (s: EntrySort) => { setSortState(s); saveSort("entries", s); };
  const [moods, setMoods] = useState<Mood[]>([]);
  const [photoDay, setPhotoDay] = useState<string | null>(null);
  const entries = useMemo(
    () =>
      sortEntries(getAllEntries()
        .filter((e) => moods.length === 0 || (e.mood != null && moods.includes(e.mood)))
        .filter((e) => e.content.trim().length > 0 || (e.photos?.length ?? 0) > 0)
        .filter((e) => matchesJournalSearch(e.entry_date, e.content, query, e.mood ? [MOOD_MAP[e.mood].label] : [])), sort),
    [version, query, sort, moods],
  );

  return (
    <section className="max-w-3xl mx-auto px-1">
      <JournalSearch value={query} onChange={setQuery} label="Search entries" />
      <EntrySortSelect value={sort} onChange={setSort} moods={moods} onMoodsChange={setMoods} />
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-charcoal flex items-center gap-2">
          <BookOpen size={22} className="text-sakura-500" />
          All Entries
        </h2>
        <p className="text-sm text-charcoal/50 mt-1">Every little moment you've kept.</p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-sakura-100 bg-ivory-50/70 px-6 py-12 text-center">
          <SakuraBlossom size={40} className="text-sakura-200 mx-auto" />
          <p className="mt-4 text-charcoal/60 font-medium">
            {query.trim() || moods.length ? "No entries found" : "Your story is still unfolding. Whenever you're ready, your first page is here. 🌸"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) => {
            const mood = e.mood ? MOOD_MAP[e.mood] : null;
            const preview =
              e.content.length > 160 ? e.content.slice(0, 160) + "…" : e.content;
            const photos = e.photos ?? [];
            return (
              <div key={e.id} className="relative">
              <Button variant="ghost"
                onClick={() => onOpen(e.entry_date)}
                className="group w-full h-auto whitespace-normal justify-start text-left rounded-2xl bg-background/80 border border-sakura-100 shadow-soft hover:shadow-paper hover:bg-sakura-50 hover:border-sakura-200 transition-all px-5 py-4 flex items-center gap-4"
              >
                <div className="shrink-0 flex flex-col items-center self-center">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-sakura-50 text-sakura-400">
                    <SakuraBlossom size={18} />
                  </span>
                  <span className="mt-1.5 text-[10px] font-semibold text-charcoal/40">
                    {formatWeekdayShort(e.entry_date)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-charcoal">
                      {formatShortDate(e.entry_date)}
                    </span>
                    {mood && e.mood && (
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium flex items-center gap-1 shrink-0 ${MOOD_PILL[e.mood]}`}>
                        <span>{mood.emoji}</span>
                        {mood.label}
                      </span>
                    )}
                    {e.ai_summary && (
                      <span aria-label="Has a reflection" title="Reflection" className="w-5 h-5 rounded-full bg-sakura-50 text-sakura-500 flex items-center justify-center shrink-0">
                        <Sparkles size={11} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-charcoal/70 leading-relaxed line-clamp-2 whitespace-pre-wrap">
                    {preview || <span className="text-charcoal/30">(empty page)</span>}
                  </p>
                </div>
                {photos.length > 0 ? (
                  <span className="w-[38px] shrink-0" aria-hidden />
                ) : (
                  <Leaf size={16} className="self-center text-sage-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Button>
              {photos.length > 0 && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <PhotoThumb paths={photos} onClick={() => setPhotoDay(e.entry_date)} />
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
      {photoDay && (getEntry(photoDay)?.photos?.length ?? 0) > 0 && (
        <PhotoFrame paths={getEntry(photoDay)?.photos ?? []} label={formatLongDate(photoDay)} mood={getEntry(photoDay)?.mood ?? "happy"} onClose={() => setPhotoDay(null)} />
      )}
    </section>
  );
}

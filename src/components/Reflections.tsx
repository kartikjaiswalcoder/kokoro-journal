import { useMemo, useState } from "react";
import JournalSearch from "./JournalSearch";
import EntrySortSelect, { usePersistedSort } from "./EntrySortSelect";
import { sortEntries } from "@/lib/entry-sort";
import PhotoFrame, { PhotoThumb } from "./PhotoFrame";
import { matchesJournalSearch } from "@/lib/journal-search";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { SakuraBlossom } from "./Decor";
import { getAllEntries, getEntry } from "@/lib/store";
import { useStore } from "@/lib/useStore";
import { formatLongDate, formatReflectionDate } from "@/lib/dates";
import { MOOD_MAP } from "@/types";
import type { Mood } from "@/types";

export default function Reflections({ onOpen }: { onOpen: (key: string) => void }) {
  const version = useStore();
  const [query, setQuery] = useState("");
  const [sort, setSort] = usePersistedSort("reflections");
  const [moods, setMoods] = useState<Mood[]>([]);
  const [photoDay, setPhotoDay] = useState<string | null>(null);
  const entries = useMemo(
    () =>
      sortEntries(getAllEntries()
        .filter((e) => moods.length === 0 || (e.mood != null && moods.includes(e.mood)))
         .filter((e) => e.ai_summary && e.ai_summary.trim().length > 0)
        .filter((e) => matchesJournalSearch(e.entry_date, e.ai_summary ?? "", query, e.mood ? [MOOD_MAP[e.mood].label] : [])), sort),
    [version, query, sort, moods],
  );

  return (
    <section className="max-w-3xl mx-auto px-1">
      <JournalSearch value={query} onChange={setQuery} label="Search reflections" />
      <EntrySortSelect value={sort} onChange={setSort} moods={moods} onMoodsChange={setMoods} />
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-charcoal flex items-center gap-2">
          <Sparkles size={22} className="text-sakura-500" />
          Reflections
        </h2>
        <p className="text-sm text-charcoal/50 mt-1">
          The gentle summaries you've kept.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-sakura-100 bg-ivory-50/70 px-6 py-12 text-center">
          <SakuraBlossom size={40} className="text-sakura-200 mx-auto" />
          <p className="mt-4 text-charcoal/60 font-medium">
            {query.trim() || moods.length ? "No reflections found" : (
              <>
                No reflections yet. Open a day, write a little, and tap{" "}
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-sakura-500">
                  <Sparkles size={14} className="inline" aria-hidden />
                  AI Summary
                </span>{" "}
                when you're ready. 🌱
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) => {
            const photos = e.photos ?? [];
            return (
            <div key={e.id} className="relative">
            <Button variant="ghost"
              onClick={() => onOpen(e.entry_date)}
              className={`group block w-full h-auto whitespace-normal text-left rounded-2xl bg-gradient-to-br from-sakura-50 to-ivory-50 border border-sakura-100 shadow-soft hover:shadow-paper hover:border-sakura-200 transition-all px-5 py-4 ${photos.length > 0 ? "pr-16" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={14} className="text-sakura-500" />
                <span className="text-sm font-semibold text-charcoal">
                  {formatReflectionDate(e.entry_date)}
                </span>
              </div>
              <p className="text-sm text-charcoal/75 leading-relaxed italic">
                "{e.ai_summary}"
              </p>
            </Button>
            {photos.length > 0 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
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

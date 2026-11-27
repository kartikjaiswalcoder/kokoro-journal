import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { X, Save, Trash2, Sparkles, Camera, Loader2 } from "lucide-react";
import { SakuraBlossom, Leaf, Clover } from "./Decor";
import { MoodGlyph } from "./MoodGlyph";
import { formatLongDate } from "@/lib/dates";
import { MOODS, MOOD_THEME } from "@/types";
import type { Mood } from "@/types";
import { getEntry, saveEntry, saveAISummary, deleteEntry, isSummaryStale } from "@/lib/store";
import { generateSummary } from "@/lib/ai-summary.functions";
import { useServerFn } from "@tanstack/react-start";
import AISummaryPopup from "./AISummaryPopup";
import PhotoFrame, { PhotoThumb } from "./PhotoFrame";
import { uploadDayPhotos, deletePhotoFiles } from "@/lib/photos";
import { photosToAdd } from "@/lib/photo-rules";
import { useStore } from "@/lib/useStore";
import type { AIState } from "./AISummaryPopup";

// Remembers the last summary per day and the exact text + mood it was made
// from, so reopening the popup or notepad reuses it while both are unchanged.
// A mood change counts as a change and triggers regeneration.
const summaryMemory = new Map<string, { content: string; mood: Mood | null; summary: string }>();

export default function Notepad({
  dateKey,
  onClose,
  startWithSummary = false,
}: {
  dateKey: string;
  onClose: () => void;
  // Opened from Reflections: the saved summary shows above the notepad right away.
  startWithSummary?: boolean;
}) {
  const generateSummaryFn = useServerFn(generateSummary);
  useStore();
  const existing = getEntry(dateKey);
  const savedPhotos = existing?.photos ?? [];
  // Photos are part of the page's draft: adding or removing one only sticks after Save.
  const [photos, setPhotos] = useState<string[]>(savedPhotos);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  // Files uploaded in this sitting that no saved page uses yet (removed again if never saved).
  const unsavedUploadsRef = useRef(new Set<string>());
  // Gentle pop-up when Save is tapped on an empty page; the key replays its rise each time.
  const [hint, setHint] = useState(0);
  const hintTimerRef = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [content, setContent] = useState(existing?.content ?? "");
  const [mood, setMood] = useState<Mood | null>(existing?.mood ?? null);
  const [ai, setAI] = useState<AIState>(() => {
    if (startWithSummary && existing?.ai_summary) {
      return { kind: "success", summary: existing.ai_summary };
    }
    const remembered = summaryMemory.get(dateKey);
    if (
      remembered &&
      remembered.content === (existing?.content ?? "") &&
      remembered.mood === (existing?.mood ?? null)
    ) {
      return { kind: "success", summary: remembered.summary };
    }
    if (existing?.ai_summary && !isSummaryStale(dateKey)) {
      return { kind: "success", summary: existing.ai_summary };
    }
    return { kind: "idle" };
  });
  const [stale, setStale] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(() => startWithSummary && !!existing?.ai_summary);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // A newly generated summary is a change like any other: it is kept only when the user taps Save.
  const [pendingSummary, setPendingSummary] = useState<{ content: string; mood: Mood | null; summary: string } | null>(null);
  const requestIdRef = useRef(0);
  const summaryLoadingRef = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;
  const moodRef = useRef(mood);
  moodRef.current = mood;

  // Detect if entry text or mood changed since summary was generated.
  const remembered = summaryMemory.get(dateKey);
  const pendingMatches = !!pendingSummary && pendingSummary.content === content && pendingSummary.mood === mood;
  const summaryMatchesText = pendingMatches || (remembered
    ? remembered.content === content && remembered.mood === mood
    : !!existing?.ai_summary && content === existing.content && mood === existing.mood && !isSummaryStale(dateKey));
  const summaryStale = ai.kind === "success" && !summaryMatchesText;

  const photosKey = photos.join("|");
  // Only a change that could actually be saved asks before closing: a mood or photos
  // on a fresh page with nothing written can't be saved, so leaving it asks nothing.
  const worthKeeping = dirty && (content.trim() !== "" || !!existing);
  const savedPhotosKey = savedPhotos.join("|");
  useEffect(() => {
    setDirty(
      content !== (existing?.content ?? "") ||
        mood !== (existing?.mood ?? null) ||
        photosKey !== savedPhotosKey ||
        pendingMatches,
    );
    // If user edits text after a success summary, mark stale.
    if (existing?.ai_summary && content !== existing.content) {
      setStale(true);
    } else if (existing?.ai_summary && content === existing.content) {
      setStale(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, mood, dateKey, photosKey, savedPhotosKey, existing?.content, existing?.mood, pendingMatches]);

  // The page wears the mood picked for the day; until one is chosen it follows the app's
  // ambient (player) theme. While the colors glide to a new mood, inner color transitions
  // pause so nothing lags behind.
  const theme: Mood | undefined = mood ?? undefined;
  const [shifting, setShifting] = useState(false);
  const firstThemeRef = useRef(true);
  useEffect(() => {
    if (firstThemeRef.current) {
      firstThemeRef.current = false;
      return;
    }
    setShifting(true);
    const t = window.setTimeout(() => setShifting(false), 520);
    return () => window.clearTimeout(t);
  }, [theme]);

  // Close on Escape, but warn if unsaved changes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (photoOpen) return;
        if (summaryOpen) {
          setSummaryOpen(false);
          return;
        }
        if (worthKeeping && !savedJustNowRef.current) {
          const ok = window.confirm("You have unsaved changes. Discard them?");
          if (!ok) return;
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, onClose, summaryOpen, photoOpen]);

  const savedJustNowRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    const unsaved = unsavedUploadsRef.current;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(hintTimerRef.current);
      // Closing without saving drops photos that were only added in this sitting.
      deletePhotoFiles([...unsaved]);
      unsaved.clear();
    };
  }, []);

  // Saving is instant: the page updates right away and the write finishes in the background.
  function handleSave() {
    if (uploading) return;
    const nothing = !content.trim() && !mood && photos.length === 0;
    // A page is only worth keeping once something is written: a mood or photos alone get the hint.
    // (Clearing a saved page completely still resets that day below.)
    if (!content.trim() && !(nothing && existing)) {
      setHint((n) => n + 1);
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = window.setTimeout(() => { if (mountedRef.current) setHint(0); }, 2800);
      return;
    }
    const removedPhotos = savedPhotos.filter((p) => !photos.includes(p));
    unsavedUploadsRef.current.clear();
    if (nothing && existing) {
      // Everything was cleared: the day goes back to an empty page.
      savedJustNowRef.current = true;
      setDirty(false);
      summaryMemory.delete(dateKey);
      requestIdRef.current += 1;
      setAI({ kind: "idle" });
      setTimeout(() => (savedJustNowRef.current = false), 800);
      deleteEntry(dateKey).catch((e) => {
        console.error(e);
        if (mountedRef.current) setDirty(true);
        window.alert("I couldn't save your entry. Please try again.");
      });
      return;
    }
    const entryChanged =
      !existing ||
      content !== existing.content ||
      mood !== (existing.mood ?? null) ||
      photosKey !== savedPhotosKey;
    const writes: Promise<unknown>[] = [];
    if (entryChanged) {
      const entryWrite = saveEntry(dateKey, content, mood, photos);
      void entryWrite.then(() => deletePhotoFiles(removedPhotos)).catch(() => {});
      writes.push(entryWrite);
    }
    if (pendingSummary && pendingMatches) {
      writes.push(saveAISummary(dateKey, pendingSummary.summary));
      summaryMemory.set(dateKey, { content, mood, summary: pendingSummary.summary });
    }
    setPendingSummary(null);
    savedJustNowRef.current = true;
    setDirty(false);
    setStale(false);
    const fresh = getEntry(dateKey);
    if (fresh?.ai_summary) {
      setAI({ kind: "success", summary: fresh.ai_summary });
    } else {
      requestIdRef.current += 1;
      setAI({ kind: "idle" });
      const remembered = summaryMemory.get(dateKey);
      if (remembered?.content !== content || remembered?.mood !== mood) summaryMemory.delete(dateKey);
    }
    setTimeout(() => (savedJustNowRef.current = false), 800);
    Promise.all(writes).catch((e) => {
      console.error(e);
      if (mountedRef.current) setDirty(true);
      window.alert("I couldn't save your entry. Please try again.");
    });
  }

  async function handleSummary() {
    if (summaryLoadingRef.current) return;
    if (!content.trim()) {
      setAI({ kind: "error", message: "Write a little about your day first, and I'll help you reflect. 🌱" });
      return;
    }
    const reqId = ++requestIdRef.current;
    summaryLoadingRef.current = true;
    setAI({ kind: "loading" });
    const FRIENDLY = "Couldn't summarize your entry right now. Please try again.";
    try {
      const data = await generateSummaryFn({ data: { entry: content, mood } });
      if (reqId !== requestIdRef.current) return;
      if (contentRef.current !== content || moodRef.current !== mood) {
        setAI({ kind: "idle" });
        return;
      }
      const summary: string | undefined = data?.summary;
      if (data?.error || !summary) {
        setAI({ kind: "error", message: data?.error ?? FRIENDLY });
        return;
      }
      setAI({ kind: "success", summary });
      setStale(false);
      // Kept as an unsaved change until the user taps Save.
      setPendingSummary({ content, mood, summary });
    } catch (e) {
      console.error(e);
      if (reqId === requestIdRef.current) setAI({ kind: "error", message: FRIENDLY });
    } finally {
      summaryLoadingRef.current = false;
    }
  }

  function openSummary() {
    setSummaryOpen(true);
    if (ai.kind === "success" && summaryMatchesText) return;
    void handleSummary();
  }

  async function handleShare() {
    if (ai.kind !== "success") return;
    const text = ai.summary;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setToast("Your day's AI summary copied 🌸");
    } catch {
      setToast("I couldn't copy automatically. Please long-press to copy.");
    } finally {
      setTimeout(() => setToast(null), 2600);
    }
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || uploading) return;
    setUploading(true);
    try {
      const paths = await uploadDayPhotos(dateKey, photosRef.current.length, files);
      if (!mountedRef.current) {
        deletePhotoFiles(paths);
        return;
      }
      const fit = photosToAdd(photosRef.current.length, paths);
      deletePhotoFiles(paths.filter((p) => !fit.includes(p)));
      fit.forEach((p) => unsavedUploadsRef.current.add(p));
      setPhotos((prev) => [...prev, ...fit]);
      // Show the new photos right away, starting from the first one.
      if (fit.length > 0) setPhotoOpen(true);
    } catch (err) {
      console.error(err);
      window.alert("I couldn't add that photo. Please try another one.");
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  function removePhoto(path: string) {
    setPhotos((prev) => prev.filter((p) => p !== path));
    // A photo added in this sitting can go right away; a saved one stays until Save.
    if (unsavedUploadsRef.current.delete(path)) deletePhotoFiles([path]);
  }

  async function handleDelete() {
    try {
      deletePhotoFiles([...unsavedUploadsRef.current]);
      unsavedUploadsRef.current.clear();
      await deleteEntry(dateKey);
      summaryMemory.delete(dateKey);
      onClose();
    } catch (e) {
      window.alert("I couldn't remove this entry.");
      console.error(e);
    }
  }

  const longDate = formatLongDate(dateKey);
  // A brand-new page offers Save from the start (with a gentle hint if it's still empty).
  const canSave = dirty || !existing;

  return (
    <div
      data-mood-theme={theme}
      className={`mood-scope fixed inset-0 z-50 overflow-y-auto scrollbar-soft ${shifting ? "mood-shifting" : ""}`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-charcoal/30 backdrop-blur-sm animate-fadeIn"
        onClick={() => {
          if (worthKeeping) {
            const ok = window.confirm("You have unsaved changes. Discard them?");
            if (!ok) return;
          }
          onClose();
        }}
      />

      {/* Centered on every screen size; scrolls when taller than the screen. */}
      <div className="relative min-h-full flex items-center justify-center p-3 sm:p-6 pointer-events-none">
      {/* Notepad */}
      <div className="relative w-full max-w-[440px] animate-slideUp my-4 pointer-events-auto">
        <div className="relative bg-white rounded-3xl shadow-paper border-2 border-sakura-100 overflow-hidden">
          {/* Corner blossoms */}
          <SakuraBlossom size={26} className="absolute top-2.5 left-2.5 text-sakura-200 z-10" />
          <SakuraBlossom size={22} className="absolute top-2.5 right-2.5 text-sakura-200 z-10" />
          <Leaf size={18} className="absolute bottom-2.5 left-2.5 text-sage-200 z-10" />
          <Clover size={18} className="absolute bottom-2.5 right-2.5 text-sage-200 z-10" />

          {/* Header */}
          <div className="px-6 sm:px-8 pt-8 pb-3 border-b border-sakura-100/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-sakura-400 font-semibold">
                  Your page
                </p>
                <h3 className="text-lg sm:text-xl font-semibold text-charcoal mt-0.5">
                  {longDate}
                </h3>
              </div>
              <button
                onClick={() => {
                  if (worthKeeping) {
                    const ok = window.confirm("You have unsaved changes. Discard them?");
                    if (!ok) return;
                  }
                  onClose();
                }}
                aria-label="Close notepad"
                className="grid place-items-center w-8 h-8 rounded-full bg-sakura-50 text-charcoal/50 hover:bg-sakura-100 hover:text-sakura-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mood selector */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-charcoal/40 mr-1">Mood:</span>
              {MOODS.map((m) => {
                const active = mood === m.key;
                const t = MOOD_THEME[m.key];
                return (
                  <button
                    key={m.key}
                    onClick={() => setMood(active ? null : m.key)}
                    title={m.label}
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-all ${
                      active
                        ? `${t.accent} ${t.accentText} ring-1 ${t.ring}`
                        : "text-charcoal/50 hover:bg-sakura-50"
                    }`}
                  >
                    <MoodGlyph mood={m.key} size={14} />
                    {active && <span>{m.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Writing area */}
          <div className="relative px-6 sm:px-8 pt-5 pb-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Take a breath. There's no right way to write here…"
              className="journal-lines w-full min-h-[294px] resize-none bg-transparent outline-none text-charcoal font-sans text-[15px] leading-[34px] placeholder:text-charcoal/30"
              style={{
                backgroundAttachment: "local",
              }}
            />
          </div>

          {/* Footer actions */}
          <div className="px-6 sm:px-8 pb-6 pt-1 flex flex-wrap items-center gap-2">
            <button
              onClick={openSummary}
              disabled={ai.kind === "loading"}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-br from-sakura-400 to-sakura-500 text-white px-4 py-2 text-sm font-semibold shadow-soft hover:from-sakura-500 hover:to-sakura-600 transition-all disabled:opacity-60"
            >
              <Sparkles size={15} />
              AI Summary
            </button>

            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
            {photos.length > 0 ? (
              <PhotoThumb paths={photos} size={36} busy={uploading} onClick={() => setPhotoOpen(true)} label="Open photos" />
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Add photos"
                title="Add photos"
                className="grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br from-sakura-400 to-sakura-500 text-white shadow-soft hover:from-sakura-500 hover:to-sakura-600 transition-all disabled:opacity-70"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!canSave || uploading}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                canSave
                  ? "bg-sage-500 text-white hover:bg-sage-600 shadow-soft"
                  : "bg-sage-100 text-sage-500"
              } disabled:cursor-default`}
            >
              <Save size={15} />
              {canSave ? "Save" : "Saved"}
            </button>

            {existing && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-charcoal/40 hover:text-sakura-600 hover:bg-sakura-50 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
          </div>

          <div className="px-6 sm:px-8 pb-5 -mt-2 flex items-center justify-center gap-1.5 text-[11px] text-charcoal/40 font-hand text-base">
            <span>written with a little heart ♡</span>
          </div>
        </div>

      </div>
      </div>

      <div className="fixed inset-x-0 bottom-6 z-[61] flex justify-center px-4 pointer-events-none" role="status">
        {hint > 0 && (
          <span
            key={hint}
            className="rounded-2xl border border-sakura-100/50 bg-sakura-50/60 px-5 py-2.5 text-center font-hand text-base text-sakura-500 backdrop-blur-[2px] animate-riseIn"
          >
            write a few words about your day first, then save ♡
          </span>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm animate-fadeIn" onClick={() => setConfirmDelete(false)} />
          <div role="alertdialog" aria-label="Delete this moment" className="relative w-full max-w-[280px] rounded-3xl bg-white border-2 border-sakura-100 shadow-paper px-6 py-6 text-center animate-slideUp">
            <SakuraBlossom size={22} className="absolute top-3 right-3 text-sakura-200" />
            <p className="text-[15px] font-semibold text-charcoal">Delete this moment permanently?</p>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={handleDelete} className="rounded-full bg-rose-200 text-rose-700 px-4 py-2 text-sm font-semibold hover:bg-rose-300 transition-colors">
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-full px-4 py-2 text-sm font-medium text-charcoal/50 hover:bg-sakura-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {photoOpen && photos.length > 0 && (
        <PhotoFrame
          paths={photos}
          label={longDate}
          onClose={() => setPhotoOpen(false)}
          onRemove={removePhoto}
          onAdd={() => fileRef.current?.click()}
          adding={uploading}
        />
      )}

      {summaryOpen && (
        <AISummaryPopup
          ai={ai}
          stale={summaryStale}
          toast={toast}
          onClose={() => setSummaryOpen(false)}
          onRetry={handleSummary}
          onShare={handleShare}
        />
      )}
    </div>
  );
}

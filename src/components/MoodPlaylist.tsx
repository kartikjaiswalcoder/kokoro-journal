import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ListMusic, Loader2, Minus, Pin, Play, Search, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { searchSongs } from "@/lib/playlists.functions";
import { defaultSongs, eligibleSongs, excludeDefaults, playbackQueue, playlistSongs, removeSong, samePlaylist, toggleSelection, type Playlist } from "@/lib/playlists";
import type { MusicTrack } from "@/lib/music";
import { MOODS, type Mood } from "@/types";
import { MoodGlyph } from "./MoodGlyph";
import { SakuraBlossom, Leaf } from "./Decor";

function SongRow({ song, fixed, disabled, selected, number, focused, onSelect, onRemove }: {
  song: MusicTrack; fixed: boolean; disabled: boolean; selected: boolean; number: number;
  focused: boolean; onSelect: (extend: boolean) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: song.videoId, disabled: fixed });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);
  useEffect(() => { if (isDragging) { clear(); held.current = true; } }, [isDragging]);
  const rowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (focused) rowRef.current?.scrollIntoView({ block: "nearest" }); }, [focused]);
  return <div ref={(node) => { setNodeRef(node); rowRef.current = node; }} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group relative flex items-center gap-1 rounded-2xl min-h-16 px-2 transition-colors ${selected ? "playlist-song-selected" : ""} ${disabled ? "opacity-35" : ""} ${isDragging ? "z-30 shadow-soft" : ""}`}>
    <Button ref={setActivatorNodeRef} {...(!fixed ? attributes : {})} variant="ghost" disabled={disabled} className={`h-auto min-h-14 flex-1 min-w-0 justify-start whitespace-normal text-left px-2 rounded-2xl text-charcoal hover:bg-sakura-50/80 hover:text-sakura-600 ${focused ? "ring-2 ring-sakura-400" : ""} ${!fixed ? "cursor-grab active:cursor-grabbing" : ""}`}
      data-keyboard-focused={focused || undefined}
      onKeyDown={(event) => listeners?.['onKeyDown']?.(event)}
      data-song-row
      aria-label={`Select ${song.title}`} aria-pressed={selected}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        held.current = false; start.current = { x: e.clientX, y: e.clientY };
        clear(); timer.current = setTimeout(() => { held.current = true; onSelect(true); }, 500);
      }}
      onMouseDown={(event) => listeners?.['onMouseDown']?.(event)}
      onTouchStart={(event) => listeners?.['onTouchStart']?.(event)}
      onPointerMove={(e) => { if (Math.abs(e.clientX - start.current.x) + Math.abs(e.clientY - start.current.y) > 10) clear(); }}
      onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => { e.currentTarget.blur(); if (held.current) { held.current = false; return; } onSelect(e.ctrlKey || e.metaKey); }}>
      <span className={`grid place-items-center shrink-0 w-7 h-7 rounded-full ${selected ? "bg-sakura-200 text-sakura-600 ring-1 ring-sakura-300" : fixed ? "text-sakura-300" : "text-charcoal/25"}`}>
        {selected ? number > 0 ? <span className="text-xs">{number}</span> : <Check size={14} /> : fixed ? <Pin size={13} className="rotate-45" aria-label="Pinned default song" /> : <span className="w-1 h-1 rounded-full bg-current" />}
      </span>
      <span className="min-w-0"><span className="block text-sm font-semibold break-words">{song.title}</span><span className="block text-[11px] font-normal text-charcoal/45 break-words mt-0.5">{song.artist}</span></span>
    </Button>
    <span className="w-8 shrink-0">{!fixed && <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-charcoal/30 hover:text-sakura-600 hover:bg-sakura-100" aria-label={`Remove ${song.title}`} title="Remove song" onClick={onRemove}><Minus size={14} /></Button>}</span>
  </div>;
}

// Edits stay in a local draft: they are saved and applied only when Play is pressed.
// Closing with X, Escape or a click outside discards them.
export default function MoodPlaylist({ mood, playlist: saved, onSave, onPlay, onDraftChange, onClose, error }: {
  mood: Mood; playlist: Playlist; onSave: (playlist: Playlist) => void;
  onPlay: (playlist: Playlist) => void; onDraftChange?: (playlist: Playlist) => void; onClose: () => void; error: string | null;
}) {
  const [playlist, onChange] = useState(saved);
  // Lets the player pre-load the song Play would start, so it begins instantly.
  const draftChangeRef = useRef(onDraftChange);
  draftChangeRef.current = onDraftChange;
  useEffect(() => { draftChangeRef.current?.(playlist); }, [playlist]);
  const [ordering, setOrdering] = useState(saved.mode === "selected" && saved.selectedIds.length > 1);
  const [cursor, setCursor] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const enterRef = useRef<{ id: string; held: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dirty = !samePlaylist(playlist, saved);
  const search = useServerFn(searchSongs);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Omit<MusicTrack, "mood">[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);
  useEffect(() => {
    if (!addedNotice) return;
    const timer = setTimeout(() => setAddedNotice(false), 2400);
    return () => clearTimeout(timer);
  }, [addedNotice]);
  const searchId = useRef(0);
  const songs = playlistSongs(mood, playlist);
  const defaults = defaultSongs(mood);
  const eligible = new Set(eligibleSongs(mood, playlist).map((s) => s.videoId));
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 650, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  useEffect(() => {
    const id = ++searchId.current;
    setResults([]); setSearchError(null); setSearched(false); setSearching(false);
    if (!query.trim()) { setResultsOpen(false); return; }
    setResultsOpen(true);
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await search({ data: { query: query.trim() } });
        if (id === searchId.current) { setResults(response.songs); setSearchError(response.error); setSearched(true); }
      } catch { if (id === searchId.current) setSearchError("Search couldn't load. Please try again."); }
      finally { if (id === searchId.current) setSearching(false); }
    }, 650);
    return () => { clearTimeout(timer); searchId.current++; };
  }, [query, search]);
  const canPlay = playbackQueue(mood, playlist).length > 0;
  const play = () => {
    if (!canPlay) return;
    if (dirty) onSave(playlist);
    onPlay(playlist);
    onClose();
  };
  const select = (id: string, extend: boolean) => {
    if (!eligible.has(id)) return;
    const next = toggleSelection(playlist, id, ordering, extend);
    onChange(next.playlist);
    setOrdering(next.ordering);
  };
  const eligibleIds = songs.filter((s) => eligible.has(s.videoId)).map((s) => s.videoId);
  const live = useRef({ play, select, eligibleIds, cursor, resultsOpen });
  live.current = { play, select, eligibleIds, cursor, resultsOpen };
  // Keyboard (desktop): arrows/WASD show a selector on the top song, then W/S or Up/Down move it.
  // Enter selects like a click; Ctrl+Enter or holding Enter builds a numbered order.
  // Without a selector, Enter plays as before.
  useEffect(() => {
    const STEP: Record<string, number> = { ArrowUp: -1, w: -1, W: -1, ArrowDown: 1, s: 1, S: 1, ArrowLeft: 0, ArrowRight: 0, a: 0, A: 0, d: 0, D: 0 };
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || draggingRef.current) return;
      const state = live.current;
      const step = STEP[event.key];
      if (step !== undefined) {
        if (typing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        const ids = state.eligibleIds;
        if (!ids.length) return;
        const index = state.cursor ? ids.indexOf(state.cursor) : -1;
        if (index < 0) { setCursor(ids[0] ?? null); return; }
        if (step) setCursor(ids[Math.max(0, Math.min(ids.length - 1, index + step))] ?? null);
        return;
      }
      if (event.key !== "Enter") return;
      if (event.target instanceof HTMLInputElement && state.resultsOpen) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      const id = state.cursor && state.eligibleIds.includes(state.cursor) ? state.cursor : null;
      if (!id) { state.play(); return; }
      if (event.ctrlKey || event.metaKey) { state.select(id, true); return; }
      if (enterRef.current) clearTimeout(enterRef.current.timer);
      const press = { id, held: false, timer: setTimeout(() => { press.held = true; live.current.select(id, true); }, 500) };
      enterRef.current = press;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !enterRef.current) return;
      const press = enterRef.current;
      enterRef.current = null;
      clearTimeout(press.timer);
      if (!press.held) live.current.select(press.id, false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      if (enterRef.current) clearTimeout(enterRef.current.timer);
    };
  }, []);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent ref={contentRef} aria-describedby={undefined} data-mood={mood} data-mood-theme={mood}
      onOpenAutoFocus={(e) => { e.preventDefault(); contentRef.current?.focus(); }} overlayClassName="bg-charcoal/30 backdrop-blur-sm" className="kokoro-playlist outline-none focus:outline-none w-[calc(100%-2rem)] max-w-[440px] h-[min(640px,88dvh)] flex flex-col gap-0 rounded-3xl sm:rounded-3xl p-0 border-2 shadow-paper text-charcoal"
      onPointerDownCapture={(e) => { setCursor(null); if (e.target instanceof HTMLElement && !e.target.closest('[data-song-search]')) setResultsOpen(false); }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && resultsOpen) { e.preventDefault(); e.stopPropagation(); setResultsOpen(false); }
      }}>
      <SakuraBlossom size={22} className="absolute top-2 left-2 text-sakura-200 pointer-events-none" />
      <div className="px-6 sm:px-8 pt-8 pb-5 flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-2xl playlist-song-selected text-sakura-500"><MoodGlyph mood={mood} size={20} /></span><DialogTitle className="text-lg text-charcoal tracking-normal">{MOODS.find((m) => m.key === mood)?.label} playlist</DialogTitle>
      </div>
      <div data-song-search className="relative px-6 sm:px-8 pb-4 z-20">
        <div className="flex items-center gap-2 rounded-full border border-sakura-100 bg-background/80 px-4 focus-within:border-sakura-200 transition-colors"><Search size={15} className="text-charcoal/30 shrink-0" /><input aria-label="Search songs" maxLength={200} value={query} onFocus={() => { if (query.trim()) setResultsOpen(true); }} onChange={(e) => setQuery(e.target.value)} placeholder="Search music…" className="w-full min-w-0 py-3 bg-transparent outline-none text-sm text-charcoal placeholder:text-charcoal/35" /></div>
        {resultsOpen && <div role="region" aria-label="Song search results" className="absolute left-6 right-6 sm:left-8 sm:right-8 top-[calc(100%-0.65rem)] max-h-64 overflow-y-auto scrollbar-soft rounded-2xl border border-sakura-100 bg-background shadow-paper text-charcoal animate-fadeIn p-2">
          {searching && <div className="flex justify-center p-5"><Loader2 className="animate-spin" aria-label="Searching" size={20} /></div>}
          {searchError && <p role="alert" className="p-4 text-sm">{searchError}</p>}
          {searched && !searching && !searchError && !results.length && <p className="p-4 text-sm text-charcoal/50">No songs found.</p>}
          {results.map((song) => { const added = songs.some((s) => s.videoId === song.videoId); return <Button key={song.videoId} variant="ghost" disabled={added} aria-label={added ? `${song.title} already added` : `Add ${song.title}`} className="group w-full h-auto min-h-14 px-3 py-3 justify-start whitespace-normal text-left rounded-xl text-charcoal/75 hover:text-sakura-600 hover:bg-sakura-50 transition-colors duration-200" onClick={() => {
            onChange({ ...playlist, songs: [...playlist.songs, { ...song, mood }] });
            searchId.current++;
            setResultsOpen(false); setQuery(""); setAddedNotice(true);
          }}><span className="min-w-0"><span className="block text-sm font-semibold break-words">{song.title}</span><span className="block mt-0.5 text-[11px] font-normal text-charcoal/40 break-words">{song.artist}</span></span>{added && <Check size={14} className="ml-auto shrink-0 text-sage-500" />}</Button>; })}
        </div>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-soft px-4 sm:px-6 py-1" onPointerDown={() => setResultsOpen(false)}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => { draggingRef.current = true; }} onDragCancel={() => { draggingRef.current = false; }} onDragEnd={({ active, over }) => {
          draggingRef.current = false;
          if (!over || active.id === over.id) return;
          const from = playlist.songs.findIndex((s) => s.videoId === active.id); const to = playlist.songs.findIndex((s) => s.videoId === over.id);
          if (from >= 0 && to >= 0) onChange({ ...playlist, songs: arrayMove(playlist.songs, from, to) });
        }}>
          <SortableContext items={playlist.songs.map((s) => s.videoId)} strategy={verticalListSortingStrategy}>
            {songs.map((song) => { const fixed = defaults.some((s) => s.videoId === song.videoId); const index = playlist.selectedIds.indexOf(song.videoId); return <SongRow key={song.videoId} song={song} fixed={fixed} disabled={!eligible.has(song.videoId)} selected={playlist.mode === "selected" && index >= 0} number={ordering ? index + 1 : 0} focused={cursor === song.videoId}
              onSelect={(extend) => select(song.videoId, extend)}
              onRemove={() => { const next = removeSong(playlist, song.videoId); onChange(next); if (!next.selectedIds.length) setOrdering(false); }} />; })}
          </SortableContext>
        </DndContext>
      </div>
      <div className="relative px-6 sm:px-8 pt-4 pb-6 border-t border-sakura-100/80 space-y-3 text-charcoal">
        <div className="flex gap-2" role="group" aria-label="Playback mode">
          {([['ordered', 'Play in order', ListMusic], ['random', 'Random', Shuffle]] as const).map(([mode, label, Icon]) => <Button key={mode} variant="ghost" aria-pressed={playlist.mode === mode} className={`flex-1 rounded-full text-xs sm:text-sm ${playlist.mode === mode ? "bg-sakura-100 text-sakura-600" : "bg-background/60 text-charcoal/45"} hover:bg-sakura-100 hover:text-sakura-600`} onClick={(e) => { e.currentTarget.blur(); setOrdering(false); onChange({ ...playlist, mode, selectedIds: [] }); }}><Icon size={14} />{label}</Button>)}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-charcoal/55 px-1"><label htmlFor="exclude-defaults">Exclude default songs</label><Switch id="exclude-defaults" checked={playlist.excludeDefaults} onCheckedChange={(checked) => onChange(excludeDefaults(mood, playlist, checked))} className="data-[state=checked]:bg-sakura-300 data-[state=unchecked]:bg-sakura-100" /></div>
        {error && <p role="alert" className="text-xs text-sakura-700">{error}</p>}
        <Button disabled={!canPlay} className="w-full bg-sakura-400 text-primary-foreground hover:bg-sakura-500 rounded-full" onClick={play}><Play />{dirty ? "Save & Play" : "Play"}</Button>
        <Leaf size={17} className="absolute bottom-2 left-2 text-sage-200 pointer-events-none" />
      </div>
      {addedNotice && <div role="status" className="pointer-events-none absolute bottom-44 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-full bg-sakura-50 border border-sakura-100 shadow-soft px-4 py-2 text-xs text-sakura-600 flex items-center gap-2 animate-toastIn"><Check size={13} />Added to playlist</div>}
    </DialogContent>
  </Dialog>;
}
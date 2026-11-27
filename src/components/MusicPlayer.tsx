import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Play, Pause, Volume2, VolumeX, Music, Plus, SkipBack, SkipForward } from "lucide-react";
import { MOODS } from "@/types";
import type { Mood } from "@/types";
import { Button } from "@/components/ui/button";
import MoodPlaylist from "./MoodPlaylist";
import { usePlaylists } from "@/hooks/usePlaylists";
import { nextSong, playbackQueue, type Playlist } from "@/lib/playlists";
import { MUSIC_TRACKS } from "@/lib/music";

const STORE_KEY = "kokoro:music";
import type { MusicTrack } from "@/lib/music";
import { loadYouTubeApi } from "@/lib/youtube";
import { DualDeck } from "@/lib/player-decks";
import { MoodGlyph } from "./MoodGlyph";
import ScrollingSongTitle from "./ScrollingSongTitle";

// The player always uses the app's sakura tokens; while a mood plays, those tokens take
// that mood's palette app-wide (see [data-mood-theme] in styles.css).
const PLAYER_THEME = { accentText: "text-sakura-600" };

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MusicPlayer() {
  const library = usePlaylists();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const advanceRef = useRef<(direction: number) => void>(() => {});
  const warmNextRef = useRef<() => void>(() => {});
  const historyRef = useRef<string[]>([]);
  const activeListsRef = useRef<Partial<Record<Mood, Playlist>>>({});
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const [mood, setMood] = useState<Mood | null>(null);
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<DualDeck | null>(null);
  // Shown on the timeline until the restored song reports its own position.
  const restoreTimeRef = useRef<number | null>(null);
  const trackRef = useRef<MusicTrack | null>(null);
  const moodRef = useRef<Mood | null>(null);
  const playlistOpenRef = useRef(false);
  trackRef.current = track;
  moodRef.current = mood;
  playlistOpenRef.current = playlistOpen;
  // Songs picked ahead of time, so the one pre-loaded is the one that actually plays.
  const plannedNextRef = useRef<{ from: string; videoId: string } | null>(null);
  const plannedMoodRef = useRef<Partial<Record<Mood, string>>>({});
  const plannedPlaylistRef = useRef<string | null>(null);
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleWarm = (fn: () => void, delay: number) => {
    if (warmTimer.current) clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(() => { warmTimer.current = null; fn(); }, delay);
  };
  useEffect(() => () => { if (warmTimer.current) clearTimeout(warmTimer.current); }, []);

  // Create the two hidden YouTube players once and keep the timeline in sync with them.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const hosts = [document.createElement("div"), document.createElement("div")] as [HTMLElement, HTMLElement];
    hosts.forEach((h) => container.appendChild(h));
    let cancelled = false;

    const deck = new DualDeck({
      onReady: () => {
        if (cancelled) return;
        deckRef.current = deck;
        setReady(true);
        // Restore the last session's music, paused at the same spot and already buffered.
        try {
          const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
          const t = saved && MOODS.some((m) => m.key === saved.mood) && /^[A-Za-z0-9_-]{11}$/.test(saved.videoId) && typeof saved.title === "string"
            ? { mood: saved.mood as Mood, videoId: saved.videoId as string, title: saved.title as string, artist: typeof saved.artist === "string" ? saved.artist : "" } : MUSIC_TRACKS.find((s) => s.videoId === saved?.videoId && s.mood === saved?.mood);
          if (t) {
            const at = Number(saved.time) || 0;
            moodRef.current = t.mood;
            trackRef.current = t;
            setMood(t.mood);
            setTrack(t);
            restoreTimeRef.current = at;
            setCurrentTime(at);
            deck.load(t.videoId, { play: false, start: at });
          }
        } catch {
          /* ignore */
        }
      },
      onPlayingChange: (isPlaying) => setPlaying(isPlaying),
      onEnded: () => advanceRef.current(1),
      onError: () => {
        setPlaying(false);
        setFailed(true);
      },
      onStarted: () => warmNextRef.current(),
    });

    loadYouTubeApi().then((YT) => {
      if (!cancelled) deck.mount(YT, hosts);
    });

    const timer = window.setInterval(() => {
      const d = deckRef.current;
      if (!d) return;
      const { current, duration: total } = d.time();
      let time = current;
      if (restoreTimeRef.current !== null) {
        if (current > 0.5) restoreTimeRef.current = null;
        else time = restoreTimeRef.current;
      }
      setCurrentTime(time);
      setDuration(total);
      const t = trackRef.current;
      if (t && moodRef.current) {
        localStorage.setItem(
          STORE_KEY,
          JSON.stringify({ ...t, time, playing: d.wantsPlay }),
        );
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      deck.destroy();
      deckRef.current = null;
      hosts.forEach((h) => h.remove());
    };
  }, []);

  // Spacebar toggles play/pause while on My Journal (player visible) and a mood is picked.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space" && e.key !== " ") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName))) return;
      if (!containerRef.current || containerRef.current.closest(".hidden")) return;
      if (document.querySelector('[role="dialog"], .fixed.inset-0')) return;
      if (!moodRef.current || !trackRef.current) return;
      e.preventDefault();
      togglePlayRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    deckRef.current?.setVolume(muted ? 0 : volume * 100);
  }, [volume, muted, ready]);

  // Ambient theme: the whole app takes the playing mood's colors (pink when nothing plays).
  useEffect(() => {
    const root = document.documentElement;
    if (mood) root.dataset["moodTheme"] = mood;
    else delete root.dataset["moodTheme"];
  }, [mood]);
  useEffect(() => () => { delete document.documentElement.dataset["moodTheme"]; }, []);

  // Single click selects/deselects a mood; double click opens its playlist and never deselects.
  // Deselecting waits briefly so the first click of a double click can't close the player.
  // The second click is caught by the whole mood row, because selecting a mood widens its chip
  // and shifts the row under the pointer.
  const deselectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMoodClick = useRef<{ key: Mood; at: number } | null>(null);
  const cancelDeselect = () => { if (deselectTimer.current) clearTimeout(deselectTimer.current); deselectTimer.current = null; };
  useEffect(() => cancelDeselect, []);
  function clickMood(key: Mood) {
    lastMoodClick.current = { key, at: Date.now() };
    cancelDeselect();
    if (moodRef.current === key) {
      deselectTimer.current = setTimeout(() => { deselectTimer.current = null; if (moodRef.current === key) selectMoodRef.current(key); }, 300);
      return;
    }
    selectMood(key);
  }
  function doubleClickMoodRow(event: ReactMouseEvent) {
    const last = lastMoodClick.current;
    if (event.detail < 2 || !last || Date.now() - last.at > 700) return;
    event.stopPropagation();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    cancelDeselect();
    if (moodRef.current !== last.key) selectMood(last.key);
    if (libraryRef.current.loaded) setPlaylistOpen(true);
  }

  function firstSong(list: Playlist, queue: MusicTrack[]) {
    return list.mode === "random" ? queue[Math.floor(Math.random() * queue.length)] : queue[0];
  }

  // Hovering a mood pre-loads its first song, so clicking it starts right away.
  function warmMood(key: Mood) {
    if (moodRef.current === key || !libraryRef.current.loaded) return;
    const list = libraryRef.current.get(key);
    const queue = playbackQueue(key, list);
    const planned = plannedMoodRef.current[key];
    const next = queue.find((s) => s.videoId === planned) ?? firstSong(list, queue);
    if (!next) return;
    plannedMoodRef.current[key] = next.videoId;
    deckRef.current?.warm(next.videoId);
  }

  function selectMood(key: Mood) {
    const deck = deckRef.current;
    setCurrentTime(0);
    setDuration(0);
    setFailed(false);
    restoreTimeRef.current = null;
    plannedNextRef.current = null;

    if (moodRef.current === key) {
      moodRef.current = null;
      trackRef.current = null;
      setMood(null);
      setTrack(null);
      localStorage.removeItem(STORE_KEY);
      deck?.pause();
      return;
    }

    const list = libraryRef.current.get(key);
    activeListsRef.current[key] = list;
    const queue = playbackQueue(key, list);
    const planned = plannedMoodRef.current[key];
    delete plannedMoodRef.current[key];
    const next = queue.find((s) => s.videoId === planned) ?? firstSong(list, queue);
    historyRef.current = [];
    moodRef.current = key;
    trackRef.current = next ?? null;
    setMood(key);
    setTrack(next ?? null);
    if (!next) { deck?.pause(); localStorage.removeItem(STORE_KEY); return; }
    // Switching moods keeps the music going if it was playing.
    deck?.load(next.videoId, { play: deck.wantsPlay });
  }

  const selectMoodRef = useRef(selectMood);
  selectMoodRef.current = selectMood;

  function activateTrack(next: MusicTrack, shouldPlay: boolean, start?: number) {
    trackRef.current = next;
    setTrack(next);
    setCurrentTime(0); setDuration(0); setFailed(false);
    restoreTimeRef.current = null;
    plannedNextRef.current = null;
    deckRef.current?.load(next.videoId, { play: shouldPlay, start });
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...next, time: 0, playing: shouldPlay }));
  }

  function currentQueue(currentMood: Mood) {
    const stored = libraryRef.current.get(currentMood);
    const active = activeListsRef.current[currentMood] ?? stored;
    const list = { ...stored, mode: active.mode, selectedIds: active.selectedIds };
    return { list, queue: playbackQueue(currentMood, list) };
  }

  function advance(direction: number) {
    const currentMood = moodRef.current;
    const current = trackRef.current;
    if (!currentMood || !current) return;
    const { list, queue } = currentQueue(currentMood);
    let next: MusicTrack | undefined;
    if (direction < 0 && list.mode === "random") {
      const previous = historyRef.current.pop();
      next = queue.find((s) => s.videoId === previous) ?? nextSong(queue, current.videoId, -1, false);
    } else {
      const planned = plannedNextRef.current;
      if (direction > 0 && planned?.from === current.videoId) next = queue.find((s) => s.videoId === planned.videoId);
      next ??= nextSong(queue, current.videoId, direction, list.mode === "random");
      if (direction > 0) historyRef.current.push(current.videoId);
    }
    if (next) activateTrack(next, deckRef.current?.wantsPlay ?? false, 0);
  }
  advanceRef.current = advance;

  // While a song plays, pre-load the one after it so skipping or the song ending is seamless.
  function warmNext() {
    const currentMood = moodRef.current;
    const current = trackRef.current;
    if (!currentMood || !current || playlistOpenRef.current) return;
    const { list, queue } = currentQueue(currentMood);
    let planned = plannedNextRef.current;
    if (!planned || planned.from !== current.videoId || !queue.some((s) => s.videoId === planned?.videoId)) {
      const next = nextSong(queue, current.videoId, 1, list.mode === "random");
      if (!next || next.videoId === current.videoId) return;
      planned = { from: current.videoId, videoId: next.videoId };
      plannedNextRef.current = planned;
    }
    deckRef.current?.warm(planned.videoId);
  }
  warmNextRef.current = warmNext;

  // While the playlist is open, pre-load the song its Play button would start.
  function warmPlaylist(list: Playlist) {
    const currentMood = moodRef.current;
    if (!currentMood) return;
    const queue = playbackQueue(currentMood, list);
    const kept = queue.find((s) => s.videoId === plannedPlaylistRef.current);
    const pick = list.mode === "random" ? kept ?? firstSong(list, queue) : queue[0];
    plannedPlaylistRef.current = pick?.videoId ?? null;
    if (pick) scheduleWarm(() => deckRef.current?.warm(pick.videoId), 150);
  }

  function playPlaylist(list: Playlist) {
    if (!mood) return;
    activeListsRef.current[mood] = list;
    const queue = playbackQueue(mood, list);
    const planned = queue.find((s) => s.videoId === plannedPlaylistRef.current);
    const next = list.mode === "random" ? planned ?? firstSong(list, queue) : queue[0];
    plannedPlaylistRef.current = null;
    if (!next) return;
    historyRef.current = [];
    activateTrack(next, true, 0);
  }

  function closePlaylist() {
    setPlaylistOpen(false);
    plannedPlaylistRef.current = null;
    playlistOpenRef.current = false;
    scheduleWarm(() => warmNextRef.current(), 300);
  }

  useEffect(() => {
    if (!mood || !library.loaded) return;
    const stored = library.get(mood);
    if (!activeListsRef.current[mood]) activeListsRef.current[mood] = stored;
    const active = activeListsRef.current[mood] ?? stored;
    const queue = playbackQueue(mood, { ...stored, mode: active.mode, selectedIds: active.selectedIds });
    if (!queue.length) {
      deckRef.current?.pause(); setTrack(null); setPlaying(false);
      localStorage.removeItem(STORE_KEY);
    } else if (!trackRef.current || !queue.some((s) => s.videoId === trackRef.current?.videoId)) {
      const first = queue[0];
      if (first) activateTrack(first, deckRef.current?.wantsPlay ?? false);
    }
  }, [library.playlists, library.loaded, mood]);

  function togglePlay() {
    const deck = deckRef.current;
    if (!deck || !track) return;
    if (playing) {
      deck.pause();
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...track, time: currentTime, playing: false }));
    } else {
      deck.play();
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...track, time: currentTime, playing: true }));
    }
  }

  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  function seek(value: number) {
    restoreTimeRef.current = null;
    deckRef.current?.seek(value);
    setCurrentTime(value);
  }

  const theme = mood ? PLAYER_THEME : null;
  const hasTrack = Boolean(track && ready);

  return (
    <>
    <div
      data-active={mood ? "" : undefined}
      className="music-player relative w-full min-w-0 max-w-full rounded-3xl border shadow-paper backdrop-blur-md"
    >
      <div ref={containerRef} className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none" />

      <div className="px-4 pt-3.5 pb-1 2xl:px-5 2xl:pt-3.5 2xl:pb-1 flex items-center gap-2">
        <span
          className="player-icon grid place-items-center shrink-0 w-9 h-9 2xl:w-11 2xl:h-11 rounded-2xl"
        >
          <Music size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <ScrollingSongTitle title={mood && track ? track.title : "Choose a mood to play"} />
          {mood && (
            <p className="text-[10px] text-charcoal/50 truncate">
              {failed
                ? "This one can't play here, try another mood"
                : `${track ? `${track.artist} · ` : ""}${MOODS.find((m) => m.key === mood)?.label}`}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" disabled={!mood || !library.loaded} aria-label="Open mood playlist" title="Add music / playlist" onClick={() => setPlaylistOpen(true)} className="player-plus shrink-0 rounded-full hover:bg-sakura-100"><Plus /></Button>
      </div>

      {/* Mood selector */}
      <div onClickCapture={doubleClickMoodRow} onPointerLeave={() => scheduleWarm(() => warmNextRef.current(), 300)} className="select-none px-3 pt-2 pb-1 2xl:px-4 2xl:pt-2.5 2xl:pb-1 flex flex-wrap gap-1 2xl:gap-1.5">
        {MOODS.map((m) => {
          const active = mood === m.key;
          return (
            <Button variant="ghost"
              key={m.key}
              onClick={(e) => {
                // Release focus so spacebar never re-triggers this mood button.
                e.currentTarget.blur();
                if (e.detail < 2) clickMood(m.key);
              }}
              onPointerEnter={() => scheduleWarm(() => warmMood(m.key), 120)}
              title={m.label}
              data-active={active ? "" : undefined}
              className="player-chip h-auto flex items-center gap-1 rounded-full px-2 py-1 2xl:px-3 2xl:py-1.5 text-[11px] 2xl:text-xs font-medium"
            >
              <MoodGlyph mood={m.key} size={12} />
              {active && <span>{m.label}</span>}
            </Button>
          );
        })}
      </div>

      {/* Controls: play/pause, song timeline, and a small volume control on the side */}
      <div className="px-3 py-3 2xl:px-5 2xl:py-3 flex items-center gap-1.5 player-controls">
        <Button variant="ghost" size="icon" disabled={!hasTrack} aria-label="Previous song" title="Previous song" onClick={() => advance(-1)} className="w-7 h-9 shrink-0 text-sakura-600 hover:bg-sakura-100"><SkipBack /></Button>
        <Button variant="ghost" size="icon"
          onClick={togglePlay}
          disabled={!hasTrack}
          aria-label={playing ? "Pause" : "Play"}
          className={`player-play grid place-items-center w-9 h-9 2xl:w-11 2xl:h-11 rounded-full shrink-0 transition-opacity ${
            theme ? theme.accentText : "text-sakura-600"
          } disabled:opacity-40`}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </Button>

        <Button variant="ghost" size="icon" disabled={!hasTrack} aria-label="Next song" title="Next song" onClick={() => advance(1)} className="w-7 h-9 shrink-0 text-sakura-600 hover:bg-sakura-100"><SkipForward /></Button>
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <span className="w-8 text-right text-[10px] tabular-nums text-charcoal/50">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={Number.isFinite(duration) ? duration : 0}
            step={0.1}
            value={Math.min(Number.isFinite(currentTime) ? currentTime : 0, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!hasTrack}
            aria-label="Song timeline"
            className="player-range flex-1 min-w-0 h-1 cursor-pointer disabled:cursor-default"
          />
          <span className="w-8 text-[10px] tabular-nums text-charcoal/50">
            {formatTime(duration)}
          </span>
        </div>

        <div className="shrink-0 group relative">
          <Button variant="ghost" size="icon"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            className={`grid place-items-center w-7 h-7 rounded-full ${theme ? theme.accentText : "text-sakura-600"} opacity-80 hover:opacity-100 transition-opacity`}
          >
            {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </Button>
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 pb-2 origin-bottom opacity-0 scale-90 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform] group-hover:pointer-events-auto group-hover:opacity-100 group-hover:scale-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:scale-100">
            <div className="relative w-9 h-24 rounded-2xl bg-background border border-sakura-100 shadow-paper">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  if (muted && Number(e.target.value) > 0) setMuted(false);
                }}
                aria-label="Volume"
                className="player-range absolute left-1/2 top-1/2 w-20 h-1 -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    {playlistOpen && mood && <MoodPlaylist key={mood} mood={mood} playlist={library.get(mood)} onSave={(list) => library.update(mood, list)} onPlay={playPlaylist} onDraftChange={warmPlaylist} onClose={closePlaylist} error={library.error} />}
    </>
  );
}

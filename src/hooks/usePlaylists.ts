import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loadPlaylists, savePlaylist } from "@/lib/playlists.functions";
import { emptyPlaylist, type Playlist } from "@/lib/playlists";
import type { Mood } from "@/types";

export function usePlaylists() {
  const load = useServerFn(loadPlaylists);
  const save = useServerFn(savePlaylist);
  const [playlists, setPlaylists] = useState<Partial<Record<Mood, Playlist>>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(Promise.resolve());
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    load().then((rows) => {
      if (live.current) { setPlaylists(Object.fromEntries(rows.map((r) => [r.mood, r.playlist]))); setLoaded(true); }
    }).catch((e) => { if (live.current) setError(e instanceof Error ? e.message : "Your playlists couldn't be loaded."); });
    return () => { live.current = false; };
  }, [load]);
  const update = useCallback((mood: Mood, playlist: Playlist) => {
    setPlaylists((all) => ({ ...all, [mood]: playlist }));
    setError(null);
    saving.current = saving.current.catch(() => {}).then(async () => { await save({ data: { mood, playlist } }); }).catch((e) => { if (live.current) setError(e instanceof Error ? e.message : "Your playlist couldn't be saved."); });
  }, [save]);
  return { playlists, loaded, error, update, get: (mood: Mood) => playlists[mood] ?? emptyPlaylist() };
}
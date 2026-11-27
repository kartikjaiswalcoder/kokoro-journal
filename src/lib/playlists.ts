import { z } from "zod";
import { MUSIC_TRACKS, type MusicTrack } from "./music";
import type { Mood } from "@/types";

export const moodSchema = z.enum(["happy", "excited", "calm", "okay", "sad", "anxious"]);
export const songSchema = z.object({
  mood: moodSchema,
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().min(1).max(300),
  artist: z.string().max(200),
});
export const playlistSchema = z.object({
  songs: z.array(songSchema),
  selectedIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)),
  mode: z.enum(["selected", "ordered", "random"]),
  excludeDefaults: z.boolean(),
});
export type Playlist = z.infer<typeof playlistSchema>;
export function emptyPlaylist(): Playlist {
  return { songs: [], selectedIds: [], mode: "random", excludeDefaults: false };
}
export function defaultSongs(mood: Mood) {
  return MUSIC_TRACKS.filter((song) => song.mood === mood);
}
export function playlistSongs(mood: Mood, playlist: Playlist): MusicTrack[] {
  const defaults = defaultSongs(mood);
  const seen = new Set(defaults.map((s) => s.videoId));
  return [...defaults, ...playlist.songs.filter((s) => {
    if (s.mood !== mood || seen.has(s.videoId)) return false;
    seen.add(s.videoId);
    return true;
  })];
}
export function eligibleSongs(mood: Mood, playlist: Playlist) {
  return playlist.excludeDefaults ? playlistSongs(mood, playlist).filter((s) => !defaultSongs(mood).some((d) => d.videoId === s.videoId)) : playlistSongs(mood, playlist);
}
export function playbackQueue(mood: Mood, playlist: Playlist) {
  const songs = eligibleSongs(mood, playlist);
  return playlist.mode === "selected"
    ? playlist.selectedIds.flatMap((id) => songs.filter((s) => s.videoId === id))
    : songs;
}
// Song selection rules shared by clicks, taps and the keyboard.
// - Clicking a selected song deselects it; remaining order numbers re-count from 1.
// - Ctrl/Cmd or a long press ("extend") starts or continues a numbered order.
// - A plain click adds to an order already in progress; otherwise it picks just that song.
// - Deselecting every song ends the order, so the next plain click shows a single tick again.
export function toggleSelection(playlist: Playlist, id: string, ordering: boolean, extend: boolean): { playlist: Playlist; ordering: boolean } {
  const current = playlist.mode === "selected" ? playlist.selectedIds : [];
  let selectedIds: string[];
  let nextOrdering: boolean;
  if (current.includes(id)) {
    selectedIds = current.filter((x) => x !== id);
    nextOrdering = selectedIds.length > 0 && ordering;
  } else if (extend || (ordering && current.length > 0)) {
    selectedIds = [...current, id];
    nextOrdering = true;
  } else {
    selectedIds = [id];
    nextOrdering = false;
  }
  return { playlist: { ...playlist, mode: "selected", selectedIds }, ordering: nextOrdering };
}
export function selectSong(playlist: Playlist, id: string, multiple: boolean): Playlist {
  return toggleSelection(playlist, id, false, multiple).playlist;
}
export function removeSong(playlist: Playlist, id: string): Playlist {
  return { ...playlist, songs: playlist.songs.filter((s) => s.videoId !== id), selectedIds: playlist.selectedIds.filter((x) => x !== id) };
}
// True when two playlists would play and save identically (used for "Save & Play").
export function samePlaylist(a: Playlist, b: Playlist): boolean {
  const key = (p: Playlist) => JSON.stringify([p.songs.map((s) => [s.mood, s.videoId, s.title, s.artist]), p.selectedIds, p.mode, p.excludeDefaults]);
  return key(a) === key(b);
}
export function excludeDefaults(mood: Mood, playlist: Playlist, exclude: boolean): Playlist {
  const ids = new Set(defaultSongs(mood).map((s) => s.videoId));
  return { ...playlist, excludeDefaults: exclude, selectedIds: exclude ? playlist.selectedIds.filter((id) => !ids.has(id)) : playlist.selectedIds };
}
export function nextSong(queue: MusicTrack[], currentId: string | undefined, direction: number, random: boolean, rng = Math.random) {
  if (!queue.length) return undefined;
  if (random && queue.length > 1) {
    const alternatives = queue.filter((s) => s.videoId !== currentId);
    return alternatives[Math.floor(rng() * alternatives.length)];
  }
  const index = queue.findIndex((s) => s.videoId === currentId);
  return queue[(Math.max(0, index) + direction + queue.length) % queue.length];
}
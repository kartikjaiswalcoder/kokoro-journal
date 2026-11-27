import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { moodSchema, playlistSchema } from "./playlists";

export const loadPlaylists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("mood_playlists").select("mood,songs,selected_ids,playback_mode,exclude_defaults").eq("user_id", context.userId);
    if (error) throw new Error("Your playlists couldn't be loaded. Please try again.");
    return (data ?? []).map((row) => ({ mood: moodSchema.parse(row.mood), playlist: playlistSchema.parse({ songs: row.songs, selectedIds: row.selected_ids, mode: row.playback_mode, excludeDefaults: row.exclude_defaults }) }));
  });

export const savePlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ mood: moodSchema, playlist: playlistSchema }))
  .handler(async ({ data, context }) => {
    const songs = data.playlist.songs.filter((s) => s.mood === data.mood);
    const { error } = await context.supabase.from("mood_playlists").upsert({
      user_id: context.userId, mood: data.mood, songs,
      selected_ids: data.playlist.selectedIds, playback_mode: data.playlist.mode,
      exclude_defaults: data.playlist.excludeDefaults,
    }, { onConflict: "user_id,mood" });
    if (error) throw new Error("Your playlist couldn't be saved. Please try again.");
    return { ok: true };
  });

export const searchSongs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ query: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    const key = process.env['YOUTUBE_API_KEY'];
    if (!key) return { songs: [], error: "YouTube search isn't connected yet." };
    const query = new URLSearchParams({ part: "snippet", type: "video", videoCategoryId: "10", videoEmbeddable: "true", videoSyndicated: "true", maxResults: "12", q: data.query, key });
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${query}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`YouTube search failed [${response.status}]: ${body}`);
        return { songs: [], error: response.status === 403 || response.status === 429 ? "YouTube search is unavailable or its daily allowance has been reached. Try again later." : "YouTube couldn't search right now. Please try again." };
      }
      const result = z.object({ items: z.array(z.object({ id: z.object({ videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }), snippet: z.object({ title: z.string(), channelTitle: z.string() }) })) }).parse(await response.json());
      return { songs: result.items.map((item) => ({ videoId: item.id.videoId, title: item.snippet.title, artist: item.snippet.channelTitle })), error: null };
    } catch {
      return { songs: [], error: "YouTube couldn't search right now. Please try again." };
    }
  });
import type { Mood } from "@/types";

export interface MusicTrack {
  mood: Mood;
  title: string;
  artist: string;
  videoId: string;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { mood: "happy", title: "It's You", artist: "Karencici", videoId: "-aXiIcxrVWQ" },
  { mood: "excited", title: "Fly Away", artist: "teddyloid", videoId: "5lC3y4jq6V0" },
  { mood: "excited", title: "Akaza Theme", artist: "Demon Slayer S2", videoId: "hcDNCBo2e-A" },
  { mood: "calm", title: "Distant Dreamer", artist: "Duffy", videoId: "iMTbmmbn05w" },
  { mood: "okay", title: "OK", artist: "Alan Walker", videoId: "GeXIx_4_Hvo" },
  { mood: "sad", title: "Over the Rainbow", artist: "Natsumi Kiyoura", videoId: "ySh4Ibj0Sos" },
  { mood: "sad", title: "Kamado Tanjiro no Uta", artist: "Demon Slayer", videoId: "Nq5MPsZiyyk" },
  { mood: "anxious", title: "Scared of the Dark", artist: "XXXTENTACION", videoId: "n3VXN0wavq8" },
  { mood: "anxious", title: "Paranoid Android", artist: "Radiohead", videoId: "fHiGbolFFGw" },
];

export function pickTrack(mood: Mood): MusicTrack | undefined {
  const options = MUSIC_TRACKS.filter((t) => t.mood === mood);
  return options[Math.floor(Math.random() * options.length)];
}

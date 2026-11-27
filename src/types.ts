export type Mood = "happy" | "excited" | "calm" | "okay" | "sad" | "anxious";

export const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: "happy", emoji: "🌸", label: "Happy" },
  { key: "excited", emoji: "✨", label: "Excited" },
  { key: "calm", emoji: "🍃", label: "Calm" },
  { key: "okay", emoji: "☁️", label: "Okay" },
  { key: "sad", emoji: "💧", label: "Sad" },
  { key: "anxious", emoji: "⚡", label: "Anxious" },
];

export const MOOD_MAP: Record<Mood, { emoji: string; label: string }> = {
  happy: { emoji: "🌸", label: "Happy" },
  excited: { emoji: "✨", label: "Excited" },
  calm: { emoji: "🍃", label: "Calm" },
  okay: { emoji: "☁️", label: "Okay" },
  sad: { emoji: "💧", label: "Sad" },
  anxious: { emoji: "⚡", label: "Anxious" },
};

// Per-mood colors for journal entries (day tiles, notepad mood chips). These stay fixed;
// the app-wide ambient theme comes from the player mood via [data-mood-theme] instead.
// Each mood has a deliberately distinct hue family so they're easy to tell apart.
export const MOOD_THEME: Record<
  Mood,
  { dot: string; accent: string; accentText: string; tintBg: string; ring: string; label: string }
> = {
  happy: {
    dot: "bg-blossom-300",
    accent: "bg-blossom-200",
    accentText: "text-blossom-600",
    tintBg: "bg-blossom-100",
    ring: "ring-blossom-200",
    label: "Cherry blossom",
  },
  excited: {
    dot: "bg-orange-300",
    accent: "bg-orange-200",
    accentText: "text-orange-600",
    tintBg: "bg-orange-100",
    ring: "ring-orange-200",
    label: "Warm orange",
  },
  calm: {
    dot: "bg-sage-300",
    accent: "bg-sage-200",
    accentText: "text-sage-600",
    tintBg: "bg-sage-100",
    ring: "ring-sage-200",
    label: "Forest green",
  },
  okay: {
    dot: "bg-gray-400",
    accent: "bg-gray-200",
    accentText: "text-gray-500",
    tintBg: "bg-gray-200/60",
    ring: "ring-gray-300",
    label: "Soft gray",
  },
  sad: {
    dot: "bg-blue-400",
    accent: "bg-blue-200",
    accentText: "text-blue-500",
    tintBg: "bg-blue-50",
    ring: "ring-blue-200",
    label: "Quiet blue",
  },
  anxious: {
    dot: "bg-red-400",
    accent: "bg-red-200",
    accentText: "text-red-500",
    tintBg: "bg-red-100",
    ring: "ring-red-200",
    label: "Soft red",
  },
};

export interface JournalEntry {
  id: string;
  entry_date: string; // YYYY-MM-DD
  content: string;
  mood: Mood | null;
  ai_summary: string | null;
  ai_summary_created_at: string | null;
  created_at: string;
  updated_at: string;
  photos?: string[]; // storage paths, max 2
}

export type View = "journal" | "entries" | "reflections";

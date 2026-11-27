import { Zap } from "lucide-react";
import type { Mood } from "@/types";

// Renders the per-mood symbol. Anxious uses a Lucide Zap icon tinted red so it
// reads as part of the red theme (emoji glyphs can't be recolored reliably).
export function MoodGlyph({ mood, size = 14 }: { mood: Mood; size?: number }) {
  if (mood === "anxious") {
    return <Zap size={size} strokeWidth={0} className="text-red-400 fill-red-400" />;
  }
  const emoji: Record<Mood, string> = {
    happy: "🌸",
    excited: "✨",
    calm: "🍃",
    okay: "☁️",
    sad: "💧",
    anxious: "⚡",
  };
  return <span>{emoji[mood]}</span>;
}

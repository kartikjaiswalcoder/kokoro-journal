import { supabase } from "@/integrations/supabase/client";

const DEFAULT_HEADING = "Your little world";
const CACHE_KEY = "kokoro_heading";
const listeners = new Set<() => void>();

let currentHeading: string = (() => {
  try {
    return localStorage.getItem(CACHE_KEY) || DEFAULT_HEADING;
  } catch {
    return DEFAULT_HEADING;
  }
})();

export function getHeading(): string {
  return currentHeading;
}

export function subscribeHeading(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setHeading(h: string) {
  currentHeading = h;
  try {
    localStorage.setItem(CACHE_KEY, h);
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn());
}

export async function loadHeading(): Promise<void> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("custom_heading")
    
    .maybeSingle();
  if (error) return;
  if (data && data.custom_heading) {
    setHeading(data.custom_heading);
  } else {
    setHeading(DEFAULT_HEADING);
  }
}

export async function saveHeading(heading: string): Promise<void> {
  const trimmed = heading.trim() || DEFAULT_HEADING;
  const { error } = await supabase
    .from("app_settings")
    .upsert({ custom_heading: trimmed, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  setHeading(trimmed);
}

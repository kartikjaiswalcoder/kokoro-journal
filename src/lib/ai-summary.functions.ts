import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summarizeEntry } from "./summary.server";

const MOOD_KEYS = ["happy", "excited", "calm", "okay", "sad", "anxious"] as const;

export const generateSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ entry: z.string().max(20000), mood: z.enum(MOOD_KEYS).nullish() }).parse(d),
  )
  .handler(({ data }) => summarizeEntry(data.entry, data.mood ?? null));

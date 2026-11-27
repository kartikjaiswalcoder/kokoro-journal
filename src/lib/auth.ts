import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, loading };
}

export async function signOut() {
  await supabase.auth.signOut();
  try {
    ["kokoro_entries_v1", "kokoro_heading", "kokoro_longest_streak", "kokoro_photo_urls_v2"].forEach((k) =>
      localStorage.removeItem(k),
    );
    sessionStorage.removeItem("kokoro_photo_urls_v1");
  } catch {
    // ignore
  }
  window.location.reload();
}

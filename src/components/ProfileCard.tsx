import { useEffect, useRef, useState } from "react";
import { LogOut, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";

type Profile = { id: string; display_name: string | null; avatar_url: string | null; email: string | null };

let cachedProfile: Profile | null = null;

// Loads the profile using the locally stored session (no network round-trip
// for the user) and caches it so the Settings popup shows it instantly.
export async function preloadProfile(): Promise<Profile | null> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user) return null;
  const fallback: Profile = {
    id: user.id,
    display_name: (user.user_metadata?.["full_name"] as string) ?? null,
    avatar_url: (user.user_metadata?.["avatar_url"] as string) ?? null,
    email: user.email ?? null,
  };
  if (!cachedProfile || cachedProfile.id !== user.id) cachedProfile = fallback;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  cachedProfile = data ?? cachedProfile;
  return cachedProfile;
}

export default function ProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [name, setName] = useState(cachedProfile?.display_name ?? "");
  const [saved, setSaved] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearRevert() {
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = null;
  }

  // First tap asks inline; left alone, it quietly goes back after a few seconds.
  function askSignOut() {
    clearRevert();
    setConfirmingSignOut(true);
    revertTimer.current = setTimeout(() => setConfirmingSignOut(false), 4500);
  }

  function cancelSignOut() {
    clearRevert();
    setConfirmingSignOut(false);
  }

  useEffect(() => clearRevert, []);

  useEffect(() => {
    let alive = true;
    preloadProfile().then((p) => {
      if (!alive || !p) return;
      setProfile(p);
      setName((cur) => (cur && profile ? cur : p.display_name ?? ""));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: profile.id, display_name: name.trim() || null, email: profile.email, avatar_url: profile.avatar_url, updated_at: new Date().toISOString() });
    if (!error) {
      cachedProfile = { ...profile, display_name: name.trim() || null };
      window.dispatchEvent(new CustomEvent("kokoro:nickname", { detail: name.trim() }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  if (!profile) return null;
  const initial = (name || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div className="rounded-2xl bg-sakura-50/70 border border-sakura-100 p-4">
      <div className="flex items-center gap-3">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-11 h-11 rounded-full object-cover" />
        ) : (
          <span className="grid place-items-center w-11 h-11 rounded-full bg-sakura-100 text-sakura-600 font-semibold">{initial}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-charcoal truncate">{name || "Your profile"}</p>
          <p className="text-xs text-charcoal/50 truncate">{profile.email}</p>
        </div>
      </div>
      <label className="block mt-3 text-[11px] uppercase tracking-widest text-sage-500 font-semibold">Nickname</label>
      <div className="mt-1 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="flex-1 min-w-0 rounded-xl border border-sakura-100 bg-white px-3 py-1.5 text-charcoal outline-none focus:border-sakura-300"
        />
        <button onClick={save} className="grid place-items-center rounded-xl bg-sakura-100 text-sakura-600 px-3 hover:bg-sakura-200 transition-colors">
          {saved ? <Check size={16} /> : "Save"}
        </button>
      </div>
      {confirmingSignOut ? (
        <div className="mt-3 animate-fadeIn">
          <p className="text-center text-xs text-charcoal/45">Sign out of your account?</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={cancelSignOut}
              className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-sakura-100 text-charcoal/60 hover:bg-sakura-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { clearRevert(); void signOut(); }}
              className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors flex items-center justify-center gap-2"
            >
              Yes, sign out
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={askSignOut}
          className="mt-3 w-full rounded-xl px-3 py-2 text-sm font-semibold bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={15} /> Sign out
        </button>
      )}
    </div>
  );
}

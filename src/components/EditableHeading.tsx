import { useState, useRef, useEffect } from "react";
import { Pencil, Check } from "lucide-react";
import { useHeading } from "@/lib/useHeading";
import { saveHeading } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";

function useNickname() {
  const [nick, setNick] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("display_name").eq("id", u.user.id).maybeSingle();
      const fallback = (u.user.user_metadata?.["full_name"] as string | undefined) ?? "";
      if (alive) setNick((data?.display_name ?? fallback ?? "").trim());
    })();
    const onChange = (e: Event) => setNick(String((e as CustomEvent).detail ?? "").trim());
    window.addEventListener("kokoro:nickname", onChange);
    return () => {
      alive = false;
      window.removeEventListener("kokoro:nickname", onChange);
    };
  }, []);
  return nick;
}

export default function EditableHeading() {
  const heading = useHeading();
  const nickname = useNickname();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(heading);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(heading);
  }, [heading, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next === heading) return;
    setSaving(true);
    try {
      await saveHeading(next);
    } catch {
      setDraft(heading);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(heading);
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 max-w-full">
        {nickname && <span className="text-2xl sm:text-3xl font-bold text-charcoal">{nickname}!</span>}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          disabled={saving}
          maxLength={80}
          className="text-2xl sm:text-3xl font-bold text-charcoal bg-sakura-50 border border-sakura-200 rounded-xl px-3 py-1.5 outline-none focus:border-sakura-300 max-w-[min(70vw,24rem)]"
          placeholder="Your little world"
        />
        <button
          onClick={commit}
          disabled={saving}
          aria-label="Save heading"
          className="grid place-items-center w-9 h-9 rounded-xl bg-sage-500 text-white hover:bg-sage-600 transition-colors"
        >
          <Check size={16} />
        </button>
      </div>
    );
  }

  return (
    <h1 className="text-2xl sm:text-3xl font-bold text-charcoal text-balance flex items-center gap-2 group">
      <span>{nickname ? `${nickname}! ` : ""}{heading}</span>
      <button
        onClick={() => setEditing(true)}
        aria-label="Edit heading"
        className="transition-colors text-charcoal/10 group-hover:text-charcoal/30 hover:!text-sakura-500"
      >
        <Pencil size={18} />
      </button>
    </h1>
  );
}

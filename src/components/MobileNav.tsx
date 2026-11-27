import { BookHeart, ListTree, Sparkles, Settings } from "lucide-react";
import { SakuraBlossom } from "./Decor";
import type { View } from "@/types";

export default function MobileNav({
  view,
  setView,
  onSettings,
}: {
  view: View;
  setView: (v: View) => void;
  onSettings: () => void;
}) {
  const items: { key: View; label: string; icon: React.ReactNode }[] = [
    { key: "journal", label: "Journal", icon: <BookHeart size={18} /> },
    { key: "entries", label: "Entries", icon: <ListTree size={18} /> },
    { key: "reflections", label: "Reflect", icon: <Sparkles size={18} /> },
  ];
  return (
    <div className="md:hidden sticky top-0 z-30 bg-ivory-50/90 backdrop-blur-md border-b border-sakura-100">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-sakura-100 text-sakura-500">
            <SakuraBlossom size={20} className="text-sakura-500" />
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-charcoal">Kokoro</span>
            <span className="font-hand text-sage-500 text-lg">心</span>
          </div>
        </div>
        <button
          onClick={onSettings}
          aria-label="Settings"
          className="grid place-items-center w-9 h-9 rounded-xl text-charcoal/60 hover:bg-sakura-50 hover:text-sakura-600 transition-colors"
        >
          <Settings size={20} />
        </button>
      </div>
      <div className="flex gap-1 px-3 pb-2">
        {items.map((it) => {
          const active = view === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setView(it.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-all ${
                active ? "bg-sakura-100 text-sakura-700" : "text-charcoal/60"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

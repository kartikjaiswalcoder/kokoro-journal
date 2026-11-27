import { BookHeart, ListTree, Sparkles, Settings } from "lucide-react";
import { SakuraBlossom, Leaf } from "./Decor";
import type { View } from "@/types";

export default function Sidebar({
  view,
  setView,
  onSettings,
}: {
  view: View;
  setView: (v: View) => void;
  onSettings: () => void;
}) {
  const items: { key: View; label: string; icon: React.ReactNode; sub: string }[] = [
    { key: "journal", label: "My Journal", icon: <BookHeart size={18} />, sub: "Your month of memories" },
    { key: "entries", label: "All Entries", icon: <ListTree size={18} />, sub: "Every little moment" },
    { key: "reflections", label: "Reflections", icon: <Sparkles size={18} />, sub: "AI summaries you kept" },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-sakura-100 bg-ivory-50/70 backdrop-blur-sm px-5 py-7">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-11 h-11 rounded-2xl bg-sakura-100 text-sakura-500 shadow-soft">
          <SakuraBlossom size={26} className="text-sakura-500" />
        </span>
        <div className="leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-charcoal text-lg tracking-wide">Kokoro</span>
            <span className="font-hand text-sage-500 text-xl">心</span>
          </div>
          <p className="text-[11px] text-charcoal/50 font-medium">A little space to meet yourself</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-col gap-1.5">
        {items.map((it) => {
          const active = view === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setView(it.key)}
              className={`group flex items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${
                active
                  ? "bg-sakura-100 text-sakura-700 shadow-soft"
                  : "text-charcoal/70 hover:bg-sakura-50"
              }`}
            >
              <span className={`mt-0.5 ${active ? "text-sakura-500" : "text-sage-500"}`}>
                {it.icon}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">{it.label}</span>
                <span className="block text-[11px] text-charcoal/40">{it.sub}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="rounded-2xl bg-sage-50 border border-sage-100 px-4 py-3.5 flex items-start gap-2.5">
          <Leaf size={18} className="text-sage-400 mt-0.5" />
          <p className="text-[12px] leading-relaxed text-sage-600 font-medium">
            You deserve a moment for yourself. 🍃
          </p>
        </div>

        <button
          onClick={onSettings}
          className="mt-4 w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-charcoal/60 hover:bg-sakura-50 transition-colors"
        >
          <Settings size={18} className="text-sage-500" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}

import { useEffect, useState } from "react";
import { SakuraBlossom } from "./Decor";

export default function LoadingScreen() {
  const [hidden, setHidden] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setHidden(true), 2400);
    const t2 = window.setTimeout(() => setGone(true), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    // Always the default pink, whatever mood the player restores underneath.
    <div
      data-mood-theme="happy"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ivory-50 backdrop-blur-md transition-opacity duration-500 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden}
    >
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        <span className="grid place-items-center w-20 h-20 rounded-3xl bg-sakura-100 text-sakura-400 shadow-paper">
          <SakuraBlossom size={44} className="text-sakura-400" />
        </span>
        <div className="flex items-baseline gap-2.5">
          <span className="font-semibold text-charcoal text-3xl tracking-wide">Kokoro</span>
          <span className="font-hand text-sage-500 text-3xl">心</span>
        </div>
        <p className="text-sm text-charcoal/50 font-medium">A little space to meet yourself</p>
        <span className="mt-1 inline-block w-10 h-1 rounded-full bg-sakura-200 overflow-hidden">
          <span className="block h-full w-1/2 bg-sakura-400 rounded-full animate-[toastIn_1.4s_ease-in-out_infinite] translate-x-[-50%]" />
        </span>
      </div>
    </div>
  );
}

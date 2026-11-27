import { Flame, Trophy } from "lucide-react";
import { SakuraBlossom } from "./Decor";
import { currentStreak, getLongestStreak, subscribeLongestStreak } from "@/lib/store";
import { useStore } from "@/lib/useStore";
import { useEffect, useState } from "react";

const ENCOURAGEMENT: Record<number, string> = {
  0: "There's no rush. Your next page is always waiting. 🌸",
  1: "A first page. That's how every story begins. 🍃",
  7: "Seven days of making space for yourself.",
  14: "Two weeks of quiet care.",
  30: "A whole month of meeting yourself.",
};

export default function StreakBanner() {
  useStore();
  const streak = currentStreak();
  const [longest, setLongest] = useState(getLongestStreak());
  const [showLongest, setShowLongest] = useState(false);

  useEffect(() => {
    setLongest(getLongestStreak());
    return subscribeLongestStreak(() => setLongest(getLongestStreak()));
  }, []);

  const message =
    ENCOURAGEMENT[streak] ??
    (streak >= 30
      ? `${streak} days of gentle self-reflection.`
      : `${streak} days of making space for yourself.`);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-sakura-100 bg-gradient-to-br from-sakura-50 via-ivory-50 to-mint-100/60 shadow-soft px-5 sm:px-7 py-5 2xl:px-8 2xl:py-5">
      <SakuraBlossom
        size={120}
        className="absolute -right-4 -top-6 text-sakura-100 opacity-60"
      />
      <div className="relative flex items-center gap-4 2xl:gap-5">
        <span className="grid place-items-center w-14 h-14 2xl:w-16 2xl:h-16 rounded-2xl bg-white/70 border border-sakura-100 text-sakura-500 shadow-soft">
          {streak > 0 ? <Flame size={26} /> : <SakuraBlossom size={26} className="text-sakura-400" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowLongest(true)}
              className="text-2xl 2xl:text-3xl font-bold text-sakura-600 hover:text-sakura-700 transition-colors cursor-pointer underline-offset-4 hover:underline"
              title="View longest streak"
            >
              {streak}-day streak
            </button>
            <span className="text-sakura-400 text-sm">🌸</span>
          </div>
          <p className="text-sm 2xl:text-base text-charcoal/60 mt-0.5 2xl:mt-1.5 text-balance">{message}</p>
        </div>
      </div>

      {showLongest && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm animate-fadeIn p-4"
          onClick={() => setShowLongest(false)}
        >
          <div
            className="relative max-w-sm w-full rounded-3xl bg-ivory-50 border border-sakura-100 shadow-paper p-7 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <SakuraBlossom
              size={90}
              className="absolute -right-3 -top-4 text-sakura-100 opacity-60"
            />
            <div className="relative text-center">
              <span className="grid place-items-center w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-sakura-100 to-amber-100 border border-sakura-200 text-amber-500 shadow-soft mb-4">
                <Trophy size={28} />
              </span>
              <h3 className="text-xl font-bold text-charcoal">Longest streak</h3>
              <div className="mt-4 text-4xl font-bold text-sakura-600">
                {longest} {longest === 1 ? "day" : "days"}
              </div>
              <p className="mt-2 text-sm text-amber-600 font-semibold">
                Your longest run of journaling yet! 🌸
              </p>
              <button
                type="button"
                onClick={() => setShowLongest(false)}
                className="mt-5 px-5 py-2 rounded-xl bg-sakura-500 text-white text-sm font-semibold hover:bg-sakura-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

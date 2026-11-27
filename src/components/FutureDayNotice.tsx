import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { SakuraBlossom } from "./Decor";
import { formatLongDate } from "@/lib/dates";

export default function FutureDayNotice({
  dateKey,
  onClose,
}: {
  dateKey: string;
  onClose: () => void;
}) {
  const [hide, setHide] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHide(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-charcoal/30 backdrop-blur-sm transition-opacity duration-300 ${
          hide ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-sm rounded-3xl bg-white border-2 border-sakura-100 shadow-paper px-6 py-7 text-center transition-all duration-300 ${
          hide ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <SakuraBlossom size={36} className="text-sakura-200 mx-auto" />
        <div className="mt-3 grid place-items-center w-10 h-10 rounded-2xl bg-sage-50 text-sage-500 mx-auto">
          <Clock size={18} />
        </div>
        <h3 className="mt-3 text-lg font-semibold text-charcoal">
          {formatLongDate(dateKey)}
        </h3>
        <p className="mt-1.5 text-sm text-charcoal/60 leading-relaxed">
          This day has not come yet. 🌸
          <br />
          Your future page is still unfolding.
        </p>
        <button
          onClick={onClose}
          className="mt-5 rounded-full bg-sakura-100 text-sakura-700 px-5 py-2 text-sm font-semibold hover:bg-sakura-200 transition-colors"
        >
          Okay
        </button>
      </div>
    </div>
  );
}

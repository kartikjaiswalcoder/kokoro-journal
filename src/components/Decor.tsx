// Small decorative SVG components for sakura petals and leaves.

export function SakuraBlossom({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} fill="none" aria-hidden>
      <g>
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            cx="16"
            cy="9"
            rx="4.2"
            ry="7.5"
            fill="currentColor"
            transform={`rotate(${deg} 16 16)`}
            opacity="0.9"
          />
        ))}
        <circle cx="16" cy="16" r="2.4" fill="#f6d365" />
      </g>
    </svg>
  );
}

export function Leaf({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" aria-hidden>
      <path
        d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z"
        fill="currentColor"
        opacity="0.85"
      />
      <path d="M6 18C12 12 16 8 19 5" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function Clover({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" aria-hidden>
      <g fill="currentColor" opacity="0.85">
        <ellipse cx="12" cy="6" rx="4" ry="5" />
        <ellipse cx="12" cy="18" rx="4" ry="5" />
        <ellipse cx="6" cy="12" rx="5" ry="4" />
        <ellipse cx="18" cy="12" rx="5" ry="4" />
      </g>
      <circle cx="12" cy="12" r="1.4" fill="#fff" opacity="0.7" />
    </svg>
  );
}

// Falling petals background overlay.
export function PetalRain() {
  const petals = [
    { left: "8%", delay: "0s", dur: "18s", size: 14, color: "text-sakura-300" },
    { left: "22%", delay: "4s", dur: "22s", size: 10, color: "text-sakura-200" },
    { left: "38%", delay: "8s", dur: "26s", size: 16, color: "text-sakura-300" },
    { left: "54%", delay: "2s", dur: "20s", size: 11, color: "text-sage-200" },
    { left: "70%", delay: "11s", dur: "24s", size: 13, color: "text-sakura-200" },
    { left: "86%", delay: "6s", dur: "19s", size: 12, color: "text-sakura-300" },
    { left: "62%", delay: "14s", dur: "28s", size: 10, color: "text-sage-300" },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
      {petals.map((p, i) => (
        <span
          key={i}
          className={`absolute top-0 ${p.color}`}
          style={{
            left: p.left,
            animation: `petalFall ${p.dur} linear ${p.delay} infinite`,
          }}
        >
          <SakuraBlossom size={p.size} />
        </span>
      ))}
    </div>
  );
}

// LogoLoop — CSS marquee ticker, inspired by Health-Data-Wallet LogoLoop
// Props: items (array of { label, Icon }), speed (px/s default 30), gap (px default 60)
import { useRef } from 'react';

export function LogoLoop({ items = [], speed = 30, gap = 60 }) {
  const duration = items.length ? `${(items.length * 160) / speed}s` : '10s';

  const list = [...items, ...items]; // duplicate for seamless loop

  return (
    <div className="overflow-hidden w-full relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)' }}>
      <div
        className="flex whitespace-nowrap logo-loop-anim"
        style={{ animationDuration: duration, gap: `${gap}px` }}
      >
        {list.map(({ label, Icon }, i) => (
          <div key={i} className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 flex-shrink-0">
            {Icon && <Icon size={16} className="text-white/50" />}
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

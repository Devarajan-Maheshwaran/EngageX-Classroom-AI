// SpotlightCard — ported from Health-Data-Wallet (converted to JSX, removed 'use client')
// Spotlight gradient is white/neutral instead of sky-blue.
import { useRef, useState } from 'react';

export function SpotlightCard({ children, className = '' }) {
  const divRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [pos, setPos]             = useState({ x: 0, y: 0 });
  const [opacity, setOpacity]     = useState(0);

  function handleMouseMove(e) {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={() => { setIsFocused(true);  setOpacity(1); }}
      onBlur={()  => { setIsFocused(false); setOpacity(0); }}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden transition-colors hover:border-white/20 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition duration-300 z-0"
        style={{
          opacity,
          background: `radial-gradient(500px circle at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}

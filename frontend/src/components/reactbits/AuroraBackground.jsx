// AuroraBackground — ported from Health-Data-Wallet, recoloured to black/white/neutral
// Uses pure CSS animations (no framer-motion) because EngageX uses Vite+React without it.
import { useEffect, useRef } from 'react';

export function AuroraBackground({ children }) {
  return (
    <div className="relative w-full min-h-screen bg-[#030712] overflow-hidden">
      {/* blob 1 — top-left, very slow scale+rotate */}
      <div className="aurora-blob aurora-blob-1" />
      {/* blob 2 — top-right */}
      <div className="aurora-blob aurora-blob-2" />
      {/* blob 3 — bottom-center */}
      <div className="aurora-blob aurora-blob-3" />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}

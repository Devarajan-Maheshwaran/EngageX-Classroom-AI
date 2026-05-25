import { useRef, useState, useEffect } from 'react';
import VideoTile from './VideoTile';
import { useMeetingLayout } from '../../hooks/useMeetingLayout';

export default function VideoGrid({ participants, isTileView, localMuted, localCameraOff }) {
  const gridRef = useRef(null);
  const spotlightRef = useRef(null);

  // Apply state modifiers to local participant inside the grid
  const updatedParticipants = participants.map((p) => {
    if (p.isLocal) {
      return { ...p, isMuted: localMuted, isCameraOff: localCameraOff };
    }
    return p;
  });

  // Gallery layout hook
  const { cols, tileWidth, tileHeight } = useMeetingLayout(gridRef, updatedParticipants.length);

  // Spotlight active speaker sizing logic
  const [spotlightSize, setSpotlightSize] = useState({ w: 480, h: 270 });
  const activeSpeaker = updatedParticipants.find((p) => p.isSpeaking) || updatedParticipants[0];
  const otherParticipants = updatedParticipants.filter((p) => p.id !== activeSpeaker?.id);

  useEffect(() => {
    if (isTileView || !spotlightRef.current) return;
    const el = spotlightRef.current;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;

      const pad = 24;
      const maxW = width - pad;
      const maxH = height - pad;

      let w, h;
      if (maxW * (9 / 16) <= maxH) {
        w = maxW;
        h = maxW * (9 / 16);
      } else {
        h = maxH;
        w = maxH * (16 / 9);
      }

      setSpotlightSize({ w: Math.floor(w), h: Math.floor(h) });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isTileView, updatedParticipants]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      {isTileView ? (
        /* GALLERY VIEW */
        <div
          ref={gridRef}
          className="flex-1 flex items-center justify-center p-4 bg-[#202124] min-h-0"
        >
          <div
            className="grid justify-center items-center"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${tileWidth}px)`,
              gap: '8px',
            }}
          >
            {updatedParticipants.map((p) => (
              <VideoTile key={p.id} participant={p} width={tileWidth} height={tileHeight} />
            ))}
          </div>
        </div>
      ) : (
        /* SPOTLIGHT / PINNED ACTIVE SPEAKER VIEW */
        <div className="flex-1 flex flex-col min-h-0 bg-[#202124]">
          {/* Large spotlight active speaker area */}
          <div
            ref={spotlightRef}
            className="flex-1 flex items-center justify-center p-4 min-h-0"
          >
            {activeSpeaker && (
              <VideoTile
                participant={activeSpeaker}
                width={spotlightSize.w}
                height={spotlightSize.h}
              />
            )}
          </div>

          {/* Bottom thumbnails horizontal strip */}
          <div className="h-32 shrink-0 border-t border-[#3c3c3c] bg-[#1d1e20] flex items-center gap-2 px-4 overflow-x-auto custom-scroll py-2.5 select-none">
            {otherParticipants.map((p) => (
              <div key={p.id} className="shrink-0 flex items-center justify-center">
                <VideoTile participant={p} width={180} height={101} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useRef } from 'react';
import VideoTile from './VideoTile';
import { useMeetingLayout } from '../../hooks/useMeetingLayout';

export default function VideoGrid({ participants, localVideoRef }) {
  const gridRef = useRef(null);
  const { cols, tileWidth, tileHeight } = useMeetingLayout(gridRef, participants.length);

  return (
    <div ref={gridRef} className="flex-1 flex items-center justify-center p-4 bg-[#111111] min-h-0 overflow-hidden">
      <div
        className="grid justify-center items-center"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${tileWidth}px)`,
          gap: '8px',
        }}
      >
        {participants.map((participant) => (
          <VideoTile
            key={participant.id}
            participant={participant}
            width={tileWidth}
            height={tileHeight}
            videoRef={participant.isLocal ? localVideoRef : null}
            engagementScore={participant.engagementScore}
            emotionLabel={participant.emotionLabel}
            alertLevel={participant.alertLevel}
          />
        ))}
      </div>
    </div>
  );
}

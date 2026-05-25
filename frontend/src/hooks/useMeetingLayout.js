import { useState, useEffect } from 'react';

export function useMeetingLayout(gridContainerRef, participantCount) {
  const [dimensions, setDimensions] = useState({
    cols: 1,
    rows: 1,
    tileWidth: 320,
    tileHeight: 180,
  });

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    function getCols(count) {
      if (count <= 1) return 1;
      if (count <= 2) return 2;
      if (count <= 4) return 2;
      if (count <= 6) return 3;
      if (count <= 9) return 3;
      if (count <= 12) return 4;
      if (count <= 16) return 4;
      if (count <= 25) return 5;
      return 6;
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;

      const cols = getCols(participantCount);
      const rows = Math.ceil(participantCount / cols);
      const gap = 8;
      const padding = 32; // double padding buffer

      // Calculate the maximum width that fits columns
      const availWidth = Math.max(0, width - padding - (cols - 1) * gap);
      const maxWidth = availWidth / cols;

      // Calculate the maximum height that fits rows
      const availHeight = Math.max(0, height - padding - (rows - 1) * gap);
      const maxHeight = availHeight / rows;

      let tileWidth, tileHeight;
      if (maxWidth * (9 / 16) <= maxHeight) {
        tileWidth = maxWidth;
        tileHeight = maxWidth * (9 / 16);
      } else {
        tileHeight = maxHeight;
        tileWidth = maxHeight * (16 / 9);
      }

      // Safeguard sizes
      tileWidth = Math.max(120, Math.floor(tileWidth));
      tileHeight = Math.max(67, Math.floor(tileHeight));

      setDimensions({ cols, rows, tileWidth, tileHeight });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [gridContainerRef, participantCount]);

  return dimensions;
}

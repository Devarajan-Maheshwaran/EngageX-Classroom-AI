// BlurText — inspired by Health-Data-Wallet BlurText, built with CSS stagger animation
import { useEffect, useRef, useState } from 'react';

export function BlurText({ text, className = '', animateBy = 'words', direction = 'top' }) {
  const ref       = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const units = animateBy === 'words' ? text.split(' ') : text.split('');
  const translateFrom = direction === 'top' ? '-12px' : '12px';

  return (
    <span ref={ref} className={`inline-flex flex-wrap gap-x-[0.25em] ${className}`}>
      {units.map((unit, i) => (
        <span
          key={i}
          style={{
            opacity:   visible ? 1 : 0,
            filter:    visible ? 'blur(0px)' : 'blur(8px)',
            transform: visible ? 'none' : `translateY(${translateFrom})`,
            transition: `opacity 0.5s ease ${i * 0.07}s, filter 0.5s ease ${i * 0.07}s, transform 0.5s ease ${i * 0.07}s`,
          }}
        >
          {unit}
        </span>
      ))}
    </span>
  );
}

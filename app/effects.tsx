'use client';

import { useEffect, useRef, useState } from 'react';

type Ripple = { id: number; x: number; y: number };

export function Effects() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const down = (event: PointerEvent) => {
      const id = ++counter.current;
      setRipples((list) => [...list.slice(-5), { id, x: event.clientX, y: event.clientY }]);
      window.setTimeout(() => setRipples((list) => list.filter((item) => item.id !== id)), 700);
    };
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const glass = (event.target as Element | null)?.closest?.('.glass') as HTMLElement | null;
        if (!glass) return;
        const rect = glass.getBoundingClientRect();
        glass.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        glass.style.setProperty('--my', `${event.clientY - rect.top}px`);
      });
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointermove', move);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', move);
    };
  }, []);

  return <div className="ripples" aria-hidden="true">
    {ripples.map((ripple) => <span className="ripple" key={ripple.id} style={{ left: ripple.x, top: ripple.y }} />)}
  </div>;
}

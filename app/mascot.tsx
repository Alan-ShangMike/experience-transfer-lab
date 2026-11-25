'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CloudRainWind, RotateCcw } from 'lucide-react';

export type MascotMode = 'roam' | 'work' | 'parked';
type Pose = 'greet' | 'idle' | 'sway' | 'nap' | 'dribble' | 'computer';

const gifs: Record<Pose, { src: string; ms: number }> = {
  greet: { src: '/mascot/greet.gif', ms: 4000 },
  idle: { src: '/mascot/idle.gif', ms: 5000 },
  sway: { src: '/mascot/sway.gif', ms: 3000 },
  nap: { src: '/mascot/nap.gif', ms: 5000 },
  dribble: { src: '/mascot/dribble.gif', ms: 4000 },
  computer: { src: '/mascot/computer.gif', ms: 6000 },
};
const pool: Pose[] = ['idle', 'sway', 'nap', 'dribble', 'greet'];
const walkSpeed = 170;
const workSpeed = 380;

function pick(current: Pose | '') {
  const options = pool.filter((pose) => pose !== current);
  return options[Math.floor(Math.random() * options.length)];
}

type Props = { x: number | null; y: number; size: number; mode: MascotMode; onRetry: () => void; onArrive?: () => void };

export function Mascot({ x, y, size, mode, onRetry, onArrive }: Props) {
  const arrive = useRef(onArrive);
  const modeRef = useRef(mode);
  arrive.current = onArrive;
  modeRef.current = mode;
  const [placed, setPlaced] = useState(false);
  const [at, setAt] = useState({ x: x ?? 0, y, size });
  const [walk, setWalk] = useState({ moving: false, ms: 0 });
  const [heading, setHeading] = useState(1);
  const [gaze, setGaze] = useState({ face: 1, x: 0, y: 0 });
  const [pose, setPose] = useState<Pose>('greet');
  const [stamp, setStamp] = useState(0);
  const [hop, setHop] = useState(0);
  const [poke, setPoke] = useState(0);
  const [open, setOpen] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const walkTimer = useRef<number>(0);
  const greeted = useRef(false);
  const forced = useRef<Pose | null>(null);
  const body = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Object.values(gifs).forEach(({ src }) => { new Image().src = src; });
  }, []);

  useEffect(() => {
    if (x === null) return;
    const from = last.current;
    last.current = { x, y };
    if (!from) {
      setAt({ x, y, size });
      setPlaced(true);
      arrive.current?.();
      return;
    }
    const dx = x - from.x;
    const distance = Math.hypot(dx, y - from.y);
    if (distance < 6) {
      setAt({ x, y, size });
      arrive.current?.();
      return;
    }
    const speed = modeRef.current === 'work' ? workSpeed : walkSpeed;
    const ms = Math.min(5200, Math.max(900, (distance / speed) * 1000));
    if (Math.abs(dx) > 8) setHeading(dx > 0 ? 1 : -1);
    window.clearTimeout(walkTimer.current);
    setWalk({ moving: true, ms });
    setAt({ x, y, size });
    walkTimer.current = window.setTimeout(() => {
      setWalk({ moving: false, ms });
      arrive.current?.();
    }, ms + 40);
  }, [x, y, size]);

  useEffect(() => () => window.clearTimeout(walkTimer.current), []);

  useEffect(() => {
    if (walk.moving) {
      setPose('dribble');
      setStamp((value) => value + 1);
      return;
    }
    if (mode === 'work') {
      setPose('computer');
      setStamp((value) => value + 1);
      return;
    }
    const queue: Pose[] = greeted.current ? [] : ['greet', 'idle'];
    greeted.current = true;
    let timer = 0;
    const run = (next: Pose) => {
      setPose(next);
      setStamp((value) => value + 1);
      timer = window.setTimeout(() => run(queue.shift() ?? pick(next)), gifs[next].ms);
    };
    const start = forced.current ?? queue.shift() ?? pick('');
    forced.current = null;
    run(start);
    return () => window.clearTimeout(timer);
  }, [walk.moving, mode, poke]);

  useEffect(() => {
    if (mode !== 'roam' || walk.moving) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = body.current?.getBoundingClientRect();
        if (!rect) return;
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const clamp = (value: number) => Math.round(Math.max(-1, Math.min(1, value / 60)) * 8);
        setGaze((previous) => {
          const face = dx < -40 ? -1 : dx > 40 ? 1 : previous.face;
          const next = { face, x: clamp(dx), y: Math.round(clamp(dy) / 2) };
          return next.face === previous.face && next.x === previous.x && next.y === previous.y ? previous : next;
        });
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [mode, walk.moving]);

  const showBubble = open && mode === 'parked' && !walk.moving;

  useEffect(() => {
    if (!showBubble) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [showBubble]);

  useEffect(() => { if (mode !== 'parked') setOpen(false); }, [mode]);

  function activate() {
    setHop((value) => value + 1);
    if (mode === 'parked') {
      if (!walk.moving) setOpen((value) => !value);
      return;
    }
    if (mode === 'roam' && !walk.moving) {
      forced.current = 'greet';
      setPoke((value) => value + 1);
    }
  }

  const face = walk.moving ? heading : mode === 'parked' ? -1 : mode === 'work' ? 1 : gaze.face;
  const lean = mode === 'roam' && !walk.moving ? gaze : { face, x: 0, y: 0 };
  const style = {
    transform: `translate3d(${at.x}px, ${at.y}px, 0)`,
    '--walk': `${walk.ms}ms`,
    '--size': `${at.size}px`,
  } as CSSProperties;

  return (
    <div className="mascot" ref={root} data-ready={placed} data-moving={walk.moving} data-mode={mode} style={style}>
      <button className="mascot-body" ref={body} type="button" onClick={activate}
        aria-label={mode === 'parked' ? '刘看山，点击打开想法' : '刘看山'} aria-expanded={mode === 'parked' ? showBubble : undefined}>
        <span className="mascot-shadow" aria-hidden="true" />
        <span className="mascot-hop" key={hop}>
          <span className="mascot-lean" style={{ transform: `translate(${lean.x}px, ${lean.y}px)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mascot-img" key={stamp} src={gifs[pose].src} alt="" draggable={false}
              style={{ transform: `scaleX(${face})` }} />
          </span>
        </span>
      </button>
      {showBubble && <div className="thought" role="dialog" aria-label="刘看山的想法">
        <CloudRainWind className="thought-icon" size={18} aria-hidden="true" />
        <p>想换个目标，或者补充几句背景，再看一遍经验怎么迁移？</p>
        <button className="osu-button osu-small" type="button" onClick={() => { setOpen(false); onRetry(); }}>
          <span><RotateCcw size={15} aria-hidden="true" />再测一次</span>
        </button>
      </div>}
    </div>
  );
}

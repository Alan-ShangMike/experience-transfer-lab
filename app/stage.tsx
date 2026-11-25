'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { demoReport } from '@/lib/demo-report';
import { message, send } from '@/lib/client';
import type { Profile, Report } from '@/lib/transfer';
import { FormScene } from './form-scene';
import { useLabSession } from './lab/session';
import { Mascot, type MascotMode } from './mascot';
import { ReportScene } from './report-scene';

type Scene = 'landing' | 'form' | 'loading' | 'report';

const modes: Record<Scene, MascotMode> = { landing: 'roam', form: 'roam', loading: 'work', report: 'parked' };
const lines = ['正在检索相关经验', '模型正在思考，把经验拆成适用条件', '对照你的背景，判断哪些能借鉴', '快好了，正在排行动计划'];

function place(scene: Scene, vw: number, vh: number) {
  const narrow = vw < 860;
  const panelW = Math.min(980, vw - 40);
  const panelH = narrow ? Math.min(560, vh - 110) : Math.min(430, vh - 110);
  const panel = { left: (vw - panelW) / 2, top: (vh - panelH) / 2 + 10, width: panelW, height: panelH };
  if (scene === 'landing') {
    const size = narrow ? 130 : Math.min(260, panelH - 60);
    return { panel, size, x: narrow ? vw / 2 - size / 2 : panel.left + 28, y: narrow ? panel.top + 12 : panel.top + (panelH - size) / 2, formLeft: 0, formWidth: 0 };
  }
  if (scene === 'form') {
    const size = narrow ? 96 : 230;
    const formWidth = narrow ? vw - 28 : Math.min(620, vw - size - 90);
    const start = narrow ? 14 : (vw - (size + 8 + formWidth)) / 2;
    return { panel, size, x: narrow ? 14 : start, y: narrow ? 52 : Math.max(70, (vh - size) / 2), formLeft: narrow ? 14 : start + size + 8, formWidth };
  }
  if (scene === 'loading') {
    const size = narrow ? 200 : 280;
    return { panel, size, x: vw / 2 - size / 2, y: vh / 2 - size / 2 - 50, formLeft: 0, formWidth: 0 };
  }
  const size = narrow ? 100 : 140;
  return { panel, size, x: vw - size - 18, y: vh - size - 12, formLeft: 0, formWidth: 0 };
}

export function Stage() {
  const { report, setReport } = useLabSession();
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  const [scene, setScene] = useState<Scene>('landing');
  const [target, setTarget] = useState<Scene>('landing');
  const [leaving, setLeaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [demo, setDemo] = useState(false);
  const [line, setLine] = useState(0);
  const [formNotice, setFormNotice] = useState('');
  const [landed, setLanded] = useState(false);
  const analysis = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const measure = () => setView({ w: window.innerWidth, h: window.innerHeight });
    measure();
    setDemo(new URLSearchParams(window.location.search).has('demo'));
    window.addEventListener('resize', measure);
    const pending = timers.current;
    return () => {
      window.removeEventListener('resize', measure);
      analysis.current?.abort();
      pending.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (scene !== 'loading') return;
    setLine(0);
    const timer = window.setInterval(() => setLine((value) => Math.min(value + 1, lines.length - 1)), 2600);
    return () => window.clearInterval(timer);
  }, [scene]);

  const go = useCallback((next: Scene, delay: number) => {
    setTarget(next);
    setLanded(false);
    setLeaving(true);
    timers.current.push(window.setTimeout(() => {
      setScene(next);
      setLeaving(false);
    }, delay));
  }, []);

  function begin() {
    setSweeping(true);
    timers.current.push(window.setTimeout(() => setSweeping(false), 900));
    go('form', 460);
  }

  async function analyze(profile: Profile) {
    analysis.current?.abort();
    const controller = new AbortController();
    analysis.current = controller;
    go('loading', 360);
    try {
      const result = demo
        ? await new Promise<Report>((resolve) => window.setTimeout(() => resolve(demoReport(profile)), 6500))
        : await send<Report>('/api/analyze', JSON.stringify(profile), controller.signal);
      if (controller.signal.aborted) return;
      setReport(result);
      go('report', 420);
    } catch (error) {
      if (controller.signal.aborted) return;
      setFormNotice(message(error));
      go('form', 320);
    } finally {
      if (analysis.current === controller) analysis.current = null;
    }
  }

  function cancel() {
    analysis.current?.abort();
    analysis.current = null;
    setFormNotice('');
    go('form', 320);
  }

  function retry() {
    setFormNotice('');
    go('form', 380);
  }

  const veil = target === 'landing' ? 'off' : target === 'report' ? 'dim' : 'blur';
  const spot = view ? place(target, view.w, view.h) : null;
  const landing = view ? place('landing', view.w, view.h) : null;
  const narrow = Boolean(view && view.w < 860);
  const mascotSize = spot?.size ?? 0;

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <div className="veil" data-state={veil} data-sweeping={sweeping} aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-mark" aria-hidden="true" /><span>经验迁移 <b>Lab</b></span></a>
      </header>
      {view && spot && landing && <>
        {scene === 'landing' && <section className="glass landing-panel" data-leaving={leaving} aria-labelledby="intro"
          style={{ ...landing.panel, '--pad-left': narrow ? '36px' : `${landing.size + 64}px`, '--pad-top': narrow ? `${landing.size + 28}px` : '40px' } as CSSProperties}>
          <p className="kicker"><i /> 经验适用性分析</p>
          <h1 id="intro">别人的经验，<br /><em>怎么用在我身上？</em></h1>
          <p className="lead">找到他人经验背后的适用条件，把别人的做法变成适合自己的下一步，并附上能回到原文核对的依据。</p>
          <ol className="steps" aria-label="分析流程">
            <li>参考经验</li><li>适用条件</li><li>我的下一步</li>
          </ol>
          <button className="osu-button start" type="button" onClick={begin}><span>开始分析<ArrowRight size={18} /></span></button>
        </section>}
        {scene === 'form' && <FormScene left={spot.formLeft} width={spot.formWidth} demo={demo} leaving={leaving} initialNotice={formNotice} onSubmit={analyze} />}
        {scene === 'loading' && landed && <section className="loading" data-leaving={leaving} aria-live="polite"
          style={{ top: spot.y + mascotSize + 6 }}>
          <div className="loading-bar" aria-hidden="true"><i /></div>
          <p className="loading-line" key={line}>{lines[line]}<span className="dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></p>
          <p className="loading-sub">模型正在思考，通常需要十几秒到半分钟</p>
          <button className="osu-button ghost small" type="button" onClick={cancel}><span><X size={14} />取消，回到填写</span></button>
        </section>}
        {scene === 'report' && report && <ReportScene report={report} leaving={leaving} />}
        <Mascot x={spot.x} y={spot.y} size={spot.size} mode={modes[target]} onRetry={retry} onArrive={() => setLanded(true)} />
      </>}
    </>
  );
}

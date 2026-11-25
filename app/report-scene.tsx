'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChartNoAxesCombined, ShieldAlert } from 'lucide-react';
import { verdicts, type Action, type Decision, type Report, type Source } from '@/lib/transfer';
import { WordCloud } from './wordcloud';

function Citation({ source }: { source: Source }) {
  return <a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer"><BookOpen size={14} />{source.title}</a>;
}

function ActionFlow({ actions, sources }: { actions: Action[]; sources: Map<string, Source> }) {
  return (
    <ol className="flow">
      {actions.map((action, index) => {
        const source = sources.get(action.sourceId);
        return <li className="flow-step" data-stage={action.stage} key={action.stage} style={{ '--i': index } as CSSProperties}>
          <span className="flow-dot" aria-hidden="true">{index + 1}</span>
          <div className="flow-body">
            <article className="glass flow-card">
              <span className="flow-when">{action.when}</span>
              <h3>{action.title}</h3>
              <p>{action.detail}</p>
              <p className="flow-output"><strong>完成标志</strong>{action.output}</p>
              {source && <details className="flow-source"><summary>查看来源依据</summary><Citation source={source} /></details>}
            </article>
            {action.fallback && <aside className="flow-fallback" aria-label={`${action.when}的失败预案`}>
              <h4><ShieldAlert size={14} />失败预案</h4>
              <p className="trigger">{action.fallback.trigger}</p>
              <p>{action.fallback.detail}</p>
            </aside>}
          </div>
        </li>;
      })}
    </ol>
  );
}

function DecisionCarousel({ decisions, sources }: { decisions: Decision[]; sources: Map<string, Source> }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [active, setActive] = useState(0);
  const last = decisions.length - 1;

  function goTo(index: number) {
    const view = viewport.current;
    if (view) view.scrollTo({ left: Math.max(0, Math.min(index, last)) * view.clientWidth, behavior: 'smooth' });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const targets: Record<string, number> = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: last };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    goTo(targets[event.key]);
  }

  return (
    <div className="deck">
      <div className="deck-viewport" ref={viewport} tabIndex={last > 0 ? 0 : undefined} role="group" data-dragging={Boolean(drag.current?.moved)}
        aria-label="迁移判断卡片，可左右滑动或使用方向键切换" onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' || (event.target as Element).closest('a, button, summary')) return;
          drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const delta = event.clientX - state.x;
          if (Math.abs(delta) > 4) state.moved = true;
          event.currentTarget.style.scrollSnapType = 'none';
          event.currentTarget.scrollLeft = state.left - delta;
        }}
        onPointerUp={(event) => {
          const state = drag.current;
          drag.current = null;
          event.currentTarget.style.scrollSnapType = '';
          if (state?.moved) goTo(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth + (state.x - event.clientX > 40 ? .4 : state.x - event.clientX < -40 ? -.4 : 0)));
        }}
        onPointerLeave={(event) => {
          if (drag.current?.moved) goTo(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth));
          drag.current = null;
          event.currentTarget.style.scrollSnapType = '';
        }}
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget;
          if (clientWidth) setActive(Math.max(0, Math.min(last, Math.round(scrollLeft / clientWidth))));
        }}>
        {decisions.map((decision, index) => {
          const verdict = verdicts[decision.verdict];
          const source = sources.get(decision.evidence.sourceId);
          return <div className="deck-slide" key={`${decision.title}-${index}`} data-active={index === active}>
            <article className="glass deck-card" data-verdict={decision.verdict}>
              <div className="deck-head"><h3>{decision.title}</h3>
                <span className="verdict"><span aria-hidden="true">{verdict.symbol}</span>{verdict.label}</span>
              </div>
              <dl>
                <div><dt>经验条件</dt><dd>{decision.condition}</dd></div>
                <div><dt>你的情况</dt><dd>{decision.comparison}</dd></div>
                <div className="advice"><dt>迁移建议</dt><dd>{decision.advice}</dd></div>
              </dl>
              {source && <div className="deck-quote"><blockquote>{decision.evidence.quote}</blockquote><Citation source={source} /></div>}
            </article>
          </div>;
        })}
      </div>
      <div className="deck-controls">
        <button className="round-btn" type="button" disabled={active === 0} onClick={() => goTo(active - 1)} aria-label="上一张"><ChevronLeft size={20} /></button>
        <div className="dots-nav" role="status" aria-label={`第 ${active + 1} 张，共 ${decisions.length} 张`}>
          {decisions.map((decision, index) => <button key={index} type="button" data-on={index === active} onClick={() => goTo(index)} aria-label={`第 ${index + 1} 张：${decision.title}`} />)}
        </div>
        <button className="round-btn" type="button" disabled={active === last} onClick={() => goTo(active + 1)} aria-label="下一张"><ChevronRight size={20} /></button>
      </div>
    </div>
  );
}

export function ReportScene({ report, leaving }: { report: Report; leaving: boolean }) {
  const page = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const { goal, hours, weeks } = report.profile;
  const sources = new Map(report.sources.map((source) => [source.id, source]));

  useEffect(() => {
    const inner = flow.current;
    const outer = page.current;
    if (!inner || !outer) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const bottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 2;
      const top = inner.scrollTop <= 0;
      if ((event.deltaY > 0 && bottom) || (event.deltaY < 0 && top)) {
        event.preventDefault();
        outer.scrollBy({ top: event.deltaY });
      }
    };
    const update = () => setAtEnd(inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 2);
    inner.addEventListener('wheel', wheel, { passive: false });
    inner.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      inner.removeEventListener('wheel', wheel);
      inner.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div className="report" data-leaving={leaving} ref={page}>
      <section className="report-top" aria-label="分析概览">
        <div className="report-left">
          <header className="report-title">
            <p className="kicker"><i />经验迁移报告</p>
            <h1>{goal}</h1>
            <p className="meta">{report.sources.length} 条参考来源{hours && weeks ? ` · ${hours * weeks} 小时准备预算` : ''}</p>
          </header>
          <div className="glass cloud-card">
            <h2>参考资料中的高频词</h2>
            <WordCloud report={report} />
          </div>
        </div>
        <div className="report-right">
          <h2 className="flow-heading">行动计划<span>在这里滚动，到底后继续滚动会翻页</span></h2>
          <div className="flow-scroll" ref={flow} tabIndex={0} role="region" aria-label="行动计划流程图，可滚动">
            <ActionFlow actions={report.actions} sources={sources} />
          </div>
          <button className="next-hint" type="button" data-on={atEnd} aria-label="查看迁移判断"
            onClick={() => page.current?.scrollTo({ top: page.current.scrollHeight, behavior: 'smooth' })}><ChevronDown size={16} />迁移判断</button>
        </div>
      </section>
      <section className="report-bottom" aria-labelledby="decisions">
        <header>
          <h2 id="decisions">迁移判断</h2>
          <div className="glass summary"><ChartNoAxesCombined size={18} /><p>{report.summary}</p></div>
        </header>
        <DecisionCarousel decisions={report.decisions} sources={sources} />
      </section>
    </div>
  );
}

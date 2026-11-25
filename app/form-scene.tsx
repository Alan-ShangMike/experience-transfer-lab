'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, Play, Plus, Sparkles } from 'lucide-react';
import { activeConflicts, availableSuggestions, completeBackground } from '@/lib/background';
import { message, readDraft, send } from '@/lib/client';
import type { Profile, SuggestionBatch } from '@/lib/transfer';
import { useLabSession, type Draft } from './lab/session';

const inputDelay = 1500;
const backgroundLimit = 600;

type Props = { left: number; width: number; demo: boolean; leaving: boolean; initialNotice: string; onSubmit: (profile: Profile) => void };

export function FormScene({ left, width, demo, leaving, initialNotice, onSubmit }: Props) {
  const { draft, setDraft, hints, setHints } = useLabSession();
  const [isComposing, setIsComposing] = useState(false);
  const [loadingQuery, setLoadingQuery] = useState('');
  const [notice, setNotice] = useState(initialNotice);
  const profile = readDraft(draft);
  const { background } = profile;
  const query = JSON.stringify(profile);
  const hasInput = Boolean(profile.goal || background);
  const lastAttempted = useRef(query);
  const backgroundField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!hasInput) lastAttempted.current = query;
    if (demo || isComposing || !hasInput || query === lastAttempted.current) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      lastAttempted.current = query;
      setLoadingQuery(query);
      try {
        const result = await send<SuggestionBatch>('/api/suggestions', query, controller.signal);
        if (controller.signal.aborted) return;
        setHints((previous) => ({
          query,
          suggestions: result.suggestions,
          conflicts: [...activeConflicts(previous?.conflicts ?? [], background), ...(result.conflicts ?? [])],
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setHints((previous) => ({
          query,
          suggestions: previous?.query === query ? previous.suggestions : [],
          conflicts: activeConflicts(previous?.conflicts ?? [], background),
          error: message(error),
        }));
      } finally {
        if (!controller.signal.aborted) setLoadingQuery('');
      }
    }, inputDelay);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      setLoadingQuery('');
    };
  }, [background, demo, hasInput, isComposing, query, setHints]);

  function update(field: keyof Draft, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setNotice('');
  }

  function insert(option: string) {
    const next = completeBackground(draft.background, option);
    if (next.length > backgroundLimit) {
      setNotice('背景最多 600 字。请先删减一些内容，再补入选项。');
      return;
    }
    const nextDraft = { ...draft, background: next };
    setDraft(nextDraft);
    setHints((previous) => previous?.query === query ? { ...previous, query: JSON.stringify(readDraft(nextDraft)), error: undefined } : previous);
    setNotice('');
    backgroundField.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!background) {
      setNotice('补充几句背景，也可以点选一个建议来填入。');
      return;
    }
    setNotice('');
    onSubmit(profile);
  }

  const available = hints?.query === query && hasInput ? availableSuggestions(hints, background) : [];
  const hintError = hints?.query === query ? hints.error : undefined;
  const hintsReceived = hints?.query === query;
  const loading = loadingQuery === query;

  return (
    <div className="form-wrap" data-leaving={leaving}>
      <form className="glass form-panel" style={{ marginLeft: left, width }} onSubmit={submit}
        onCompositionStart={() => setIsComposing(true)} onCompositionEnd={() => setIsComposing(false)}>
        <header className="form-head">
          <h2>先说说你的情况</h2>
          <p>目标和背景越具体，迁移判断越贴近你。</p>
        </header>
        <label className="field" style={{ '--i': 0 } as React.CSSProperties}><span>我想做到什么</span>
          <input value={draft.goal} onChange={(event) => update('goal', event.target.value)} minLength={4} maxLength={120} required placeholder="例如，六周内准备好英文面试" />
        </label>
        <label className="field" style={{ '--i': 1 } as React.CSSProperties}><span>我的背景</span>
          <textarea ref={backgroundField} value={draft.background} onChange={(event) => update('background', event.target.value)} maxLength={backgroundLimit} rows={4} placeholder="写一写你目前的经历、已有技能或遇到的限制" />
        </label>
        <div className="hint-panel" aria-labelledby="hint-title" data-busy={loading}>
          <div className="hint-heading"><Sparkles size={15} /><h3 id="hint-title">实时背景提示</h3><i className="pulse" aria-hidden="true" /></div>
          {available.length > 0 && <div className="chip-row" aria-label="推荐选项">
            {available.map((value, index) => <button type="button" className="chip" key={value} style={{ '--i': index } as React.CSSProperties} onClick={() => insert(value)}><Plus size={13} />{value}</button>)}
          </div>}
          <p className="hint-status" role="status">
            {loading ? '正在根据你的输入生成提示…' : hintError ? `提示暂不可用。${hintError}` :
              available.length ? '点选后会补进背景，可直接修改。' : hintsReceived ?
                '暂时没有更多选项，可以继续补充背景。' : demo ? '演示模式：不请求实时提示。' : '输入目标或背景，稍停一下就会出现相关选项。'}
          </p>
        </div>
        <div className="field-pair">
          <label className="field"><span><Clock3 size={13} /> 每周投入（选填）</span>
            <span className="number-field"><input type="number" min={1} max={80} value={draft.hours} onChange={(event) => update('hours', event.target.value)} /><span>小时</span></span>
          </label>
          <label className="field"><span><CalendarDays size={13} /> 准备期（选填）</span>
            <span className="number-field"><input type="number" min={1} max={104} value={draft.weeks} onChange={(event) => update('weeks', event.target.value)} /><span>周</span></span>
          </label>
        </div>
        {notice && <p className="notice" role="alert" key={notice}>{notice}</p>}
        <div className="form-foot">
          <p>填写内容用于生成提示和报告，目标也会用于检索参考资料。</p>
          <button className="osu-button" type="submit"><span><Play size={15} fill="currentColor" />生成迁移报告</span></button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useMemo, type CSSProperties } from 'react';
import type { Report } from '@/lib/transfer';

const stopWords = new Set((
  '我们 你们 他们 自己 没有 不是 什么 怎么 可能 通常 比较 一些 这个 那个 已经 需要 以及 之后 之前 通过 进行 其中 如何 不要 为什么 ' +
  '可以 如果 所以 因为 然后 但是 而且 或者 还是 就是 一个 这样 那样 这些 那些 时候 一定 非常 直接 重点 同样 每天 每次 先后'
).split(' '));
const stopChars = new Set([...'的了是在和与或并及对不有也都就把被让将要还再先后而但这那你我他她它们个之为以上下中']);
const palette = ['#a9bbff', '#d2b3ff', '#ff97c8', '#85dcff', '#98f2d8', '#ffdc92'];
const width = 640;
const height = 520;

type Entry = { word: string; count: number };
type Placed = Entry & { left: number; top: number; size: number; color: string };

function split(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
    return [...segmenter.segment(text)].filter((part) => part.isWordLike).map((part) => part.segment);
  }
  return (text.match(/[\u4e00-\u9fff]+/gu) ?? []).flatMap((run) => run.length < 3 ? [run] : [...run].slice(0, -1).map((_, index) => run.slice(index, index + 2)));
}

function keep(word: string) {
  if (/^[\d.]+$/u.test(word) || stopWords.has(word)) return false;
  if (/^[\x00-\x7f]+$/u.test(word)) return word.length >= 3;
  return word.length >= 2 && ![...word].every((char) => stopChars.has(char));
}

export function keywords(report: Report, limit = 30): Entry[] {
  const counts = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const raw of split(text)) {
      const word = raw.toLowerCase();
      if (keep(word)) counts.set(word, (counts.get(word) ?? 0) + weight);
    }
  };
  for (const source of report.sources) {
    add(source.title, 3);
    add(source.excerpt, 1);
  }
  for (const decision of report.decisions) add(decision.evidence.quote, 2);
  return [...counts].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, limit);
}

function layout(entries: Entry[]): Placed[] {
  if (!entries.length) return [];
  const max = entries[0].count;
  const min = entries[entries.length - 1].count;
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const out: Placed[] = [];
  entries.forEach((entry, index) => {
    const size = 24 + ((entry.count - min) / (max - min || 1)) ** 0.8 * 46;
    const han = /[\u4e00-\u9fff]/u.test(entry.word);
    const w = entry.word.length * size * (han ? 1.02 : .58) + 10;
    const h = size * 1.3;
    const phase = index * 2.4;
    for (let t = 0; t < 900; t += 1) {
      const angle = phase + t * .24;
      const radius = 2 + t * .42;
      const x = width / 2 + Math.cos(angle) * radius * 1.35 - w / 2;
      const y = height / 2 + Math.sin(angle) * radius - h / 2;
      if (x < 4 || y < 4 || x + w > width - 4 || y + h > height - 4) continue;
      if (boxes.some((box) => x < box.x + box.w && x + w > box.x && y < box.y + box.h && y + h > box.y)) continue;
      boxes.push({ x, y, w, h });
      out.push({ ...entry, left: x / width * 100, top: y / height * 100, size: size / width * 100, color: palette[index % palette.length] });
      break;
    }
  });
  return out;
}

export function WordCloud({ report }: { report: Report }) {
  const words = useMemo(() => layout(keywords(report)), [report]);
  if (!words.length) return <p className="cloud-empty">来源里暂时没有可提取的关键词。</p>;
  return <div className="cloud" role="list" aria-label="从参考资料提取的高频词">
    {words.map((item, index) => <span className="cloud-word" role="listitem" key={item.word} title={`${item.word} · 权重 ${item.count}`}
      style={{ left: `${item.left}%`, top: `${item.top}%`, fontSize: `${item.size}cqw`, '--c': item.color, '--i': index, '--f': `${5 + (index % 5)}s` } as CSSProperties}>
      <span>{item.word}</span>
    </span>)}
  </div>;
}

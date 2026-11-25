export type Profile = {
  goal: string;
  background: string;
  conditions: string[];
  hours: number | null;
  weeks: number | null;
};

export type SuggestionConflict = [string, string];

export type SuggestionBatch = {
  suggestions: string[];
  conflicts: SuggestionConflict[];
};

export type Source = {
  id: string;
  title: string;
  url: string;
  author?: string;
  kind: string;
  excerpt: string;
};

export type Evidence = { sourceId: string; quote: string };
export type Verdict = 'reuse' | 'adapt' | 'hold' | 'unknown';

export type Decision = {
  title: string;
  verdict: Verdict;
  condition: string;
  comparison: string;
  advice: string;
  evidence: Evidence;
};

export type Action = {
  stage: 'now' | 'short' | 'before' | 'after';
  when: string;
  title: string;
  detail: string;
  output: string;
  sourceId: string;
  fallback?: { trigger: string; detail: string };
};

export type Report = {
  mode: 'live';
  summary: string;
  profile: Profile;
  decisions: Decision[];
  actions: Action[];
  sources: Source[];
};

export const verdicts: Record<Verdict, { label: string; symbol: string }> = {
  reuse: { label: '可借鉴', symbol: '✓' },
  adapt: { label: '需调整', symbol: '≈' },
  hold: { label: '暂不照搬', symbol: '–' },
  unknown: { label: '待确认', symbol: '?' },
};

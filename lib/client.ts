import type { Profile } from './transfer';

export type DraftFields = { goal: string; background: string; hours: string; weeks: string };

export function readDraft(draft: DraftFields): Profile {
  return {
    goal: draft.goal.trim(),
    background: draft.background.trim(),
    hours: draft.hours === '' ? null : Number(draft.hours),
    weeks: draft.weeks === '' ? null : Number(draft.weeks),
    conditions: [],
  };
}

export async function send<T>(path: string, body: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || '服务暂时不可用，请重试。');
  return payload;
}

export function message(error: unknown) {
  return error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError)
    ? error.message
    : '服务暂时不可用，请稍后重试。';
}

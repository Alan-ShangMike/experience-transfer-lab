'use client';

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Report, SuggestionBatch } from '@/lib/transfer';

export type Draft = { goal: string; background: string; hours: string; weeks: string };
type Hints = SuggestionBatch & { query: string; error?: string };
type Session = {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  hints: Hints | null;
  setHints: Dispatch<SetStateAction<Hints | null>>;
  report: Report | null;
  setReport: Dispatch<SetStateAction<Report | null>>;
};

const LabContext = createContext<Session | null>(null);

export function LabSession({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({ goal: '', background: '', hours: '', weeks: '' });
  const [hints, setHints] = useState<Hints | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  return <LabContext.Provider value={{ draft, setDraft, hints, setHints, report, setReport }}>{children}</LabContext.Provider>;
}

export function useLabSession() {
  const session = useContext(LabContext);
  if (!session) throw new Error('The lab session must wrap its pages.');
  return session;
}

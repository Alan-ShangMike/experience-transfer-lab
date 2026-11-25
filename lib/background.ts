import type { SuggestionBatch, SuggestionConflict } from './transfer';

const separator = /[，、。；！？,;!?\r\n]+/u;

function clauses(background: string) {
  return new Set(background.split(separator).map((part) => part.trim()));
}

export function completeBackground(background: string, option: string) {
  if (!background.trim()) return option;
  if (/\r?\n[ \t]*$/u.test(background)) return `${background}${option}`;
  const text = background.trimEnd();
  return `${text}${separator.test(text.slice(-1)) ? '' : '，'}${option}`;
}

export function activeConflicts(conflicts: SuggestionConflict[], background: string) {
  const entered = clauses(background);
  return conflicts.filter(([left, right]) => entered.has(left) || entered.has(right));
}

export function availableSuggestions({ suggestions, conflicts }: SuggestionBatch, background: string) {
  const entered = clauses(background);
  const hidden = new Set(entered);
  for (const [left, right] of conflicts) {
    if (entered.has(left)) hidden.add(right);
    if (entered.has(right)) hidden.add(left);
  }
  return suggestions.filter((option) => !hidden.has(option));
}

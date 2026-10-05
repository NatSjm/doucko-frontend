import type { components } from '@/api/generated/schema';
import type { Answers, AttemptResult, ChildTask } from './api';

type S = components['schemas'];

/**
 * The task screen's view model (practice-flow "Two attempts, then reveal", "Save and resume"). Every
 * part's state is derived from what the server stored — `TaskView.state`, `attemptsUsed` and
 * `lastFeedback` — so a reload and a live answer render the same (FR-31). Pure functions only.
 */
export type PartStatus = 'idle' | 'correct' | 'wrong' | 'revealed';

export interface PartState {
  status: PartStatus;
  /** Locked as correct, resolved or revealed: the child cannot change it any more. */
  readOnly: boolean;
  /** The value a correct part shows when nothing was typed in this page (after a reload). */
  storedValue: string | string[] | null;
  /** The correct answer, once revealed. */
  revealed: string | string[] | null;
}

/** The longest answer a typed part takes (practice-flow "Oversized input": 100 code points). */
export const MAX_ANSWER_CODE_POINTS = 100;

export const isChoice = (part: S['PartView']): boolean => part.type === 'CHOICE_SINGLE' || part.type === 'CHOICE_MULTI';

/** The options of a choice part (none for a typed part). */
export const optionsOf = (part: S['PartView']): NonNullable<S['PartView']['options']> => part.options ?? [];

/** A decimal point between digits written as the Czech decimal comma (12.5 → 12,5). */
export function czechNumber(value: string): string {
  return value.replace(/(\d)\.(\d)/g, '$1,$2');
}

/** A normalized value as the part shows it: option keys for a choice, a Czech number otherwise. */
function shown(part: S['PartView'], normalized: string | null): string | string[] | null {
  if (normalized === null) return null;
  if (isChoice(part)) {
    const keys = new Set(optionsOf(part).map((o) => o.key));
    return normalized.split(/[\s,;]+/).filter((k) => keys.has(k));
  }
  return part.type === 'TEXT' ? normalized : czechNumber(normalized);
}

export function partStates(task: ChildTask): Record<string, PartState> {
  const feedback = task.lastFeedback;
  const revealed = task.state === 'REVEALED';
  const resolved = task.state !== 'UNRESOLVED';
  return Object.fromEntries(
    task.parts.map((part) => {
      const result = feedback?.status === 'GRADED' ? feedback.parts.find((r) => r.key === part.key) : undefined;
      const answer = revealed ? (feedback?.feedback?.revealedAnswers?.find((r) => r.key === part.key)?.answer ?? null) : null;
      let state: PartState;
      if (result?.verdict === 'CORRECT' || (resolved && !revealed))
        state = { status: 'correct', readOnly: true, storedValue: shown(part, result?.normalized ?? null), revealed: answer };
      else if (revealed) state = { status: 'revealed', readOnly: true, storedValue: null, revealed: answer };
      else if (result?.verdict === 'WRONG') state = { status: 'wrong', readOnly: false, storedValue: null, revealed: null };
      else state = { status: 'idle', readOnly: false, storedValue: null, revealed: null };
      return [part.key, state];
    }),
  );
}

/** The parts the child can still answer (not locked, not resolved). */
const openParts = (task: ChildTask) => {
  const states = partStates(task);
  return task.parts.filter((part) => !states[part.key].readOnly);
};

/** The submission: every open part, typed parts as text, choice parts as option keys (OQ-11 omits locked parts). */
export function answersToSend(task: ChildTask, values: Answers): Answers {
  return Object.fromEntries(
    openParts(task).map((part) => {
      const value = values[part.key];
      if (isChoice(part)) return [part.key, Array.isArray(value) ? value : []];
      return [part.key, typeof value === 'string' ? value : ''];
    }),
  );
}

/** Open parts with nothing in them: they are refused on the screen and nothing is sent. */
export function emptyParts(task: ChildTask, values: Answers): string[] {
  return openParts(task)
    .filter((part) => {
      const value = values[part.key];
      return Array.isArray(value) ? value.length === 0 : !value?.trim();
    })
    .map((part) => part.key);
}

/** At most `max` Unicode code points (an emoji counts once), as the inputs take them. */
export function clampCodePoints(value: string, max = MAX_ANSWER_CODE_POINTS): string {
  const points = [...value];
  return points.length > max ? points.slice(0, max).join('') : value;
}

/** An answer as the child reads it: options by key and text, numbers with the decimal comma; none is empty. */
export function answerText(part: S['PartView'], answer: string | string[] | null): string {
  if (answer === null) return '';
  const values = Array.isArray(answer) ? answer : [answer];
  if (isChoice(part))
    return values
      .map((key) => {
        const option = optionsOf(part).find((o) => o.key === key);
        return option ? `${key} – ${option.text.cs}` : key;
      })
      .join(', ');
  return values.map((v) => (part.type === 'TEXT' ? v : czechNumber(v))).join(', ');
}

/** The task after the server's answer: a graded attempt moves attempts, state and stored feedback; UNPARSEABLE changes nothing (FR-22). */
export function applyResult(task: ChildTask, result: AttemptResult): ChildTask {
  if (result.status !== 'GRADED') return task;
  // A GRADED result always carries its attempt number (contract: null exactly when UNPARSEABLE).
  return { ...task, attemptsUsed: result.attemptNo as number, state: result.taskState, lastFeedback: result };
}

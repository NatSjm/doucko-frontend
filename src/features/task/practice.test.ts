// @trace FR-26
// @trace FR-27
// @trace FR-22
// @trace FR-31
import { describe, expect, it } from 'vitest';
import type { AttemptResult, ChildTask } from './api';
import { answersToSend, answerText, applyResult, clampCodePoints, czechNumber, emptyParts, isChoice, optionsOf, partStates } from './practice';

const text = (cs: string) => ({ cs, secondary: null });

/** A self-authored two-part task (a typed, b choice) with nothing tried yet. */
const TASK: ChildTask = {
  taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000201',
  missionId: 'ffffffff-ffff-4fff-8fff-000000000201',
  position: 1,
  prompt: text('Doplň.'),
  translationAvailable: false,
  images: [],
  parts: [
    { key: 'a', label: text('a'), type: 'DECIMAL', unit: null },
    { key: 'b', label: text('b'), type: 'CHOICE_MULTI', options: [{ key: 'A', text: text('0,7') }, { key: 'B', text: text('2') }] },
  ],
  hints: { total: 0, opened: [] },
  maxAttempts: 2,
  attemptsUsed: 0,
  state: 'UNRESOLVED',
  lastFeedback: null,
};

function graded(attemptNo: number, a: 'CORRECT' | 'WRONG', b: 'CORRECT' | 'WRONG', state: ChildTask['state'], extra: Partial<AttemptResult> = {}): AttemptResult {
  return {
    status: 'GRADED',
    attemptNo,
    parts: [
      { key: 'a', verdict: a, normalized: '12.5', formatTip: null, locked: attemptNo === 2 && a === 'CORRECT' },
      { key: 'b', verdict: b, normalized: 'A,B', formatTip: null, locked: false },
    ],
    taskState: state,
    attemptsLeft: 2 - attemptNo,
    xpAwarded: 0,
    bonusXp: 0,
    completedMissionIds: [],
    feedback: { nextHintIndex: null, revealedAnswers: null },
    rankUp: null,
    missionComplete: false,
    ...extra,
  };
}

const after = (result: AttemptResult): ChildTask => ({ ...TASK, attemptsUsed: result.attemptNo ?? 0, state: result.taskState, lastFeedback: result });

describe('part states from the stored task (FR-27, FR-31)', () => {
  it('leaves every part editable before the first attempt', () => {
    expect(partStates(TASK)).toEqual({
      a: { status: 'idle', readOnly: false, storedValue: null, revealed: null },
      b: { status: 'idle', readOnly: false, storedValue: null, revealed: null },
    });
  });

  it('locks a part correct on attempt 1 with its stored value and leaves the wrong part editable', () => {
    const states = partStates(after(graded(1, 'CORRECT', 'WRONG', 'UNRESOLVED')));
    expect(states.a).toEqual({ status: 'correct', readOnly: true, storedValue: '12,5', revealed: null });
    expect(states.b).toEqual({ status: 'wrong', readOnly: false, storedValue: null, revealed: null });
  });

  it('locks every part of a task resolved as correct', () => {
    const states = partStates(after(graded(2, 'CORRECT', 'CORRECT', 'CORRECT_SECOND_TRY')));
    expect(states.a.status).toBe('correct');
    expect(states.b).toEqual({ status: 'correct', readOnly: true, storedValue: ['A', 'B'], revealed: null });
  });

  it('reveals every part after the second wrong attempt, keeping a correct part correct', () => {
    const revealedAnswers = [
      { key: 'a', answer: '12.5' },
      { key: 'b', answer: ['A'] },
    ];
    const states = partStates(after(graded(2, 'CORRECT', 'WRONG', 'REVEALED', { feedback: { nextHintIndex: null, revealedAnswers } })));
    expect(states.a).toEqual({ status: 'correct', readOnly: true, storedValue: '12,5', revealed: '12.5' });
    expect(states.b).toEqual({ status: 'revealed', readOnly: true, storedValue: null, revealed: ['A'] });
  });

  it('a resolved task without stored feedback still locks its parts, with nothing to show in them', () => {
    expect(partStates({ ...TASK, attemptsUsed: 1, state: 'CORRECT_FIRST_TRY' }).a).toEqual({ status: 'correct', readOnly: true, storedValue: null, revealed: null });
  });

  it('a correct text part shows its normalized value as it is', () => {
    const text: ChildTask = { ...TASK, parts: [{ key: 'a', label: { cs: 'a', secondary: null }, type: 'TEXT' }] };
    const result = { ...graded(1, 'CORRECT', 'CORRECT', 'CORRECT_FIRST_TRY'), parts: [{ key: 'a', verdict: 'CORRECT' as const, normalized: 'jedna.desetina', formatTip: null, locked: false }] };
    expect(partStates({ ...text, attemptsUsed: 1, state: 'CORRECT_FIRST_TRY', lastFeedback: result }).a.storedValue).toBe('jedna.desetina');
  });

  it('reveals with an empty answer when the server sent none for a part', () => {
    const states = partStates(after(graded(2, 'WRONG', 'WRONG', 'REVEALED', { feedback: null })));
    expect(states.a).toEqual({ status: 'revealed', readOnly: true, storedValue: null, revealed: null });
  });
});

describe('what a submission sends (FR-26, FR-27)', () => {
  it('sends every part, typed parts as text and choice parts as option keys', () => {
    expect(answersToSend(TASK, { a: '12,5', b: ['B', 'A'] })).toEqual({ a: '12,5', b: ['B', 'A'] });
    expect(answersToSend(TASK, {})).toEqual({ a: '', b: [] });
  });

  it('leaves out a part locked as correct (OQ-11)', () => {
    expect(answersToSend(after(graded(1, 'CORRECT', 'WRONG', 'UNRESOLVED')), { a: '12,5', b: ['A'] })).toEqual({ b: ['A'] });
  });

  it('finds the empty parts that still need an answer', () => {
    expect(emptyParts(TASK, { a: '  ', b: [] })).toEqual(['a', 'b']);
    expect(emptyParts(TASK, { a: '1', b: ['A'] })).toEqual([]);
    expect(emptyParts(after(graded(1, 'CORRECT', 'WRONG', 'UNRESOLVED')), {})).toEqual(['b']);
  });

  it('tells choice parts from typed ones', () => {
    expect(TASK.parts.map(isChoice)).toEqual([false, true]);
  });
});

describe('input and display helpers', () => {
  it('keeps at most 100 code points, counting an emoji once', () => {
    expect(clampCodePoints('x'.repeat(150))).toHaveLength(100);
    expect([...clampCodePoints('😀'.repeat(150))]).toHaveLength(100);
    expect(clampCodePoints('5,2')).toBe('5,2');
    expect(clampCodePoints('abcdef', 3)).toBe('abc');
  });

  it('writes a decimal point as the Czech comma', () => {
    expect(czechNumber('0.75')).toBe('0,75');
    expect(czechNumber('-12.5 cm')).toBe('-12,5 cm');
    expect(czechNumber('1250')).toBe('1250');
    expect(czechNumber('3/4')).toBe('3/4');
  });

  it('shows an answer as the child would read it', () => {
    expect(answerText(TASK.parts[0], '12.5')).toBe('12,5');
    expect(answerText(TASK.parts[1], ['A', 'B'])).toBe('A – 0,7, B – 2');
    expect(answerText(TASK.parts[1], ['Z'])).toBe('Z');
    expect(answerText({ key: 't', label: text('t'), type: 'TEXT' }, 'a.b')).toBe('a.b');
    expect(answerText(TASK.parts[0], ['1.5'])).toBe('1,5');
    expect(answerText(TASK.parts[0], null)).toBe('');
  });

  it('lists the options of a choice part and none of a typed part', () => {
    expect(optionsOf(TASK.parts[1]).map((o) => o.key)).toEqual(['A', 'B']);
    expect(optionsOf(TASK.parts[0])).toEqual([]);
  });
});

describe('applying an answer to the task (FR-22, FR-27)', () => {
  it('a graded result moves the attempts, the state and the stored feedback', () => {
    const result = graded(1, 'CORRECT', 'WRONG', 'UNRESOLVED');
    expect(applyResult(TASK, result)).toEqual({ ...TASK, attemptsUsed: 1, state: 'UNRESOLVED', lastFeedback: result });
  });

  it('an unreadable submission changes nothing (no attempt used)', () => {
    const result: AttemptResult = {
      ...graded(1, 'WRONG', 'WRONG', 'UNRESOLVED'),
      status: 'UNPARSEABLE',
      attemptNo: null,
      parts: [{ key: 'a', verdict: 'UNPARSEABLE', normalized: null, formatTip: 'Zkus třeba 5,2.', locked: false }],
      attemptsLeft: 2,
      feedback: null,
    };
    expect(applyResult(TASK, result)).toBe(TASK);
  });
});

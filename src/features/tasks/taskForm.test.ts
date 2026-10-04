// @trace FR-3
// @trace FR-6
// @trace FR-7
// @trace FR-8
import { describe, expect, it } from 'vitest';
import type { components } from '@/api/generated/schema';
import { emptyTaskForm, fromAdminTask, move, newPart, stickyForm, toTaskInput, type TaskForm } from './taskForm';

type AdminTask = components['schemas']['AdminTask'];

const SOURCE = '11111111-1111-4111-8111-111111111111';
/** The contract defaults of the spec flags; every spec carries them (generated types require them). */
const FLAGS = { allowEquivalent: true, requireLowestTerms: false, unitRequired: true, diacriticsStrict: false };
/** What a spec sends for the fields its type does not use. */
const BASE = { tolerance: null, exactDecimals: null, ...FLAGS };
const TOPIC = '33333333-3333-4333-8333-000000000001';

function filled(): TaskForm {
  const form = emptyTaskForm();
  return {
    ...form,
    prompt: 'Zapiš jednu polovinu.',
    topicId: TOPIC,
    grade: '6',
    difficulty: '2',
    sourceId: SOURCE,
    page: '57',
    taskNo: '4',
    subPart: 'b',
    parts: [{ ...form.parts[0], label: 'a', type: 'INTEGER', accepted: ['12'] }],
  };
}

describe('an empty task form', () => {
  it('starts as a TEXT task with one INTEGER part labelled a, difficulty 1 and no hints', () => {
    const form = emptyTaskForm();
    expect(form.modality).toBe('TEXT');
    expect(form.difficulty).toBe('1');
    expect(form.hints).toEqual([]);
    expect(form.parts).toHaveLength(1);
    expect(form.parts[0]).toMatchObject({ label: 'a', type: 'INTEGER', accepted: [''] });
    expect(form.parts[0].key).toMatch(/^[a-z0-9]{1,20}$/);
  });
});

describe('newPart', () => {
  it('gives a fresh machine key and the next letter as label', () => {
    const a = newPart([]);
    const b = newPart([a]);
    const c = newPart([a, b]);
    expect(new Set([a.key, b.key, c.key]).size).toBe(3);
    expect([a.label, b.label, c.label]).toEqual(['a', 'b', 'c']);
  });

  it('never reuses a key still in use after a part was removed', () => {
    const a = newPart([]);
    const b = newPart([a]);
    expect(newPart([b]).key).not.toBe(b.key);
  });
});

describe('toTaskInput (createTask / updateTask body)', () => {
  it('maps the form with numbers as JSON integers and the source reference', () => {
    const input = toTaskInput(filled());
    expect(input).toMatchObject({
      prompt: 'Zapiš jednu polovinu.',
      topicId: TOPIC,
      grade: 6,
      difficulty: 2,
      modality: 'TEXT',
      sourceRef: { sourceId: SOURCE, page: 57, taskNo: '4', subPart: 'b' },
      hints: [],
    });
    expect(input.parts).toEqual([{ key: input.parts[0].key, label: 'a', spec: { ...BASE, type: 'INTEGER', accepted: ['12'] } }]);
    expect(input.translations).toBeUndefined();
  });

  it('sends an empty sub-part as null', () => {
    expect(toTaskInput({ ...filled(), subPart: '  ' }).sourceRef.subPart).toBeNull();
  });

  it('keeps accepted answers as entered (notation matters, answer-checking)', () => {
    const form = filled();
    form.parts[0] = { ...form.parts[0], type: 'DECIMAL', accepted: ['1 250,75', '0.5'], exactDecimals: '2', tolerance: '0,1' };
    expect(toTaskInput(form).parts[0].spec).toEqual({ ...BASE, type: 'DECIMAL', accepted: ['1 250,75', '0.5'], tolerance: '0,1', exactDecimals: 2 });
  });

  it('maps each spec type with its own flags, and the defaults for the flags of other types', () => {
    const base = filled().parts[0];
    const spec = (part: Partial<typeof base>) => toTaskInput({ ...filled(), parts: [{ ...base, ...part }] }).parts[0].spec;
    expect(spec({ type: 'DECIMAL', accepted: ['0,5'] })).toEqual({ ...BASE, type: 'DECIMAL', accepted: ['0,5'] });
    expect(spec({ type: 'FRACTION', accepted: ['1 1/2'], allowEquivalent: false, requireLowestTerms: true, tolerance: '0' })).toEqual({
      ...BASE,
      type: 'FRACTION',
      accepted: ['1 1/2'],
      tolerance: '0',
      allowEquivalent: false,
      requireLowestTerms: true,
    });
    expect(spec({ type: 'NUMBER_WITH_UNIT', accepted: ['24 cm2'], unitRequired: false })).toEqual({
      ...BASE,
      type: 'NUMBER_WITH_UNIT',
      accepted: ['24 cm2'],
      unitRequired: false,
    });
    // A TEXT part never sends a tolerance or another type's flag, even if one was set before a type change.
    expect(
      spec({ type: 'TEXT', accepted: ['pravý úhel', 'pravý'], diacriticsStrict: true, tolerance: '1', exactDecimals: '2', requireLowestTerms: true, unitRequired: false }),
    ).toEqual({ ...BASE, type: 'TEXT', accepted: ['pravý úhel', 'pravý'], diacriticsStrict: true });
  });

  it('letters choice options A, B, C… in order and sends the correct ones as accepted keys', () => {
    const base = filled().parts[0];
    const options = [
      { text: '3', correct: false },
      { text: '4', correct: true },
      { text: '5', correct: false },
    ];
    const single = toTaskInput({ ...filled(), parts: [{ ...base, type: 'CHOICE_SINGLE', options }] }).parts[0].spec;
    expect(single).toEqual({
      ...BASE,
      type: 'CHOICE_SINGLE',
      accepted: ['B'],
      options: [
        { key: 'A', text: '3' },
        { key: 'B', text: '4' },
        { key: 'C', text: '5' },
      ],
    });
    const multi = toTaskInput({
      ...filled(),
      parts: [{ ...base, type: 'CHOICE_MULTI', options: options.map((o, i) => ({ ...o, correct: i !== 1 })) }],
    }).parts[0].spec;
    expect(multi.accepted).toEqual(['A', 'C']);
  });

  it('sends a GRAPHIC task with no parts', () => {
    expect(toTaskInput({ ...filled(), modality: 'GRAPHIC', parts: [] }).parts).toEqual([]);
  });

  it('sends hints in order (FR-7)', () => {
    expect(toTaskInput({ ...filled(), hints: ['první', 'druhá'] }).hints).toEqual(['první', 'druhá']);
  });

  it('sends only the translated texts that were entered, keyed by locale and part key (FR-8)', () => {
    const form = { ...filled(), hints: ['h1', 'h2'] };
    const key = form.parts[0].key;
    form.translations = {
      uk: { prompt: 'Запиши', partLabels: { [key]: 'а' }, hints: ['', 'п2'], options: {} },
      de: { prompt: ' ', partLabels: {}, hints: [], options: {} },
    };
    expect(toTaskInput(form).translations).toEqual({ uk: { prompt: 'Запиши', partLabels: { [key]: 'а' }, hints: [null, 'п2'], options: {} } });
  });

  it('keys translated choice options by part and option key', () => {
    const base = filled().parts[0];
    const form: TaskForm = {
      ...filled(),
      parts: [{ ...base, type: 'CHOICE_SINGLE', options: [{ text: 'ano', correct: true }, { text: 'ne', correct: false }] }],
      translations: { uk: { prompt: '', partLabels: {}, hints: [], options: { [`${base.key}.B`]: 'ні', [`${base.key}.A`]: ' ' } } },
    };
    expect(toTaskInput(form).translations).toEqual({ uk: { partLabels: {}, hints: [], options: { [`${base.key}.B`]: 'ні' } } });
  });
});

describe('fromAdminTask and back', () => {
  const task: AdminTask = {
    taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
    status: 'DRAFT',
    prompt: 'Které číslo je větší než 4?',
    topicId: TOPIC,
    grade: 6,
    difficulty: 3,
    modality: 'TEXT',
    sourceRef: { sourceId: SOURCE, page: 57, taskNo: '5', subPart: null },
    parts: [
      {
        key: 'a',
        label: 'a',
        spec: { ...FLAGS, type: 'CHOICE_SINGLE', accepted: ['C'], options: [{ key: 'A', text: '3' }, { key: 'B', text: '4' }, { key: 'C', text: '5' }] },
      },
      { key: 'p7', label: 'b', spec: { ...FLAGS, type: 'DECIMAL', accepted: ['1 250,75'], acceptedNormalized: ['1250.75'], exactDecimals: 2, tolerance: '0,1' } },
      { key: 'x', label: 'c', spec: { ...FLAGS, type: 'FRACTION', accepted: ['1 1/2'], allowEquivalent: false, requireLowestTerms: true } },
      { key: 'y', label: 'd', spec: { ...FLAGS, type: 'NUMBER_WITH_UNIT', accepted: ['24 cm2'], unitRequired: false } },
      { key: 'z', label: 'e', spec: { ...FLAGS, type: 'TEXT', accepted: ['pravý'], diacriticsStrict: true } },
    ],
    hints: ['Porovnej.'],
    translations: { uk: { prompt: 'Яке число?', hints: [null], partLabels: { a: 'а' }, options: { 'a.C': 'п’ять' } } },
    images: [],
    provenance: { sourceId: SOURCE, sourceTitle: 'Matematika 6', page: 57, taskNo: '5' },
    attemptCount: 0,
    missionIds: [],
    deletable: true,
  };

  it('fills the form, including the normalized interpretations from the server', () => {
    const form = fromAdminTask(task);
    expect(form).toMatchObject({ prompt: task.prompt, grade: '6', difficulty: '3', page: '57', taskNo: '5', subPart: '', hints: ['Porovnej.'] });
    expect(form.parts[0].options).toEqual([
      { text: '3', correct: false },
      { text: '4', correct: false },
      { text: '5', correct: true },
    ]);
    expect(form.parts[1]).toMatchObject({ key: 'p7', accepted: ['1 250,75'], normalized: ['1250.75'], exactDecimals: '2', tolerance: '0,1' });
    expect(form.parts[2]).toMatchObject({ allowEquivalent: false, requireLowestTerms: true });
    expect(form.parts[3]).toMatchObject({ unitRequired: false });
    expect(form.parts[4]).toMatchObject({ diacriticsStrict: true });
    expect(form.translations.uk).toEqual({ prompt: 'Яке число?', partLabels: { a: 'а' }, hints: [''], options: { 'a.C': 'п’ять' } });
  });

  it('round-trips to the same input', () => {
    const input = toTaskInput(fromAdminTask(task));
    expect(input.parts.map((p) => p.spec.accepted)).toEqual([['C'], ['1 250,75'], ['1 1/2'], ['24 cm2'], ['pravý']]);
    expect(input.translations).toEqual({ uk: { prompt: 'Яке число?', partLabels: { a: 'а' }, hints: [], options: { 'a.C': 'п’ять' } } });
  });

  it('reads a task without translations and with defaults for absent flags', () => {
    const plain = fromAdminTask({
      ...task,
      translations: undefined,
      sourceRef: { ...task.sourceRef, subPart: 'b' },
      parts: [{ key: 'a', label: 'a', spec: { ...FLAGS, type: 'FRACTION', accepted: ['1/2'] } }],
    });
    expect(plain.translations).toEqual({});
    expect(plain.subPart).toBe('b');
    expect(plain.parts[0]).toMatchObject({ allowEquivalent: true, requireLowestTerms: false, unitRequired: true, diacriticsStrict: false, tolerance: '', exactDecimals: '' });
  });
});

describe('stickyForm (NFR-8: sticky source and page)', () => {
  it('keeps source, page, topic, grade, difficulty and modality and clears the rest', () => {
    const next = stickyForm({ ...filled(), hints: ['h'], translations: { uk: { prompt: 'x', partLabels: {}, hints: [], options: {} } } });
    expect(next).toMatchObject({ sourceId: SOURCE, page: '57', topicId: TOPIC, grade: '6', difficulty: '2', modality: 'TEXT' });
    expect(next).toMatchObject({ prompt: '', taskNo: '', subPart: '', hints: [], translations: {} });
    expect(next.parts).toHaveLength(1);
    expect(next.parts[0].accepted).toEqual(['']);
  });

  it('starts a sticky GRAPHIC task without parts', () => {
    expect(stickyForm({ ...filled(), modality: 'GRAPHIC' }).parts).toEqual([]);
  });
});

describe('move', () => {
  it('moves an item by delta and ignores moves off either end', () => {
    expect(move(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(move(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('fromAdminTask with sparse data', () => {
  it('reads an empty translation and a choice part without options', () => {
    const form = fromAdminTask({
      taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
      status: 'DRAFT',
      prompt: 'p',
      topicId: TOPIC,
      grade: 6,
      difficulty: 1,
      modality: 'TEXT',
      sourceRef: { sourceId: SOURCE, page: 1, taskNo: '1' },
      parts: [{ key: 'a', label: 'a', spec: { ...FLAGS, type: 'CHOICE_MULTI', accepted: [] } }],
      hints: [],
      translations: { uk: {} },
      images: [],
      provenance: { sourceId: SOURCE, sourceTitle: 'x', page: 1, taskNo: '1' },
      attemptCount: 0,
      missionIds: [],
      deletable: true,
    });
    expect(form.translations.uk).toEqual({ prompt: '', partLabels: {}, hints: [], options: {} });
    expect(form.parts[0].options).toEqual([]);
    expect(form.subPart).toBe('');
  });
});

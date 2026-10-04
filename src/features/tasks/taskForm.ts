import type { components } from '@/api/generated/schema';

type S = components['schemas'];
export type AnswerType = S['AnswerType'];

/** One choice option in the editor; its key is its letter by position (A, B, C …). */
export interface OptionForm {
  text: string;
  correct: boolean;
}

/** One answer part as the editor holds it: every type's fields, so a type change loses nothing. */
export interface PartForm {
  /** Machine key (`PartInput.key`): assigned once, stable across edits, never shown. */
  key: string;
  label: string;
  type: AnswerType;
  /** Accepted answers as entered (non-choice types). */
  accepted: string[];
  /** The server's normalized interpretation of each accepted answer, after a save. */
  normalized: string[];
  tolerance: string;
  exactDecimals: string;
  allowEquivalent: boolean;
  requireLowestTerms: boolean;
  unitRequired: boolean;
  diacriticsStrict: boolean;
  options: OptionForm[];
}

export interface TranslationForm {
  prompt: string;
  /** Keyed by part key. */
  partLabels: Record<string, string>;
  /** Same order as the Czech hints. */
  hints: string[];
  /** Keyed by "<part key>.<option key>". */
  options: Record<string, string>;
}

/** The task editor's state: text fields as typed, turned into a `TaskInput` on save. */
export interface TaskForm {
  prompt: string;
  topicId: string;
  grade: string;
  difficulty: string;
  modality: S['Modality'];
  sourceId: string;
  page: string;
  taskNo: string;
  subPart: string;
  parts: PartForm[];
  hints: string[];
  translations: Record<string, TranslationForm>;
}

export const CHOICE_TYPES: readonly AnswerType[] = ['CHOICE_SINGLE', 'CHOICE_MULTI'];
const NUMERIC_TYPES: readonly AnswerType[] = ['INTEGER', 'DECIMAL', 'FRACTION', 'NUMBER_WITH_UNIT'];
/** The contract defaults of the spec flags (`AnswerSpec`). */
const DEFAULT_FLAGS = { allowEquivalent: true, requireLowestTerms: false, unitRequired: true, diacriticsStrict: false };

/** Option key of position `i`: A, B, C … (`AnswerSpec.options[].key`). */
export const optionKey = (i: number) => String.fromCharCode(65 + i);
const isChoice = (type: AnswerType) => CHOICE_TYPES.includes(type);

/** A new part: the first unused machine key `p1`, `p2` …, and the next letter as its label. */
export function newPart(existing: PartForm[]): PartForm {
  const used = new Set(existing.map((p) => p.key));
  let n = existing.length + 1;
  while (used.has(`p${n}`)) n += 1;
  return {
    key: `p${n}`,
    label: String.fromCharCode(97 + existing.length),
    type: 'INTEGER',
    accepted: [''],
    normalized: [],
    tolerance: '',
    exactDecimals: '',
    ...DEFAULT_FLAGS,
    options: [
      { text: '', correct: false },
      { text: '', correct: false },
    ],
  };
}

/** A new TEXT task with one INTEGER part, difficulty 1: the typical task of NFR-8. */
export function emptyTaskForm(): TaskForm {
  return {
    prompt: '',
    topicId: '',
    grade: '',
    difficulty: '1',
    modality: 'TEXT',
    sourceId: '',
    page: '',
    taskNo: '',
    subPart: '',
    parts: [newPart([])],
    hints: [],
    translations: {},
  };
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

function toSpec(part: PartForm): S['AnswerSpec'] {
  const numeric = NUMERIC_TYPES.includes(part.type);
  const own = <K extends keyof typeof DEFAULT_FLAGS>(flag: K, type: AnswerType) => (part.type === type ? part[flag] : DEFAULT_FLAGS[flag]);
  const spec: S['AnswerSpec'] = {
    type: part.type,
    accepted: part.accepted,
    tolerance: numeric ? orNull(part.tolerance) : null,
    exactDecimals: part.type === 'DECIMAL' && part.exactDecimals.trim() ? Number(part.exactDecimals) : null,
    allowEquivalent: own('allowEquivalent', 'FRACTION'),
    requireLowestTerms: own('requireLowestTerms', 'FRACTION'),
    unitRequired: own('unitRequired', 'NUMBER_WITH_UNIT'),
    diacriticsStrict: own('diacriticsStrict', 'TEXT'),
  };
  if (!isChoice(part.type)) return spec;
  return {
    ...spec,
    accepted: part.options.flatMap((o, i) => (o.correct ? [optionKey(i)] : [])),
    options: part.options.map((o, i) => ({ key: optionKey(i), text: o.text })),
  };
}

const nonEmpty = (record: Record<string, string>) => Object.fromEntries(Object.entries(record).filter(([, v]) => v.trim()));

/** The entered texts of one translation, or null when nothing was entered (FR-8: optional, may be partial). */
function toTranslation(tr: TranslationForm): S['Translation'] | null {
  const hints: (string | null)[] = tr.hints.map((h) => (h.trim() ? h : null));
  while (hints.length && hints.at(-1) === null) hints.pop();
  const partLabels = nonEmpty(tr.partLabels);
  const options = nonEmpty(tr.options);
  const out: S['Translation'] = { partLabels, hints, options };
  if (tr.prompt.trim()) out.prompt = tr.prompt;
  const empty = !out.prompt && !hints.length && !Object.keys(partLabels).length && !Object.keys(options).length;
  return empty ? null : out;
}

/** The `createTask` / `updateTask` body. Values are sent as entered; the server validates them. */
export function toTaskInput(form: TaskForm): S['TaskInput'] {
  const translations = Object.entries(form.translations).flatMap(([locale, tr]) => {
    const t = toTranslation(tr);
    return t ? [[locale, t] as const] : [];
  });
  return {
    prompt: form.prompt,
    topicId: form.topicId,
    grade: Number(form.grade),
    difficulty: Number(form.difficulty),
    modality: form.modality,
    sourceRef: { sourceId: form.sourceId, page: Number(form.page), taskNo: form.taskNo, subPart: orNull(form.subPart) },
    parts: form.parts.map((p) => ({ key: p.key, label: p.label, spec: toSpec(p) })),
    hints: form.hints,
    ...(translations.length ? { translations: Object.fromEntries(translations) } : {}),
  };
}

function fromSpec(key: string, label: string, spec: S['AnswerSpec']): PartForm {
  const choice = isChoice(spec.type);
  return {
    key,
    label,
    type: spec.type,
    accepted: choice ? [''] : spec.accepted,
    normalized: choice ? [] : (spec.acceptedNormalized ?? []),
    tolerance: spec.tolerance ?? '',
    exactDecimals: spec.exactDecimals == null ? '' : String(spec.exactDecimals),
    allowEquivalent: spec.allowEquivalent,
    requireLowestTerms: spec.requireLowestTerms,
    unitRequired: spec.unitRequired,
    diacriticsStrict: spec.diacriticsStrict,
    options: choice
      ? (spec.options ?? []).map((o) => ({ text: o.text, correct: spec.accepted.includes(o.key) }))
      : newPart([]).options,
  };
}

/** The editor state of a stored task. */
export function fromAdminTask(task: S['AdminTask']): TaskForm {
  const translations = Object.entries(task.translations ?? {}).map(([locale, tr]) => [
    locale,
    {
      prompt: tr.prompt ?? '',
      partLabels: tr.partLabels ?? {},
      hints: (tr.hints ?? []).map((h) => h ?? ''),
      options: tr.options ?? {},
    },
  ]);
  return {
    prompt: task.prompt,
    topicId: task.topicId,
    grade: String(task.grade),
    difficulty: String(task.difficulty),
    modality: task.modality,
    sourceId: task.sourceRef.sourceId,
    page: String(task.sourceRef.page),
    taskNo: task.sourceRef.taskNo,
    subPart: task.sourceRef.subPart ?? '',
    parts: task.parts.map((p) => fromSpec(p.key, p.label, p.spec)),
    hints: task.hints,
    translations: Object.fromEntries(translations),
  };
}

/**
 * The form for the next task after a save (NFR-8, "Sticky source and page"): source, page, topic,
 * grade, difficulty and modality stay; the rest starts empty.
 */
export function stickyForm(form: TaskForm): TaskForm {
  const { sourceId, page, topicId, grade, difficulty, modality } = form;
  return { ...emptyTaskForm(), sourceId, page, topicId, grade, difficulty, modality, parts: modality === 'TEXT' ? [newPart([])] : [] };
}

/** `list` with the item at `index` moved by `delta`; a move off either end changes nothing. */
export function move<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Applies one index change to `list`, padded to `length` first (a translation may be shorter). */
function reshape(list: string[], length: number, change: (items: string[]) => string[]): string[] {
  return change(Array.from({ length }, (_, i) => list[i] ?? ''));
}

/**
 * Changes the Czech hints with `change` (move, remove) and applies the same index change to each
 * locale's translated hints, which are matched by position (`Translation.hints`).
 */
export function changeHints(form: TaskForm, change: (items: string[]) => string[]): TaskForm {
  const translations = Object.fromEntries(
    Object.entries(form.translations).map(([locale, tr]) => [locale, { ...tr, hints: reshape(tr.hints, form.hints.length, change) }]),
  );
  return { ...form, hints: change(form.hints), translations };
}

/** Removes part `i` and its translated label and option texts. */
export function removePart(form: TaskForm, i: number): TaskForm {
  const key = form.parts[i].key;
  const translations = Object.fromEntries(
    Object.entries(form.translations).map(([locale, tr]) => {
      const partLabels = { ...tr.partLabels };
      delete partLabels[key];
      const options = Object.fromEntries(Object.entries(tr.options).filter(([k]) => !k.startsWith(`${key}.`)));
      return [locale, { ...tr, partLabels, options }];
    }),
  );
  return { ...form, parts: form.parts.filter((_, k) => k !== i), translations };
}

/**
 * Removes option `j` of part `i`. Later options move up a letter, so their translated texts (keyed
 * "<part key>.<letter>") move with them and the removed option's translation goes.
 */
export function removeOption(form: TaskForm, i: number, j: number): TaskForm {
  const part = form.parts[i];
  const translations = Object.fromEntries(
    Object.entries(form.translations).map(([locale, tr]) => {
      const options: Record<string, string> = {};
      for (const [k, v] of Object.entries(tr.options)) {
        const index = k.startsWith(`${part.key}.`) ? k.charCodeAt(k.length - 1) - 65 : -1;
        if (index < 0) options[k] = v;
        else if (index !== j) options[`${part.key}.${optionKey(index > j ? index - 1 : index)}`] = v;
      }
      return [locale, { ...tr, options }];
    }),
  );
  const parts = form.parts.map((p, k) => (k === i ? { ...p, options: p.options.filter((_, o) => o !== j) } : p));
  return { ...form, parts, translations };
}

/**
 * Checks the form can answer before sending: the page lies in the source (FR-3) and an exact
 * decimal count is a whole number (`AnswerSpec.exactDecimals` is an integer 0–6). Path → message.
 */
export function clientErrors(form: TaskForm, pageCount: number | null, messages: { page: string; exactDecimals: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (pageCount !== null && !/^\d{1,9}$/.test(form.page.trim())) errors['sourceRef.page'] = messages.page;
  else if (pageCount !== null && (Number(form.page) < 1 || Number(form.page) > pageCount)) errors['sourceRef.page'] = messages.page;
  form.parts.forEach((p, i) => {
    if (p.type === 'DECIMAL' && p.exactDecimals.trim() && !/^[0-6]$/.test(p.exactDecimals.trim()))
      errors[`parts[${i}].spec.exactDecimals`] = messages.exactDecimals;
  });
  return errors;
}

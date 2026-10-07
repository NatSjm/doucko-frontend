import type { components } from '../api/generated/schema';
import { createProgress, handleProgress, progressSeedStrings, type ProgressState, type SeedTasks } from './fake-progress-backend.ts';

/**
 * A stand-in for the admin API of the pinned contract (`contract/api/openapi.yaml`), shared by the
 * Vitest `fetch` stub (`admin-backend.ts`), the Playwright fixture (`e2e/fixtures/admin.ts`) and the
 * NFR-8 recording. It is a contract stub, not the backend: it keeps state in memory, answers with
 * the contract's shapes and status codes, and applies a few of the content-authoring rules so the UI
 * can be shown each kind of refusal (problem+json with `errors[].field`). All data is self-authored.
 */
type S = components['schemas'];
type Problem = S['Problem'];
type FieldError = NonNullable<Problem['errors']>[number];

export const SEED = {
  sourceId: '11111111-1111-4111-8111-111111111111',
  smallSourceId: '22222222-2222-4222-8222-222222222222',
  topicDecimals: '33333333-3333-4333-8333-000000000001',
  topicPerimeter: '33333333-3333-4333-8333-000000000002',
  taskDecimal: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
  taskPerimeter: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
  taskGraphic: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003',
  taskChoice: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004',
  imageDecimal: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
  missionDecimals: 'ffffffff-ffff-4fff-8fff-000000000001',
} as const;

export const CSRF_TOKEN = 'xsrf-123';
export const ADMIN_PASSWORD = 'Kocka-na-plote-42';

const MB = 1024 * 1024;
/** The contract defaults of the answer spec flags (`AnswerSpec`). */
export const FLAGS = { allowEquivalent: true, requireLowestTerms: false, unitRequired: true, diacriticsStrict: false };
export const FORMAT_TIP = 'Tohle číslo neumím přečíst. Zkus třeba 5,2.';

/** A minimal, valid PDF of `pages` pages, each showing "Page n" (self-authored test data). */
export function makePdf(pages: number): Uint8Array {
  const objects: string[] = [];
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let i = 0; i < pages; i++) {
    const text = `BT /F1 48 Tf 72 700 Td (Page ${i + 1}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
  }
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

/** A 1×1 PNG (self-authored test data). */
export function makePng(): Uint8Array {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);
const isPdf = (b: Uint8Array) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]);
const isPng = (b: Uint8Array) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]);
const isJpg = (b: Uint8Array) => startsWith(b, [0xff, 0xd8, 0xff]);
const pageCount = (b: Uint8Array) => (new TextDecoder('latin1').decode(b).match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('cs');
const codePoints = (s: string) => [...s.trim()].length;

export interface StoredTask {
  input: S['TaskInput'];
  taskId: string;
  status: S['PublishStatus'];
  images: { imageId: string; bytes: Uint8Array; type: string }[];
}

export interface StoredMission {
  missionId: string;
  topicId: string;
  position: number;
  taskIds: string[];
  status: S['PublishStatus'];
}

/**
 * Seed data: one 120-page and one 40-page source, two grade-6 topics, four tasks (one with an image)
 * and one draft mission of the decimals topic holding its two tasks.
 */
function seed() {
  const reference: S['ReferenceData'] = {
    grades: [6],
    subjects: ['math'],
    taskLocales: ['uk'],
    topics: [
      { topicId: SEED.topicDecimals, code: 'decimals', grade: 6, name: 'Desetinná čísla' },
      { topicId: SEED.topicPerimeter, code: 'perimeter-area', grade: 6, name: 'Obvod a obsah' },
    ],
  };
  const sources: { source: S['Source']; bytes: Uint8Array }[] = [
    {
      source: { sourceId: SEED.sourceId, title: 'Matematika 6 – pracovní sešit', publisher: 'Testovací nakladatelství', edition: '1', grade: 6, subject: 'math', pageCount: 120 },
      bytes: makePdf(120),
    },
    {
      source: { sourceId: SEED.smallSourceId, title: 'Sbírka úloh 6', publisher: null, edition: null, grade: 6, subject: 'math', pageCount: 40 },
      bytes: makePdf(40),
    },
  ];
  const tasks: StoredTask[] = [
    {
      taskId: SEED.taskDecimal,
      status: 'DRAFT',
      images: [{ imageId: SEED.imageDecimal, bytes: makePng(), type: 'image/png' }],
      input: {
        prompt: 'Zapiš jednu polovinu jako desetinné číslo.',
        topicId: SEED.topicDecimals,
        grade: 6,
        difficulty: 2,
        modality: 'TEXT',
        sourceRef: { sourceId: SEED.sourceId, page: 57, taskNo: '4', subPart: 'b' },
        parts: [{ key: 'a', label: 'a', spec: { ...FLAGS, type: 'DECIMAL', accepted: ['0.5'] } }],
        hints: ['Polovina je jedna děleno dvěma.', 'Kolik je pět desetin?'],
        translations: { uk: { prompt: 'Запиши одну половину як десятковий дріб.', partLabels: {}, hints: [], options: {} } },
      },
    },
    {
      taskId: SEED.taskPerimeter,
      status: 'PUBLISHED',
      images: [],
      input: {
        prompt: 'Vypočítej obvod obdélníku se stranami 3 cm a 4 cm.',
        topicId: SEED.topicPerimeter,
        grade: 6,
        difficulty: 1,
        modality: 'TEXT',
        sourceRef: { sourceId: SEED.sourceId, page: 58, taskNo: '1', subPart: null },
        parts: [{ key: 'a', label: 'a', spec: { ...FLAGS, type: 'NUMBER_WITH_UNIT', accepted: ['14 cm'] } }],
        hints: [],
      },
    },
    {
      taskId: SEED.taskGraphic,
      status: 'DRAFT',
      images: [],
      input: {
        prompt: 'Narýsuj čtverec o straně 5 cm.',
        topicId: SEED.topicPerimeter,
        grade: 6,
        difficulty: 1,
        modality: 'GRAPHIC',
        sourceRef: { sourceId: SEED.smallSourceId, page: 3, taskNo: '2', subPart: null },
        parts: [],
        hints: [],
      },
    },
    {
      taskId: SEED.taskChoice,
      status: 'DRAFT',
      images: [],
      input: {
        prompt: 'Které číslo je větší než 4?',
        topicId: SEED.topicDecimals,
        grade: 6,
        difficulty: 1,
        modality: 'TEXT',
        sourceRef: { sourceId: SEED.sourceId, page: 57, taskNo: '5', subPart: null },
        parts: [
          {
            key: 'a',
            label: 'a',
            spec: { ...FLAGS, type: 'CHOICE_SINGLE', accepted: ['C'], options: [{ key: 'A', text: '3' }, { key: 'B', text: '4' }, { key: 'C', text: '5' }] },
          },
        ],
        hints: ['Čísla porovnej na číselné ose.'],
      },
    },
  ];
  const missions: StoredMission[] = [
    { missionId: SEED.missionDecimals, topicId: SEED.topicDecimals, position: 1, taskIds: [SEED.taskDecimal, SEED.taskChoice], status: 'DRAFT' },
  ];
  return { reference, sources, tasks, missions };
}

/** Every string of the seed data: the `⟦` test accepts exactly these as admin-entered content. */
export function seedStrings(): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.add(v.trim());
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  const data = seed();
  walk(data.reference);
  walk(data.sources.map((s) => s.source));
  walk(data.tasks.map((t) => t.input));
  walk(progressSeedStrings(createProgress(seedTasks(data.tasks))));
  return out;
}

/** The seed tasks the flag-queue seed reports on (slice 9). */
function seedTasks(tasks: StoredTask[]): SeedTasks {
  const pick = (taskId: string) => ({ taskId, prompt: tasks.find((t) => t.taskId === taskId)?.input.prompt ?? '' });
  return { decimal: pick(SEED.taskDecimal), choice: pick(SEED.taskChoice), perimeter: pick(SEED.taskPerimeter), topicDecimals: SEED.topicDecimals, topicPerimeter: SEED.topicPerimeter };
}

// ---------------------------------------------------------------- answer checking (simplified)

const NUMBER = /^-?\d+(?:[.,]\d+)?$/;
const SPACES = new RegExp('[\\s\\u00a0\\u2009\\u202f]', 'g');

function parseNumber(raw: string): number | null {
  const s = raw.replace(SPACES, '');
  return NUMBER.test(s) ? Number(s.replace(',', '.')) : null;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
function parseFraction(raw: string): [number, number] | null {
  const m = /^\s*(?:(-?\d+)\s+)?(-?\d+)\s*\/\s*(\d+)\s*$/.exec(raw);
  if (!m || Number(m[3]) === 0) return null;
  const whole = m[1] ? Number(m[1]) : 0;
  const num = whole * Number(m[3]) + Number(m[2]);
  const g = gcd(num, Number(m[3])) || 1;
  return [num / g, Number(m[3]) / g];
}

const normUnit = (u: string) => u.trim().replace(/2$/, '²').replace(/3$/, '³');
function parseWithUnit(raw: string): { value: number; unit: string } | null {
  const m = new RegExp('^\\s*(-?[\\d\\s\\u00a0,.]+?)\\s*([^\\d\\s,.-]\\S*)\\s*$').exec(raw);
  const value = m ? parseNumber(m[1]) : null;
  return m && value !== null ? { value, unit: normUnit(m[2]) } : null;
}

/** The normalized interpretation of one value of a part type, or null when unreadable. */
function normalize(type: S['AnswerType'], raw: string): string | null {
  switch (type) {
    case 'INTEGER':
    case 'DECIMAL': {
      const n = parseNumber(raw);
      return n === null ? null : String(n);
    }
    case 'FRACTION': {
      const f = parseFraction(raw);
      return f ? `${f[0]}/${f[1]}` : null;
    }
    case 'NUMBER_WITH_UNIT': {
      const p = parseWithUnit(raw);
      return p ? `${p.value} ${p.unit}` : null;
    }
    default:
      return raw.trim() ? raw.trim() : null;
  }
}

export function check(part: S['PartInput'], answer: string | string[] | undefined): S['PartResult'] {
  const spec = part.spec;
  if (spec.type === 'CHOICE_SINGLE' || spec.type === 'CHOICE_MULTI') {
    const picked = [...new Set(Array.isArray(answer) ? answer : [])].sort();
    const ok = spec.type === 'CHOICE_SINGLE' ? picked.length === 1 && spec.accepted.includes(picked[0]) : picked.join() === [...spec.accepted].sort().join();
    return { key: part.key, verdict: ok ? 'CORRECT' : 'WRONG', normalized: picked.join(','), formatTip: null, locked: false };
  }
  const raw = typeof answer === 'string' ? answer : '';
  const normalized = normalize(spec.type, raw);
  if (normalized === null) return { key: part.key, verdict: 'UNPARSEABLE', normalized: null, formatTip: FORMAT_TIP, locked: false };
  const expected = spec.accepted.map((a) => normalize(spec.type, a));
  const ok = spec.type === 'TEXT' ? expected.some((e) => e && fold(e) === fold(normalized)) : expected.includes(normalized);
  return { key: part.key, verdict: ok ? 'CORRECT' : 'WRONG', normalized, formatTip: null, locked: false };
}

// ---------------------------------------------------------------- validation (a subset of the spec rules)

function validateTask(input: S['TaskInput'], reference: S['ReferenceData'], sources: S['Source'][]): FieldError[] {
  const errors: FieldError[] = [];
  const add = (field: string, message: string) => errors.push({ field, message });
  if (!input.prompt?.trim()) add('prompt', 'Prompt is required.');
  else if (codePoints(input.prompt) > 4000) add('prompt', 'Prompt must be at most 4000 characters.');
  if (!reference.grades.includes(input.grade)) add('grade', `Grade must be one of: ${reference.grades.join(', ')}.`);
  const topic = reference.topics.find((t) => t.topicId === input.topicId);
  if (!topic) add('topicId', 'Choose a topic.');
  else if (topic.grade !== input.grade) add('topicId', `The topic does not belong to grade ${input.grade}.`);
  if (!Number.isInteger(input.difficulty) || input.difficulty < 1 || input.difficulty > 3) add('difficulty', 'Difficulty must be a whole number from 1 to 3.');
  if (input.modality !== 'TEXT' && input.modality !== 'GRAPHIC') add('modality', 'Choose a modality.');
  const source = sources.find((s) => s.sourceId === input.sourceRef?.sourceId);
  if (!source) add('sourceRef.sourceId', 'Choose a source.');
  else {
    const page = input.sourceRef.page;
    if (!Number.isInteger(page) || page < 1 || page > source.pageCount) add('sourceRef.page', `Page must be a whole number from 1 to ${source.pageCount}.`);
    if (source.grade !== input.grade && reference.grades.includes(input.grade)) add('grade', `The task grade must match the source grade (${source.grade}).`);
  }
  if (!input.sourceRef?.taskNo?.trim()) add('sourceRef.taskNo', 'Task number is required.');
  if (input.modality === 'TEXT' && input.parts.length === 0) add('parts', 'A text task needs at least one answer part.');
  const labels = new Set<string>();
  input.parts.forEach((part, i) => {
    const label = part.label?.trim() ?? '';
    if (!label) add(`parts[${i}].label`, 'Label is required.');
    else if (labels.has(label)) add(`parts[${i}].label`, 'Part labels must be unique.');
    labels.add(label);
    const spec = part.spec;
    if (spec.type === 'CHOICE_SINGLE' || spec.type === 'CHOICE_MULTI') {
      const options = spec.options ?? [];
      if (options.length < 2) add(`parts[${i}].spec.options`, 'A choice part needs at least 2 options.');
      options.forEach((o, j) => {
        if (!o.text.trim()) add(`parts[${i}].spec.options[${j}].text`, 'Option text is required.');
      });
      if (spec.accepted.length === 0) add(`parts[${i}].spec.accepted`, 'Mark at least one correct option.');
      return;
    }
    if (spec.accepted.length === 0) add(`parts[${i}].spec.accepted`, 'Enter at least one accepted answer.');
    spec.accepted.forEach((value, j) => {
      const n = normalize(spec.type, value);
      if (n === null) add(`parts[${i}].spec.accepted[${j}]`, 'This value cannot be read.');
      else if (spec.type === 'INTEGER' && !Number.isInteger(Number(n))) add(`parts[${i}].spec.accepted[${j}]`, `${value} is not a whole number; DECIMAL fits it.`);
    });
  });
  input.hints.forEach((h, i) => {
    if (!h.trim()) add(`hints[${i}]`, 'A hint cannot be empty.');
  });
  for (const locale of Object.keys(input.translations ?? {}))
    if (!reference.taskLocales.includes(locale)) add('translations', `Supported task locales: ${reference.taskLocales.join(', ')}.`);
  return errors;
}

// ---------------------------------------------------------------- the backend

export interface FakeAdminBackend {
  signedIn: boolean;
  password: string;
  csrfToken: string;
  /** Every request fails as a network error. */
  down: boolean;
  /** Every request is answered with this status. */
  failWith: number | null;
  /** The next request matching `match` gets this response instead (once). */
  override: { match: (method: string, path: string) => boolean; status: number; body: unknown } | null;
  reference: S['ReferenceData'];
  sources: { source: S['Source']; bytes: Uint8Array }[];
  tasks: StoredTask[];
  missions: StoredMission[];
  /** Ids of tasks that have practice records (an attempt, a problem report or an opened hint): they block deletes (FR-56, CA-D22). */
  usage: Set<string>;
  /** Stats history and the flag queue (slice 9, `fake-progress-backend.ts`). */
  progress: ProgressState;
  /** Ids handed out by the backend, predictable for tests. */
  nextId: number;
  handle(request: Request): Promise<Response>;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, title: string, extra: Partial<Problem> = {}) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
const invalid = (errors: FieldError[]) => problem(400, 'Invalid input', { detail: errors[0]?.message, errors });
/** A state-rule refusal (409): the reason in `detail`, the blocking entities in `conflicts`. */
const conflict = (detail: string, conflicts: string[] = []) => problem(409, 'Not allowed now', { detail, conflicts });
const noContent = () => new Response(null, { status: 204 });

/** Creates a fake admin backend. `seeded` loads the seed data; `signedIn` starts with a session. */
export function createFakeAdminBackend({ signedIn = false, seeded = true } = {}): FakeAdminBackend {
  const full = seed();
  const data = seeded ? full : { ...full, sources: [], tasks: [], missions: [] };
  const backend: FakeAdminBackend = {
    signedIn,
    password: ADMIN_PASSWORD,
    csrfToken: CSRF_TOKEN,
    down: false,
    failWith: null,
    override: null,
    reference: data.reference,
    sources: data.sources,
    tasks: data.tasks,
    missions: data.missions,
    usage: new Set(),
    progress: createProgress(seedTasks(full.tasks), seeded),
    nextId: 1,
    handle: (request) => handle(backend, request),
  };
  return backend;
}

const newId = (b: FakeAdminBackend, prefix: string) => `${prefix}-0000-4000-8000-${String(b.nextId++).padStart(12, '0')}`;

function adminTask(b: FakeAdminBackend, t: StoredTask): S['AdminTask'] {
  const source = b.sources.find((s) => s.source.sourceId === t.input.sourceRef.sourceId)?.source;
  return {
    ...t.input,
    parts: t.input.parts.map((p) => ({
      ...p,
      spec: {
        ...p.spec,
        acceptedNormalized: p.spec.accepted.map((a) => normalize(p.spec.type, a) ?? a),
        unit: p.spec.type === 'NUMBER_WITH_UNIT' ? (parseWithUnit(p.spec.accepted[0] ?? '')?.unit ?? null) : null,
      },
    })),
    taskId: t.taskId,
    status: t.status,
    images: t.images.map((img, i) => ({ imageId: img.imageId, order: i + 1, url: `/api/admin/tasks/${t.taskId}/images/${img.imageId}` })),
    provenance: {
      sourceId: t.input.sourceRef.sourceId,
      sourceTitle: source?.title ?? '',
      edition: source?.edition ?? null,
      page: t.input.sourceRef.page,
      taskNo: t.input.sourceRef.taskNo,
      subPart: t.input.sourceRef.subPart ?? null,
    },
    attemptCount: b.usage.has(t.taskId) ? 1 : 0,
    missionIds: b.missions.filter((m) => m.taskIds.includes(t.taskId)).map((m) => m.missionId),
    deletable: !b.usage.has(t.taskId) && !publishedHolders(b, t.taskId).length,
  };
}

/** The published missions that hold a task. */
const publishedHolders = (b: FakeAdminBackend, taskId: string) => b.missions.filter((m) => m.status === 'PUBLISHED' && m.taskIds.includes(taskId));
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/**
 * Adds a self-authored task of `topicId` (published TEXT unless told otherwise) and returns it; specs
 * use it to fill a topic, e.g. with 51 tasks for the mission maximum.
 */
export function addTask(
  b: FakeAdminBackend,
  overrides: { topicId: string; status?: S['PublishStatus']; modality?: S['Modality']; prompt?: string },
): StoredTask {
  const n = b.tasks.length + 1;
  const task: StoredTask = {
    taskId: newId(b, 'dddddddd'),
    status: overrides.status ?? 'PUBLISHED',
    images: [],
    input: {
      prompt: overrides.prompt ?? `Úloha číslo ${n}`,
      topicId: overrides.topicId,
      grade: 6,
      difficulty: 1,
      modality: overrides.modality ?? 'TEXT',
      sourceRef: { sourceId: SEED.sourceId, page: 60, taskNo: String(n), subPart: null },
      parts: overrides.modality === 'GRAPHIC' ? [] : [{ key: 'a', label: 'a', spec: { ...FLAGS, type: 'INTEGER', accepted: [String(n)] } }],
      hints: [],
    },
  };
  b.tasks.push(task);
  return task;
}

function adminMission(b: FakeAdminBackend, m: StoredMission): S['AdminMission'] {
  const used = m.taskIds.some((id) => b.usage.has(id));
  return { missionId: m.missionId, topicId: m.topicId, position: m.position, taskIds: [...m.taskIds], status: m.status, hasAttempts: used, deletable: !used };
}

function summary(b: FakeAdminBackend, t: StoredTask): S['TaskSummary'] {
  const a = adminTask(b, t);
  return {
    taskId: a.taskId,
    promptExcerpt: a.prompt.length > 80 ? `${a.prompt.slice(0, 80)}…` : a.prompt,
    topicId: a.topicId,
    grade: a.grade,
    difficulty: a.difficulty,
    modality: a.modality,
    status: a.status,
    provenance: a.provenance,
  };
}

function preview(t: StoredTask, locale: string | null): S['TaskView'] {
  const tr = locale ? t.input.translations?.[locale] : undefined;
  const text = (cs: string, other: string | null | undefined): S['LocalizedText'] => ({
    cs,
    secondary: locale && other ? { locale, text: other } : null,
  });
  const total = t.input.hints.length;
  return {
    taskId: t.taskId,
    missionId: null,
    position: 1,
    prompt: text(t.input.prompt, tr?.prompt),
    translationAvailable: Object.keys(t.input.translations ?? {}).length > 0,
    images: t.images.map((img) => ({ imageId: img.imageId, url: `/api/admin/tasks/${t.taskId}/images/${img.imageId}` })),
    parts: t.input.parts.map((p) => ({
      key: p.key,
      label: text(p.label, tr?.partLabels?.[p.key]),
      type: p.spec.type,
      unit: p.spec.type === 'NUMBER_WITH_UNIT' ? (parseWithUnit(p.spec.accepted[0] ?? '')?.unit ?? null) : null,
      options: p.spec.options?.map((o) => ({ key: o.key, text: text(o.text, tr?.options?.[`${p.key}.${o.key}`]) })),
    })),
    hints: {
      total,
      opened: t.input.hints.map((h, i) => ({ index: i + 1, text: text(h, tr?.hints?.[i]), remaining: total - i - 1 })),
    },
    maxAttempts: 2,
    attemptsUsed: 0,
    state: 'UNRESOLVED',
    lastFeedback: null,
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

async function handle(b: FakeAdminBackend, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (b.down) throw new TypeError('Failed to fetch');
  if (b.failWith) return problem(b.failWith, 'Server error');
  if (b.override?.match(method, path)) {
    const { status, body } = b.override;
    b.override = null;
    return status >= 400 ? problem(status, 'Refused', body as Partial<Problem>) : json(status, body);
  }
  if (!path.startsWith('/api/admin/')) return problem(404, 'Resource not found');

  if (path === '/api/admin/session' && method === 'POST') {
    const body = (await readJson(request)) as { password?: unknown } | undefined;
    if (body?.password !== b.password) return problem(401, 'Invalid credentials');
    b.signedIn = true;
    return new Response(null, { status: 204 });
  }
  if (!b.signedIn) return problem(401, 'Unauthorized');
  if (method !== 'GET' && request.headers.get('X-XSRF-TOKEN') !== b.csrfToken) return problem(403, 'Access denied');
  if (path === '/api/admin/session') {
    if (method === 'DELETE') b.signedIn = false;
    return new Response(null, { status: 204 });
  }
  if (path === '/api/admin/reference') return json(200, b.reference);
  const progress = handleProgress(b, request, url, check);
  if (progress) return progress;

  if (path === '/api/admin/sources' && method === 'GET') return json(200, b.sources.map((s) => s.source));
  if (path === '/api/admin/sources' && method === 'POST') return uploadSource(b, request);
  const sourceMatch = /^\/api\/admin\/sources\/([^/]+)(\/file)?$/.exec(path);
  if (sourceMatch) {
    const stored = b.sources.find((s) => s.source.sourceId === sourceMatch[1]);
    if (!stored) return problem(404, 'Resource not found');
    if (sourceMatch[2]) return new Response(stored.bytes.slice(), { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    if (method === 'PUT') return updateSource(b, request, stored.source);
    if (method === 'DELETE') return deleteSource(b, stored.source);
    return json(200, stored.source);
  }

  if (path === '/api/admin/missions' && method === 'GET') return json(200, b.missions.map((m) => adminMission(b, m)));
  if (path === '/api/admin/missions' && method === 'POST') return saveMission(b, request, null);
  const missionMatch = /^\/api\/admin\/missions\/([^/]+)(\/status)?$/.exec(path);
  if (missionMatch) {
    const m = b.missions.find((x) => x.missionId === missionMatch[1]);
    if (!m) return problem(404, 'Resource not found');
    if (missionMatch[2] && method === 'PUT') return setMissionStatus(b, request, m);
    if (!missionMatch[2] && method === 'GET') return json(200, adminMission(b, m));
    if (!missionMatch[2] && method === 'PUT') return saveMission(b, request, m);
    if (!missionMatch[2] && method === 'DELETE') return deleteMission(b, m);
  }

  if (path === '/api/admin/tasks' && method === 'GET') return listTasks(b, url);
  if (path === '/api/admin/tasks' && method === 'POST') return saveTask(b, request, null);
  if (path === '/api/admin/tasks/publish' && method === 'POST') {
    const body = (await readJson(request)) as { taskIds?: string[] } | undefined;
    const ids = body?.taskIds ?? [];
    if (ids.length < 1 || ids.length > 100) return invalid([{ field: 'taskIds', message: 'Select 1 to 100 tasks.' }]);
    return json(
      200,
      ids.map((id) => {
        const t = b.tasks.find((x) => x.taskId === id);
        if (!t) return { taskId: id, published: false, reason: 'not found' };
        t.status = 'PUBLISHED';
        return { taskId: id, published: true, reason: null };
      }),
    );
  }
  const taskMatch = /^\/api\/admin\/tasks\/([^/]+)(?:\/(preview|check|images|status)(?:\/([^/]+))?)?$/.exec(path);
  if (taskMatch) {
    const t = b.tasks.find((x) => x.taskId === taskMatch[1]);
    if (!t) return problem(404, 'Resource not found');
    const [, , sub, imageId] = taskMatch;
    if (!sub && method === 'GET') return json(200, adminTask(b, t));
    if (!sub && method === 'PUT') return saveTask(b, request, t);
    if (!sub && method === 'DELETE') return deleteTask(b, t);
    if (sub === 'status' && method === 'PUT') return setTaskStatus(b, request, t);
    if (sub === 'preview') {
      const locale = url.searchParams.get('locale');
      if (locale && !b.reference.taskLocales.includes(locale)) return invalid([{ field: 'locale', message: 'Unsupported locale.' }]);
      return json(200, preview(t, locale));
    }
    if (sub === 'check' && method === 'POST') {
      const body = (await readJson(request)) as S['AttemptRequest'] | undefined;
      return json(200, t.input.parts.map((p) => check(p, body?.answers?.[p.key])));
    }
    if (sub === 'images') return images(b, request, t, imageId);
  }
  return problem(404, 'Resource not found');
}

async function uploadSource(b: FakeAdminBackend, request: Request): Promise<Response> {
  const form = await request.formData();
  const file = form.get('file');
  const errors: FieldError[] = [];
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const title = text('title');
  if (!title) errors.push({ field: 'title', message: 'Title is required.' });
  else if (codePoints(title) > 200) errors.push({ field: 'title', message: 'Title must be at most 200 characters.' });
  const grade = Number(text('grade'));
  if (!b.reference.grades.includes(grade)) errors.push({ field: 'grade', message: `Grade must be one of: ${b.reference.grades.join(', ')}.` });
  const subject = text('subject') ?? '';
  if (!b.reference.subjects.includes(subject)) errors.push({ field: 'subject', message: `Subject must be one of: ${b.reference.subjects.join(', ')}.` });
  if (!(file instanceof Blob) || file.size === 0) errors.push({ field: 'file', message: 'Choose a PDF file.' });
  if (errors.length) return invalid(errors);
  const blob = file as Blob;
  if (blob.size > 50 * MB) return problem(413, 'Payload too large', { detail: 'Only PDF files up to 50 MB are allowed.' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isPdf(bytes)) return problem(415, 'Unsupported media type', { detail: 'Only PDF files up to 50 MB are allowed.' });
  const pages = pageCount(bytes);
  if (pages === 0) return invalid([{ field: 'file', message: 'The PDF could not be read. It may be damaged or password-protected.' }]);
  const source: S['Source'] = { sourceId: newId(b, 'cccccccc'), title: title as string, publisher: text('publisher'), edition: text('edition'), grade, subject, pageCount: pages };
  b.sources.push({ source, bytes });
  return json(201, source);
}

function listTasks(b: FakeAdminBackend, url: URL): Response {
  const p = url.searchParams;
  const q = (p.get('q') ?? '').trim();
  if (codePoints(q) > 200) return invalid([{ field: 'q', message: 'Search must be at most 200 characters.' }]);
  const matches = b.tasks.filter((t) => {
    const i = t.input;
    return (
      (!p.get('grade') || i.grade === Number(p.get('grade'))) &&
      (!p.get('topicId') || i.topicId === p.get('topicId')) &&
      (!p.get('sourceId') || i.sourceRef.sourceId === p.get('sourceId')) &&
      (!p.get('page') || i.sourceRef.page === Number(p.get('page'))) &&
      (!p.get('modality') || i.modality === p.get('modality')) &&
      (!p.get('status') || t.status === p.get('status')) &&
      (!q || fold(i.prompt).includes(fold(q)))
    );
  });
  return json(200, matches.map((t) => summary(b, t)));
}

async function saveTask(b: FakeAdminBackend, request: Request, existing: StoredTask | null): Promise<Response> {
  const input = (await readJson(request)) as S['TaskInput'];
  const errors = validateTask(input, b.reference, b.sources.map((s) => s.source));
  if (errors.length) return invalid(errors);
  const trimmed: S['TaskInput'] = { ...input, prompt: input.prompt.trim() };
  if (existing) {
    const holders = b.missions.filter((m) => m.taskIds.includes(existing.taskId));
    if (holders.length && (input.topicId !== existing.input.topicId || input.grade !== existing.input.grade))
      return conflict('The topic or grade cannot change while the task is in a mission.', holders.map((m) => m.missionId));
    const published = publishedHolders(b, existing.taskId);
    if (published.length && input.modality === 'GRAPHIC')
      return conflict('A task in a published mission cannot become graphic. Unpublish the mission first.', published.map((m) => m.missionId));
    existing.input = trimmed;
    return json(200, adminTask(b, existing));
  }
  const task: StoredTask = { taskId: newId(b, 'dddddddd'), status: 'DRAFT', images: [], input: trimmed };
  b.tasks.push(task);
  return json(201, adminTask(b, task));
}

async function images(b: FakeAdminBackend, request: Request, t: StoredTask, imageId: string | undefined): Promise<Response> {
  const method = request.method;
  if (imageId) {
    const index = t.images.findIndex((i) => i.imageId === imageId);
    if (index < 0) return problem(404, 'Resource not found');
    if (method === 'GET') return new Response(t.images[index].bytes.slice(), { status: 200, headers: { 'Content-Type': t.images[index].type } });
    t.images.splice(index, 1);
    return new Response(null, { status: 204 });
  }
  const list = () => adminTask(b, t).images;
  if (method === 'PUT') {
    const body = (await readJson(request)) as { imageIds?: string[] } | undefined;
    const ids = body?.imageIds ?? [];
    if (ids.length !== t.images.length || !ids.every((id) => t.images.some((i) => i.imageId === id)))
      return invalid([{ field: 'imageIds', message: 'List every image of the task once.' }]);
    t.images = ids.map((id) => t.images.find((i) => i.imageId === id) as StoredTask['images'][number]);
    return json(200, list());
  }
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof Blob) || file.size === 0) return invalid([{ field: 'file', message: 'Choose an image.' }]);
  if (t.images.length >= 10) return invalid([{ field: 'file', message: 'A task can have at most 10 images.' }]);
  if (file.size > 5 * MB) return problem(413, 'Payload too large', { detail: 'Only PNG or JPG files up to 5 MB are allowed.' });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPng(bytes) && !isJpg(bytes)) return problem(415, 'Unsupported media type', { detail: 'Only PNG or JPG files up to 5 MB are allowed.' });
  const image = { imageId: newId(b, 'eeeeeeee'), bytes, type: isPng(bytes) ? 'image/png' : 'image/jpeg' };
  t.images.push(image);
  return json(201, list().at(-1));
}

// ---------------------------------------------------------------- slice 6: edits, missions, deletes

async function updateSource(b: FakeAdminBackend, request: Request, source: S['Source']): Promise<Response> {
  const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
  const errors: FieldError[] = [];
  for (const key of Object.keys(body))
    if (!['title', 'publisher', 'edition', 'grade', 'subject'].includes(key)) errors.push({ field: key, message: `Unknown field: ${key}.` });
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const title = text(body.title);
  if (!title) errors.push({ field: 'title', message: 'Title is required.' });
  else if (codePoints(title) > 200) errors.push({ field: 'title', message: 'Title must be at most 200 characters.' });
  const publisher = text(body.publisher);
  if (publisher && codePoints(publisher) > 200) errors.push({ field: 'publisher', message: 'Publisher must be at most 200 characters.' });
  const edition = text(body.edition);
  if (edition && codePoints(edition) > 50) errors.push({ field: 'edition', message: 'Edition must be at most 50 characters.' });
  const grade = body.grade as number;
  if (!b.reference.grades.includes(grade)) errors.push({ field: 'grade', message: `Grade must be one of: ${b.reference.grades.join(', ')}.` });
  const subject = String(body.subject ?? '');
  if (!b.reference.subjects.includes(subject)) errors.push({ field: 'subject', message: `Subject must be one of: ${b.reference.subjects.join(', ')}.` });
  if (errors.length) return invalid(errors);
  const referencing = b.tasks.filter((t) => t.input.sourceRef.sourceId === source.sourceId);
  if (grade !== source.grade && referencing.length)
    return conflict(`The grade cannot change: ${plural(referencing.length, 'task references', 'tasks reference')} this source.`, referencing.map((t) => t.taskId));
  Object.assign(source, { title, publisher, edition, grade, subject });
  return json(200, source);
}

function deleteSource(b: FakeAdminBackend, source: S['Source']): Response {
  const referencing = b.tasks.filter((t) => t.input.sourceRef.sourceId === source.sourceId);
  if (referencing.length)
    return conflict(`${plural(referencing.length, 'task references', 'tasks reference')} this source. Delete or move those tasks first.`, referencing.map((t) => t.taskId));
  b.sources = b.sources.filter((s) => s.source.sourceId !== source.sourceId);
  return noContent();
}

async function setTaskStatus(b: FakeAdminBackend, request: Request, t: StoredTask): Promise<Response> {
  const body = (await readJson(request)) as S['StatusChange'] | undefined;
  if (body?.status !== 'DRAFT' && body?.status !== 'PUBLISHED') return invalid([{ field: 'status', message: 'Status must be DRAFT or PUBLISHED.' }]);
  const published = publishedHolders(b, t.taskId);
  if (body.status === 'DRAFT' && published.length)
    return conflict('The task is in a published mission. Unpublish the mission first.', published.map((m) => m.missionId));
  t.status = body.status;
  return json(200, adminTask(b, t));
}

function deleteTask(b: FakeAdminBackend, t: StoredTask): Response {
  if (b.usage.has(t.taskId)) return conflict('Practice records reference this task, so it cannot be deleted. Unpublish it instead.', [t.taskId]);
  const published = publishedHolders(b, t.taskId);
  if (published.length) return conflict('The task is in a published mission. Unpublish the mission first.', published.map((m) => m.missionId));
  b.tasks = b.tasks.filter((x) => x !== t);
  for (const m of b.missions) m.taskIds = m.taskIds.filter((id) => id !== t.taskId);
  return noContent();
}

const servable = (t: StoredTask | undefined) => t?.status === 'PUBLISHED' && t.input.modality === 'TEXT';

async function saveMission(b: FakeAdminBackend, request: Request, existing: StoredMission | null): Promise<Response> {
  const input = ((await readJson(request)) ?? {}) as Partial<S['MissionInput']>;
  // The topic of a non-empty mission is checked before any field (backend slice 6).
  if (existing && input.topicId !== existing.topicId && existing.taskIds.length)
    return conflict('The topic can change only while the mission has no tasks.', [...existing.taskIds]);
  const errors: FieldError[] = [];
  const topic = b.reference.topics.find((tp) => tp.topicId === input.topicId);
  if (!topic) errors.push({ field: 'topicId', message: 'Choose a topic.' });
  const position = input.position as number;
  if (!Number.isInteger(position) || position < 1 || position > 999) errors.push({ field: 'position', message: 'Position must be a whole number from 1 to 999.' });
  else if (b.missions.some((m) => m !== existing && m.topicId === input.topicId && m.position === position))
    errors.push({ field: 'position', message: `Position ${position} is already taken in this topic.` });
  const taskIds = Array.isArray(input.taskIds) ? input.taskIds : [];
  if (taskIds.length > 50) errors.push({ field: 'taskIds', message: 'A mission can have at most 50 tasks.' });
  taskIds.forEach((id, i) => {
    const t = b.tasks.find((x) => x.taskId === id);
    if (!t) errors.push({ field: `taskIds[${i}]`, message: 'Unknown task.' });
    else if (taskIds.indexOf(id) !== i) errors.push({ field: `taskIds[${i}]`, message: 'The task is already in the mission.' });
    else if (topic && t.input.topicId !== topic.topicId) {
      const other = b.reference.topics.find((tp) => tp.topicId === t.input.topicId);
      errors.push({ field: `taskIds[${i}]`, message: `The task is of topic ${other?.name}, the mission of topic ${topic.name}.` });
    }
  });
  if (errors.length) return invalid(errors);
  if (existing) {
    if (existing.status === 'PUBLISHED') {
      if (!taskIds.length) return conflict('The last task cannot be removed from a published mission. Unpublish the mission first.', [existing.missionId]);
      const blocking = taskIds.filter((id) => !existing.taskIds.includes(id) && !servable(b.tasks.find((t) => t.taskId === id)));
      if (blocking.length) return conflict('Only published text tasks can join a published mission.', blocking);
    }
    Object.assign(existing, { topicId: input.topicId, position, taskIds: [...taskIds] });
    return json(200, adminMission(b, existing));
  }
  const mission: StoredMission = { missionId: newId(b, 'ffffffff'), topicId: input.topicId as string, position, taskIds: [...taskIds], status: 'DRAFT' };
  b.missions.push(mission);
  return json(201, adminMission(b, mission));
}

async function setMissionStatus(b: FakeAdminBackend, request: Request, m: StoredMission): Promise<Response> {
  const body = (await readJson(request)) as S['StatusChange'] | undefined;
  if (body?.status !== 'DRAFT' && body?.status !== 'PUBLISHED') return invalid([{ field: 'status', message: 'Status must be DRAFT or PUBLISHED.' }]);
  if (body.status === 'PUBLISHED') {
    if (!m.taskIds.length) return conflict('A mission needs at least one task to be published.');
    const blocking = m.taskIds.filter((id) => !servable(b.tasks.find((t) => t.taskId === id)));
    if (blocking.length)
      return conflict(`Only published text tasks can be in a published mission: ${plural(blocking.length, 'task blocks', 'tasks block')} publishing.`, blocking);
  }
  m.status = body.status;
  return json(200, adminMission(b, m));
}

function deleteMission(b: FakeAdminBackend, m: StoredMission): Response {
  const used = m.taskIds.filter((id) => b.usage.has(id));
  if (used.length) return conflict('Practice records reference tasks of this mission, so it cannot be deleted. Unpublish it instead.', used);
  b.missions = b.missions.filter((x) => x !== m);
  return noContent();
}

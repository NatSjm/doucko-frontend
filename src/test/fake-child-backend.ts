import { deflateSync } from 'node:zlib';
import type { components } from '../api/generated/schema';
import { check, createFakeAdminBackend, FLAGS, FORMAT_TIP, seedStrings, SEED, type FakeAdminBackend, type StoredMission, type StoredTask } from './fake-admin-backend.ts';

/**
 * A stand-in for the child API of the pinned contract (`contract/api/openapi.yaml`, tags child-hq,
 * child-practice, child-profile), layered over the shared fake admin backend so both sides see the
 * same tasks and missions. It is a contract stub, not the backend: it keeps the practice state in
 * memory, answers with the contract's shapes and status codes, and applies the practice-flow rules
 * the UI must show (two attempts then a reveal, locks, UNPARSEABLE without cost, hints in order,
 * reports, the 404/409/400/413 refusals). XP fields stay 0 / [] / null as the backend returns them
 * until slice 8. All data is self-authored (NFR-4); the display name is the fictional e2e one (NFR-3).
 */
type S = components['schemas'];
type Problem = S['Problem'];
type Answers = Record<string, string | string[]>;

/** NFR-3: the fictional display name of every stubbed profile (the same as `e2e/fixtures/profile.ts`). */
export const CHILD_DISPLAY_NAME = 'Agent Nova';

/** Ids of the practice seed (self-authored, deterministic). */
export const PRACTICE = {
  missionA: 'ffffffff-ffff-4fff-8fff-000000000101',
  missionB: 'ffffffff-ffff-4fff-8fff-000000000102',
  missionPerimeter: 'ffffffff-ffff-4fff-8fff-000000000103',
  missionDraft: 'ffffffff-ffff-4fff-8fff-000000000104',
  taskSum: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000101',
  taskRound: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000102',
  taskLargest: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000103',
  taskThousands: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000104',
  taskMulti: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000105',
  taskSquare: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000106',
  taskHidden: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000107',
  imageSum: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000101',
} as const;

/** Practice prompts, for specs that look a task up by its text. */
export const PROMPTS = {
  sum: 'Sečti 0,5 + 0,25.',
  round: 'Zaokrouhli na desetiny: a) 3,46; b) 7,04.',
  largest: 'Které číslo je největší?',
  thousands: 'Kolik je 1 000 + 250?',
  multi: 'Vyber všechna čísla větší než 1.',
  square: 'Jaký obvod má čtverec o straně 2 cm?',
  hidden: 'Tahle úloha je jen v rozpracované misi.',
} as const;

const KB = 1024;
/** The format tip of an empty or unknown choice (self-authored; the backend sends its own Czech tip). */
export const CHOICE_TIP = 'Vyber prosím aspoň jednu z nabízených možností.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const codePoints = (s: string) => [...s].length;

// ---------------------------------------------------------------- a self-authored PNG (a number line)

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A 320×96 RGB PNG of a number line from 0 to 1 with ticks at the quarters (self-authored, NFR-4). */
export function makeNumberLinePng(): Uint8Array {
  const w = 320;
  const h = 96;
  const rows = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    rows[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) {
      const line = y >= 46 && y <= 49 && x >= 20 && x < 300;
      const tick = [20, 90, 160, 230, 296].some((tx) => x >= tx && x < tx + 4) && y >= 34 && y <= 61;
      const dot = (x - 197) ** 2 + (y - 47) ** 2 <= 49;
      const [r, g, b] = dot ? [223, 34, 80] : line || tick ? [27, 31, 59] : [255, 247, 239];
      const i = y * (1 + w * 3) + 1 + x * 3;
      rows[i] = r;
      rows[i + 1] = g;
      rows[i + 2] = b;
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, w);
  view.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ---------------------------------------------------------------- the practice seed

function task(taskId: string, topicId: string, prompt: string, parts: S['PartInput'][], extra: Partial<S['TaskInput']> = {}, images: StoredTask['images'] = []): StoredTask {
  return {
    taskId,
    status: 'PUBLISHED',
    images,
    input: {
      prompt,
      topicId,
      grade: 6,
      difficulty: 1,
      modality: 'TEXT',
      sourceRef: { sourceId: SEED.sourceId, page: 70, taskNo: '1', subPart: null },
      parts,
      hints: [],
      ...extra,
    },
  };
}

const typed = (key: string, type: S['AnswerType'], accepted: string[]): S['PartInput'] => ({ key, label: key, spec: { ...FLAGS, type, accepted } as S['AnswerSpec'] });
const choice = (key: string, type: 'CHOICE_SINGLE' | 'CHOICE_MULTI', options: [string, string][], accepted: string[]): S['PartInput'] => ({
  key,
  label: key,
  spec: { ...FLAGS, type, accepted, options: options.map(([k, text]) => ({ key: k, text })) } as S['AnswerSpec'],
});

/**
 * Three published missions over seven published tasks (every answer kind, a two-part task, hints, a
 * Ukrainian translation, an image) and one draft mission whose published task is never served. The
 * slice 6 seed mission (draft) moves to position 3 of its topic.
 */
function practiceSeed() {
  const tasks: StoredTask[] = [
    task(
      PRACTICE.taskSum,
      SEED.topicDecimals,
      PROMPTS.sum,
      [typed('a', 'DECIMAL', ['0.75'])],
      {
        hints: ['Zapiš obě čísla na setiny.', 'Sečti 50 setin a 25 setin.'],
        translations: { uk: { prompt: 'Додай 0,5 + 0,25.', partLabels: {}, hints: ['Запиши обидва числа в сотих.'], options: {} } },
      },
      [{ imageId: PRACTICE.imageSum, bytes: makeNumberLinePng(), type: 'image/png' }],
    ),
    task(PRACTICE.taskRound, SEED.topicDecimals, PROMPTS.round, [typed('a', 'DECIMAL', ['3.5']), typed('b', 'DECIMAL', ['7'])]),
    task(PRACTICE.taskLargest, SEED.topicDecimals, PROMPTS.largest, [choice('a', 'CHOICE_SINGLE', [['A', '0,7'], ['B', '0,65'], ['C', '0,07']], ['A'])], {
      hints: ['Porovnej nejdřív desetiny.'],
      translations: { uk: { prompt: 'Яке число найбільше?', partLabels: {}, hints: [], options: {} } },
    }),
    task(PRACTICE.taskThousands, SEED.topicDecimals, PROMPTS.thousands, [typed('a', 'INTEGER', ['1250'])], {
      translations: { uk: { prompt: 'Скільки буде 1 000 + 250?', partLabels: {}, hints: [], options: {} } },
    }),
    task(PRACTICE.taskMulti, SEED.topicDecimals, PROMPTS.multi, [choice('a', 'CHOICE_MULTI', [['A', '1,5'], ['B', '0,9'], ['C', '2']], ['A', 'C'])]),
    task(PRACTICE.taskSquare, SEED.topicPerimeter, PROMPTS.square, [typed('a', 'NUMBER_WITH_UNIT', ['8 cm'])], { hints: ['Čtverec má čtyři stejné strany.'] }),
    task(PRACTICE.taskHidden, SEED.topicPerimeter, PROMPTS.hidden, [typed('a', 'INTEGER', ['3'])]),
  ];
  const missions: StoredMission[] = [
    { missionId: PRACTICE.missionA, topicId: SEED.topicDecimals, position: 1, taskIds: [PRACTICE.taskSum, PRACTICE.taskRound, PRACTICE.taskLargest], status: 'PUBLISHED' },
    { missionId: PRACTICE.missionB, topicId: SEED.topicDecimals, position: 2, taskIds: [PRACTICE.taskThousands, PRACTICE.taskMulti], status: 'PUBLISHED' },
    { missionId: PRACTICE.missionPerimeter, topicId: SEED.topicPerimeter, position: 1, taskIds: [PRACTICE.taskSquare], status: 'PUBLISHED' },
    { missionId: PRACTICE.missionDraft, topicId: SEED.topicPerimeter, position: 2, taskIds: [PRACTICE.taskHidden], status: 'DRAFT' },
  ];
  return { tasks, missions };
}

/** Every string of both seeds and the display name: the `⟦` test accepts exactly these as content. */
export function allSeedStrings(): Set<string> {
  const out = seedStrings();
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.add(v.trim());
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(practiceSeed().tasks.map((t) => t.input));
  out.add(CHILD_DISPLAY_NAME);
  out.add(FORMAT_TIP);
  out.add(CHOICE_TIP);
  return out;
}

// ---------------------------------------------------------------- practice state

interface TaskProgress {
  attemptsUsed: number;
  state: S['TaskState'];
  /** Parts locked as correct on attempt 1, with their normalized value. */
  locked: Record<string, string>;
  last: S['AttemptResult'] | null;
  /** The raw answers of the latest graded attempt (attached to reports, FR-30). */
  lastRaw: Answers | null;
}

export interface StoredReport {
  missionId: string;
  taskId: string;
  reason: S['ReportReason'];
  note: string | null;
  attempt: Answers | null;
}

export interface PracticeState {
  displayName: string;
  settings: S['ProfileSettings'];
  progress: Map<string, TaskProgress>;
  /** Opened hints per task (recorded with the task, FR-28). */
  hintsOpened: Map<string, number>;
  /** Every graded attempt, in order (the attempt log as the stub keeps it). */
  attempts: { missionId: string; taskId: string; attemptNo: number; answers: Answers }[];
  reports: StoredReport[];
  /** Missions in the order they were last practised (latest last). */
  practised: string[];
  /** The next child request matching this is processed and stored, then its response is lost. */
  dropResponse: ((method: string, path: string) => boolean) | null;
}

export interface FakeBackend extends FakeAdminBackend {
  practice: PracticeState;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, title: string, extra: Partial<Problem> = {}) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, ...extra }), { status, headers: { 'Content-Type': 'application/problem+json' } });
const invalid = (field: string, message: string) => problem(400, 'Invalid input', { detail: message, errors: [{ field, message }] });
const notFound = () => problem(404, 'Resource not found');
/** A body that is empty or not exactly one JSON object: 400 without `errors` (backend slice 7). */
const malformed = () => problem(400, 'Malformed request', { detail: 'The request body must be one JSON object.' });
/** A path id that is not a UUID: 400 naming the parameter, before any lookup (contract "Field paths"). */
const badId = (name: string) => invalid(name, `${name} must be a UUID.`);

/**
 * The shared fake backend with the child API: admin and child requests see the same content. Options
 * as `createFakeAdminBackend`, plus `practice` (default true) to load the practice seed.
 */
export function createFakeBackend(options: { signedIn?: boolean; seeded?: boolean; practice?: boolean } = {}): FakeBackend {
  const b = createFakeAdminBackend({ signedIn: options.signedIn, seeded: options.seeded }) as FakeBackend;
  b.practice = {
    displayName: CHILD_DISPLAY_NAME,
    settings: { secondaryTaskLocale: null, answerMode: 'DIRECT' },
    progress: new Map(),
    hintsOpened: new Map(),
    attempts: [],
    reports: [],
    practised: [],
    dropResponse: null,
  };
  if (options.practice ?? true) {
    const seed = practiceSeed();
    for (const m of b.missions) if (m.missionId === SEED.missionDecimals) m.position = 3;
    b.tasks.push(...seed.tasks);
    b.missions.push(...seed.missions);
  }
  const admin = b.handle;
  b.handle = async (request) => {
    const url = new URL(request.url);
    // The admin handler answers the shared switches (down, failWith, override) for every path.
    if (!url.pathname.startsWith('/api/child/') || b.down || b.failWith || b.override?.match(request.method, url.pathname)) return admin(request);
    const response = await handleChild(b, request, url);
    if (b.practice.dropResponse?.(request.method, url.pathname)) {
      b.practice.dropResponse = null;
      throw new TypeError('Failed to fetch');
    }
    return response;
  };
  return b;
}

// ---------------------------------------------------------------- views

const servable = (t: StoredTask | undefined): t is StoredTask => t?.status === 'PUBLISHED' && t.input.modality === 'TEXT';
const published = (b: FakeBackend) => b.missions.filter((m) => m.status === 'PUBLISHED');
const progressOf = (b: FakeBackend, taskId: string): TaskProgress => {
  let p = b.practice.progress.get(taskId);
  if (!p) {
    p = { attemptsUsed: 0, state: 'UNRESOLVED', locked: {}, last: null, lastRaw: null };
    b.practice.progress.set(taskId, p);
  }
  return p;
};
const resolved = (b: FakeBackend, taskId: string) => (b.practice.progress.get(taskId)?.state ?? 'UNRESOLVED') !== 'UNRESOLVED';
/** Activity on a task: an attempt or an opened hint (backend slice 7: either makes a mission IN_PROGRESS). */
const touched = (b: FakeBackend, taskId: string) => (b.practice.progress.get(taskId)?.attemptsUsed ?? 0) > 0 || (b.practice.hintsOpened.get(taskId) ?? 0) > 0;

function missionState(b: FakeBackend, m: StoredMission): S['MissionState'] {
  if (m.taskIds.every((id) => resolved(b, id))) return 'COMPLETE';
  return m.taskIds.some((id) => resolved(b, id) || touched(b, id)) ? 'IN_PROGRESS' : 'NEW';
}

function localized(b: FakeBackend, cs: string, other: string | null | undefined): S['LocalizedText'] {
  const locale = b.practice.settings.secondaryTaskLocale;
  return { cs, secondary: locale && other ? { locale, text: other } : null };
}

function openedHint(b: FakeBackend, t: StoredTask, index: number): S['OpenedHint'] {
  const tr = b.practice.settings.secondaryTaskLocale ? t.input.translations?.[b.practice.settings.secondaryTaskLocale] : undefined;
  return { index, text: localized(b, t.input.hints[index - 1], tr?.hints?.[index - 1]), remaining: t.input.hints.length - index };
}

function taskView(b: FakeBackend, m: StoredMission, t: StoredTask): S['TaskView'] {
  const locale = b.practice.settings.secondaryTaskLocale;
  const tr = locale ? t.input.translations?.[locale] : undefined;
  const p = progressOf(b, t.taskId);
  const opened = b.practice.hintsOpened.get(t.taskId) ?? 0;
  return {
    taskId: t.taskId,
    missionId: m.missionId,
    position: m.taskIds.indexOf(t.taskId) + 1,
    prompt: localized(b, t.input.prompt, tr?.prompt),
    translationAvailable: !!t.input.translations?.uk,
    images: t.images.map((img) => ({ imageId: img.imageId, url: `/api/child/images/${img.imageId}` })),
    parts: t.input.parts.map((part) => ({
      key: part.key,
      label: localized(b, part.label, tr?.partLabels?.[part.key]),
      type: part.spec.type,
      unit: part.spec.type === 'NUMBER_WITH_UNIT' ? (part.spec.accepted[0]?.split(' ')[1] ?? null) : null,
      options: part.spec.options?.map((o) => ({ key: o.key, text: localized(b, o.text, tr?.options?.[`${part.key}.${o.key}`]) })),
    })),
    hints: { total: t.input.hints.length, opened: Array.from({ length: opened }, (_, i) => openedHint(b, t, i + 1)) },
    maxAttempts: 2,
    attemptsUsed: p.attemptsUsed,
    state: p.state,
    lastFeedback: p.last ? { ...p.last, rankUp: null } : null,
  };
}

function hq(b: FakeBackend): S['HqView'] {
  const topics = b.reference.topics
    .map((topic) => ({
      topicId: topic.topicId,
      name: topic.name,
      missions: published(b)
        .filter((m) => m.topicId === topic.topicId)
        .sort((x, y) => x.position - y.position)
        .map((m) => ({ missionId: m.missionId, position: m.position, taskCount: m.taskIds.length, resolvedCount: m.taskIds.filter((id) => resolved(b, id)).length, state: missionState(b, m) })),
    }))
    .filter((topic) => topic.missions.length > 0);
  const inProgress = published(b).filter((m) => missionState(b, m) === 'IN_PROGRESS');
  const latest = [...b.practice.practised].reverse().map((id) => inProgress.find((m) => m.missionId === id)).find(Boolean) ?? inProgress[0];
  const firstOpen = latest?.taskIds.find((id) => !resolved(b, id));
  const solvedTasks = [...b.practice.progress.values()].filter((p) => p.state !== 'UNRESOLVED').length;
  return {
    displayName: b.practice.displayName,
    totalXp: 0,
    solvedTasks,
    rank: { index: 0, name: 'Kadetka', minXp: 0 },
    nextRank: { index: 1, name: 'Parťačka', minXp: 100 },
    continueTarget: latest && firstOpen ? { missionId: latest.missionId, taskId: firstOpen } : null,
    pendingRankUp: null,
    topics,
  };
}

// ---------------------------------------------------------------- handlers

async function readBody(request: Request): Promise<{ tooLarge: true } | { tooLarge: false; value: unknown }> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 16 * KB) return { tooLarge: true };
  try {
    return { tooLarge: false, value: text ? JSON.parse(text) : undefined };
  } catch {
    return { tooLarge: false, value: undefined };
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

async function handleChild(b: FakeBackend, request: Request, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  if (path === '/api/child/hq') return method === 'GET' ? json(200, hq(b)) : problem(405, 'Method not allowed');
  if (path === '/api/child/profile/settings') return settings(b, request);
  const image = /^\/api\/child\/images\/([^/]+)$/.exec(path);
  if (image && method === 'GET') {
    if (!UUID.test(image[1])) return badId('imageId');
    const owner = b.tasks.find((t) => t.images.some((i) => i.imageId === image[1]));
    const served = owner && servable(owner) && published(b).some((m) => m.taskIds.includes(owner.taskId));
    const stored = owner?.images.find((i) => i.imageId === image[1]);
    return served && stored ? new Response(stored.bytes.slice(), { status: 200, headers: { 'Content-Type': stored.type } }) : notFound();
  }
  const match = /^\/api\/child\/missions\/([^/]+)(?:\/(current-task)|\/tasks\/([^/]+)(?:\/(attempts|hints|reports))?)?$/.exec(path);
  if (!match) return notFound();
  const [, missionId, current, taskId, sub] = match;
  if (!UUID.test(missionId)) return badId('missionId');
  if (taskId !== undefined && !UUID.test(taskId)) return badId('taskId');
  // A published mission without a served task is not served either.
  const m = published(b).find((x) => x.missionId === missionId && x.taskIds.some((id) => servable(b.tasks.find((t) => t.taskId === id))));
  if (!m) return notFound();
  if (!current && !taskId) {
    if (method !== 'GET') return problem(405, 'Method not allowed');
    const briefing: S['MissionBriefing'] = {
      missionId: m.missionId,
      position: m.position,
      topicName: b.reference.topics.find((tp) => tp.topicId === m.topicId)?.name ?? '',
      state: missionState(b, m),
      xpAvailable: 0,
      tasks: m.taskIds.map((id, i) => ({ taskId: id, position: i + 1, state: b.practice.progress.get(id)?.state ?? 'UNRESOLVED' })),
    };
    return json(200, briefing);
  }
  if (current) {
    const next = m.taskIds.find((id) => !resolved(b, id));
    if (!next) return new Response(null, { status: 204 });
    return json(200, taskView(b, m, b.tasks.find((t) => t.taskId === next) as StoredTask));
  }
  const t = b.tasks.find((x) => x.taskId === taskId);
  if (!m.taskIds.includes(taskId) || !servable(t)) return notFound();
  if (!sub) return method === 'GET' ? json(200, taskView(b, m, t)) : problem(405, 'Method not allowed');
  if (method !== 'POST') return problem(405, 'Method not allowed');
  if (sub === 'hints') {
    const opened = b.practice.hintsOpened.get(t.taskId) ?? 0;
    if (opened >= t.input.hints.length) return problem(409, 'No hint left', { detail: 'Every hint of this task is open.' });
    b.practice.hintsOpened.set(t.taskId, opened + 1);
    return json(200, openedHint(b, t, opened + 1));
  }
  const body = await readBody(request);
  if (body.tooLarge) return problem(413, 'Payload too large', { detail: 'A child request body may be at most 16 KB.' });
  if (sub === 'reports') return report(b, m, t, body.value);
  return attempt(b, m, t, body.value);
}

async function settings(b: FakeBackend, request: Request): Promise<Response> {
  if (request.method === 'GET') return json(200, b.practice.settings);
  if (request.method !== 'PATCH') return problem(405, 'Method not allowed');
  const body = await readBody(request);
  if (body.tooLarge) return problem(413, 'Payload too large');
  if (!isObject(body.value)) return malformed();
  const patch = body.value;
  const next = { ...b.practice.settings };
  if ('secondaryTaskLocale' in patch) {
    const locale = patch.secondaryTaskLocale;
    if (locale !== null && !(typeof locale === 'string' && b.reference.taskLocales.includes(locale)))
      return invalid('secondaryTaskLocale', `Supported task locales: ${b.reference.taskLocales.join(', ')}.`);
    next.secondaryTaskLocale = locale as string | null;
  }
  if ('answerMode' in patch) {
    if (patch.answerMode !== 'DIRECT' && patch.answerMode !== 'GUIDED') return invalid('answerMode', 'Answer mode must be DIRECT.');
    if (patch.answerMode === 'GUIDED') return problem(422, 'Not available yet', { detail: 'Guided mode is not available yet.' });
  }
  b.practice.settings = next;
  return json(200, next);
}

function report(b: FakeBackend, m: StoredMission, t: StoredTask, value: unknown): Response {
  if (!isObject(value)) return malformed();
  const reason = value.reason;
  if (reason !== 'ANSWER_IS_CORRECT' && reason !== 'UNCLEAR_PROMPT' && reason !== 'OTHER') return invalid('reason', 'Choose a reason.');
  if (value.note !== undefined && value.note !== null && typeof value.note !== 'string') return invalid('note', 'The note must be text.');
  const note = typeof value.note === 'string' && value.note.trim() ? value.note.trim() : null;
  if (reason === 'OTHER' && !note) return invalid('note', 'Describe the problem.');
  if (note && codePoints(note) > 1000) return invalid('note', 'The note may have at most 1000 characters.');
  b.practice.reports.push({ missionId: m.missionId, taskId: t.taskId, reason, note, attempt: b.practice.progress.get(t.taskId)?.lastRaw ?? null });
  return new Response(null, { status: 201 });
}

/** The answer a reveal shows: the first accepted answer as entered; the correct option keys for a choice. */
const revealed = (part: S['PartInput']) => (part.spec.type === 'CHOICE_SINGLE' || part.spec.type === 'CHOICE_MULTI' ? [...part.spec.accepted] : part.spec.accepted[0]);

function attempt(b: FakeBackend, m: StoredMission, t: StoredTask, value: unknown): Response {
  if (!isObject(value)) return malformed();
  if (!isObject(value.answers)) return invalid('answers', 'Send the answers.');
  const answers = value.answers;
  for (const [key, raw] of Object.entries(answers)) {
    const part = t.input.parts.find((p) => p.key === key);
    const field = `answers.${key}`;
    if (!part) return invalid(field, `The task has no part ${key}.`);
    const isChoice = part.spec.type === 'CHOICE_SINGLE' || part.spec.type === 'CHOICE_MULTI';
    if (isChoice) {
      if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) return invalid(field, 'A choice part takes a list of option keys.');
      if (raw.length > 20 || raw.some((x) => codePoints(x) > 100)) return invalid(field, 'Too many or too long options.');
    } else if (typeof raw !== 'string') return invalid(field, 'A typed part takes text.');
  }
  const p = progressOf(b, t.taskId);
  if (p.state !== 'UNRESOLVED') return problem(409, 'Task already resolved', { detail: 'This task is already resolved in this run.' });
  const open = t.input.parts.filter((part) => !(part.key in p.locked));
  const graded = open.map((part) => {
    const raw = answers[part.key] as string | string[] | undefined;
    if (typeof raw === 'string' && codePoints(raw) > 100) return { key: part.key, verdict: 'UNPARSEABLE' as const, normalized: null, formatTip: FORMAT_TIP, locked: false };
    // A missing, empty or unknown choice is unreadable, not wrong (answer-checking "Multiple choice").
    const options = part.spec.options?.map((o) => o.key);
    if (options && (!Array.isArray(raw) || raw.length === 0 || raw.some((k) => !options.includes(k))))
      return { key: part.key, verdict: 'UNPARSEABLE' as const, normalized: null, formatTip: CHOICE_TIP, locked: false };
    return check(part, raw);
  });
  const unreadable = graded.filter((r) => r.verdict === 'UNPARSEABLE');
  const attemptsLeft = 2 - p.attemptsUsed;
  if (unreadable.length)
    return json(200, {
      status: 'UNPARSEABLE',
      attemptNo: null,
      parts: unreadable,
      taskState: p.state,
      attemptsLeft,
      xpAwarded: 0,
      bonusXp: 0,
      completedMissionIds: [],
      feedback: null,
      rankUp: null,
      missionComplete: false,
    } satisfies S['AttemptResult']);
  const completeBefore = new Set(published(b).filter((x) => missionState(b, x) === 'COMPLETE').map((x) => x.missionId));
  const attemptNo = p.attemptsUsed + 1;
  const parts: S['PartResult'][] = t.input.parts.map((part) =>
    part.key in p.locked
      ? { key: part.key, verdict: 'CORRECT', normalized: p.locked[part.key], formatTip: null, locked: true }
      : (graded.find((r) => r.key === part.key) as S['PartResult']),
  );
  const correct = parts.every((r) => r.verdict === 'CORRECT');
  p.attemptsUsed = attemptNo;
  p.state = correct ? (attemptNo === 1 ? 'CORRECT_FIRST_TRY' : 'CORRECT_SECOND_TRY') : attemptNo === 2 ? 'REVEALED' : 'UNRESOLVED';
  for (const r of parts) if (r.verdict === 'CORRECT' && !r.locked) p.locked[r.key] = r.normalized ?? '';
  p.lastRaw = { ...Object.fromEntries(Object.entries(answers) as [string, string | string[]][]) };
  b.practice.attempts.push({ missionId: m.missionId, taskId: t.taskId, attemptNo, answers: p.lastRaw });
  b.practice.practised = [...b.practice.practised.filter((id) => id !== m.missionId), m.missionId];
  const opened = b.practice.hintsOpened.get(t.taskId) ?? 0;
  const completed = published(b).filter((x) => missionState(b, x) === 'COMPLETE' && !completeBefore.has(x.missionId)).map((x) => x.missionId);
  const result: S['AttemptResult'] = {
    status: 'GRADED',
    attemptNo,
    parts,
    taskState: p.state,
    attemptsLeft: 2 - attemptNo,
    xpAwarded: 0,
    bonusXp: 0,
    completedMissionIds: completed,
    feedback: {
      nextHintIndex: opened < t.input.hints.length ? opened + 1 : null,
      revealedAnswers: p.state === 'REVEALED' ? t.input.parts.map((part) => ({ key: part.key, answer: revealed(part) })) : null,
    },
    rankUp: null,
    missionComplete: m.taskIds.every((id) => resolved(b, id)),
  };
  p.last = result;
  return json(200, result);
}

/** Sends one child request straight to the stub (test setup: earlier practice, a second browser). */
export async function childRequest(b: FakeBackend, method: string, path: string, body?: unknown): Promise<Response> {
  return b.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

/** Submits an attempt as earlier practice would have; returns the stub's answer. */
export async function practise(b: FakeBackend, missionId: string, taskId: string, answers: Answers): Promise<S['AttemptResult']> {
  return (await childRequest(b, 'POST', `/api/child/missions/${missionId}/tasks/${taskId}/attempts`, { answers })).json();
}

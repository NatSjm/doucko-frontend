import type { components } from '../api/generated/schema';

/**
 * The progress-stats half of the admin contract stub (`getStats`, `listReports`, `reevaluateReport`,
 * `dismissReport`; store spec progress-stats), wired into `fake-admin-backend.ts`. It keeps a weekly
 * history and the first-try counts per topic, and a flag queue of self-authored reports (NFR-4) in
 * every status. Figures are served as stored, the way the backend serves its computed ones: the
 * session and week arithmetic is the backend's (FR-40). Re-evaluation re-checks the attached attempt
 * against the task's current answer spec and awards the XP difference (gamification defaults);
 * replay attempts earn nothing; refusals answer 400 / 404 / 409 as problem+json.
 */
type S = components['schemas'];
type Problem = S['Problem'];

/** One week of the stored history: the answered-task count of each session, hints and reveals. */
export interface WeekFigures {
  tasksPerSession: number[];
  hintsUsed: number;
  revealed: number;
}

export interface StoredReport {
  report: S['Report'];
  /** The task's first-resolution outcome now (what a re-evaluation may improve). */
  taskState: S['TaskState'];
  /** Missions a re-evaluation of this report would complete (their bonus is paid with it). */
  completes: string[];
}

export interface ProgressState {
  /** Today in Europe/Prague (`YYYY-MM-DD`): its week is the current week. */
  today: string;
  /** Index 0 is the current week, 1 the last completed week, and so on; missing weeks are zeros. */
  history: WeekFigures[];
  /** First-try counts per topic id; a topic without an entry has nothing resolved. */
  firstTry: Record<string, { resolved: number; firstTry: number }>;
  reports: StoredReport[];
  /** Every XP award a re-evaluation made, in order. */
  awards: { reportId: string; xp: number; bonus: number }[];
  /** The time a re-evaluation is recorded at. */
  now: string;
}

/** What the progress handler needs from the admin backend (the current tasks and topics). */
export interface ProgressHost {
  progress: ProgressState;
  tasks: { taskId: string; input: { topicId: string; parts: S['PartInput'][] } }[];
  reference: S['ReferenceData'];
}

type Check = (part: S['PartInput'], answer: string | string[] | undefined) => S['PartResult'];

/** Ids of the flag-queue seed (self-authored, deterministic). */
export const REPORTS = {
  openRevealed: '99999999-9999-4999-8999-000000000001',
  openNoAttempt: '99999999-9999-4999-8999-000000000002',
  openReplay: '99999999-9999-4999-8999-000000000003',
  dismissedLong: '99999999-9999-4999-8999-000000000004',
  fixed: '99999999-9999-4999-8999-000000000005',
} as const;

/** A TEXT raw input of exactly 100 Unicode code points (the longest input the checker grades). */
export const LONG_RAW = 'Sečetla jsem všechny strany obdélníku: 3cm+4cm+3cm+4cm=14cm, takže obvod je čtrnáct centimetrů. Ano!';

/** The child's notes in the seed (self-authored). */
export const NOTES = {
  half: 'Polovina je přece 0,5.',
  unclear: 'Nevím, jestli se počítá i číslo 4.',
  words: 'Napsala jsem to slovy.',
} as const;

/** The task ids the seed reports point at (the admin seed's tasks). */
export interface SeedTasks {
  decimal: { taskId: string; prompt: string };
  choice: { taskId: string; prompt: string };
  perimeter: { taskId: string; prompt: string };
  topicDecimals: string;
  topicPerimeter: string;
}

const excerpt = (prompt: string) => (prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt);

function attempt(no: number, raw: Record<string, string | string[]>, normalized: Record<string, string | null>, verdicts: Record<string, S['Verdict']>, extra: Partial<S['LoggedAttempt']>): S['LoggedAttempt'] {
  return {
    attemptId: `77777777-7777-4777-8777-${String(no).padStart(12, '0')}`,
    attemptNo: no,
    rawInput: raw,
    normalized,
    verdicts,
    hintsUsed: 0,
    createdAt: '2026-10-05T14:18:00Z',
    replay: false,
    reevaluation: null,
    ...extra,
  };
}

/**
 * The seed: a weekly history where 3 of the 4 completed weeks have 3 qualifying sessions and one has
 * 2 (metric not met), the decimals topic at 6 of 8 first try, and reports in every status — an OPEN
 * report after a reveal (attempt 2 `0,5`, the "Re-evaluation awards the missing XP" scenario), an
 * OPEN report with no attempt, an OPEN report on a replay attempt, a DISMISSED report with a
 * 100-code-point raw input, and a FIXED report showing both verdicts. `seeded: false` has no
 * practice at all.
 */
export function createProgress(tasks: SeedTasks, seeded = true): ProgressState {
  const state: ProgressState = { today: '2026-10-07', history: [], firstTry: {}, reports: [], awards: [], now: '2026-10-07T16:00:00Z' };
  if (!seeded) return state;
  state.history = [
    { tasksPerSession: [4], hintsUsed: 2, revealed: 0 },
    { tasksPerSession: [12, 10, 11], hintsUsed: 7, revealed: 3 },
    { tasksPerSession: [11, 10, 10, 6], hintsUsed: 4, revealed: 1 },
    { tasksPerSession: [10, 6, 12], hintsUsed: 5, revealed: 2 },
    { tasksPerSession: [10, 10, 12, 5], hintsUsed: 3, revealed: 0 },
  ];
  state.firstTry = { [tasks.topicDecimals]: { resolved: 8, firstTry: 6 } };
  const report = (r: Omit<S['Report'], 'taskPromptExcerpt'> & { prompt: string }): S['Report'] => {
    const { prompt, ...rest } = r;
    return { ...rest, taskPromptExcerpt: excerpt(prompt) };
  };
  state.reports = [
    {
      taskState: 'REVEALED',
      completes: [],
      report: report({
        reportId: REPORTS.openRevealed,
        taskId: tasks.decimal.taskId,
        prompt: tasks.decimal.prompt,
        reason: 'ANSWER_IS_CORRECT',
        note: NOTES.half,
        status: 'OPEN',
        createdAt: '2026-10-05T14:20:00Z',
        attempt: attempt(2, { a: '0,5' }, { a: '0.5' }, { a: 'WRONG' }, {}),
      }),
    },
    {
      taskState: 'UNRESOLVED',
      completes: [],
      report: report({
        reportId: REPORTS.openNoAttempt,
        taskId: tasks.choice.taskId,
        prompt: tasks.choice.prompt,
        reason: 'UNCLEAR_PROMPT',
        note: NOTES.unclear,
        status: 'OPEN',
        createdAt: '2026-10-07T15:05:00Z',
        attempt: null,
      }),
    },
    {
      taskState: 'CORRECT_SECOND_TRY',
      completes: [],
      report: report({
        reportId: REPORTS.openReplay,
        taskId: tasks.perimeter.taskId,
        prompt: tasks.perimeter.prompt,
        reason: 'ANSWER_IS_CORRECT',
        note: null,
        status: 'OPEN',
        createdAt: '2026-10-06T16:40:00Z',
        attempt: attempt(3, { a: '14cm' }, { a: '14 cm' }, { a: 'WRONG' }, { attemptNo: 1, hintsUsed: 1, replay: true, createdAt: '2026-10-06T16:38:00Z' }),
      }),
    },
    {
      taskState: 'CORRECT_SECOND_TRY',
      completes: [],
      report: report({
        reportId: REPORTS.dismissedLong,
        taskId: tasks.perimeter.taskId,
        prompt: tasks.perimeter.prompt,
        reason: 'OTHER',
        note: NOTES.words,
        status: 'DISMISSED',
        createdAt: '2026-09-27T18:00:00Z',
        attempt: attempt(4, { a: LONG_RAW }, { a: null }, { a: 'WRONG' }, { attemptNo: 1, createdAt: '2026-09-27T17:58:00Z' }),
      }),
    },
    {
      taskState: 'CORRECT_FIRST_TRY',
      completes: [],
      report: report({
        reportId: REPORTS.fixed,
        taskId: tasks.choice.taskId,
        prompt: tasks.choice.prompt,
        reason: 'ANSWER_IS_CORRECT',
        note: null,
        status: 'FIXED',
        createdAt: '2026-10-02T10:00:00Z',
        attempt: attempt(5, { a: ['C'] }, { a: 'C' }, { a: 'WRONG' }, {
          attemptNo: 1,
          createdAt: '2026-10-02T09:58:00Z',
          reevaluation: { verdicts: { a: 'CORRECT' }, reevaluatedAt: '2026-10-03T08:30:00Z' },
        }),
      }),
    },
  ];
  return state;
}

/** Every child-entered string of the seed (excerpts, notes, raw input): the `⟦` test's content. */
export function progressSeedStrings(state: ProgressState): string[] {
  const out: string[] = [];
  for (const { report } of state.reports) {
    out.push(report.taskPromptExcerpt);
    if (report.note) out.push(report.note);
    for (const value of Object.values(report.attempt?.rawInput ?? {})) out.push(...(Array.isArray(value) ? value : [value]));
  }
  return out;
}

// ---------------------------------------------------------------- the handler

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, title: string, extra: Partial<Problem> = {}) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, ...extra }), { status, headers: { 'Content-Type': 'application/problem+json' } });
const invalid = (field: string, message: string) => problem(400, 'Invalid input', { detail: message, errors: [{ field, message }] });
const conflict = (detail: string) => problem(409, 'Not allowed now', { detail });

const WEEKS = /^([1-9]|[1-4][0-9]|5[0-2])$/;
const STATUSES: readonly string[] = ['OPEN', 'FIXED', 'DISMISSED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 24 * 60 * 60 * 1000;

/** The Monday (`YYYY-MM-DD`) of the week `offset` weeks before the week of `today`. */
export function weekStart(today: string, offset: number): string {
  const date = new Date(`${today}T00:00:00Z`);
  const monday = date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY - offset * 7 * DAY;
  return new Date(monday).toISOString().slice(0, 10);
}

const qualifying = (w: WeekFigures | undefined) => (w?.tasksPerSession ?? []).filter((n) => n >= 10).length;

function stats(h: ProgressHost, url: URL): Response {
  const p = h.progress;
  const raw = url.searchParams.get('weeks');
  if (raw !== null && !WEEKS.test(raw)) return invalid('weeks', 'weeks must be a whole number from 1 to 52.');
  const count = raw === null ? 4 : Number(raw);
  const weeks: S['WeekStats'][] = Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    const w = p.history[offset];
    const sizes = w?.tasksPerSession ?? [];
    return { weekStart: weekStart(p.today, offset), sessions: sizes.length, qualifyingSessions: qualifying(w), tasksPerSession: [...sizes], hintsUsed: w?.hintsUsed ?? 0, revealed: w?.revealed ?? 0 };
  });
  const body: S['Stats'] = {
    weeks,
    firstTryRateByTopic: h.reference.topics.map((t) => ({ topicId: t.topicId, topicName: t.name, ...(p.firstTry[t.topicId] ?? { resolved: 0, firstTry: 0 }) })),
    metricMet: [1, 2, 3, 4].every((offset) => qualifying(p.history[offset]) >= 3),
  };
  return json(200, body);
}

const RANK: Record<S['TaskState'], number> = { UNRESOLVED: 0, REVEALED: 1, CORRECT_SECOND_TRY: 2, CORRECT_FIRST_TRY: 3 };

/** The task XP of an outcome with `hints` opened (gamification defaults: 10 / 5 / 1, −2 per hint, at least 1). */
function award(state: S['TaskState'], hints: number): number {
  if (state === 'UNRESOLVED') return 0;
  if (state === 'REVEALED') return 1;
  return Math.max(1, (state === 'CORRECT_FIRST_TRY' ? 10 : 5) - 2 * hints);
}

function ordered(reports: StoredReport[]): StoredReport[] {
  const open = (r: StoredReport) => (r.report.status === 'OPEN' ? 0 : 1);
  return [...reports].sort((a, b) => open(a) - open(b) || a.report.createdAt.localeCompare(b.report.createdAt));
}

function reevaluate(h: ProgressHost, stored: StoredReport, check: Check): Response {
  const { report } = stored;
  if (report.status !== 'OPEN') return conflict(`Only an open report can be re-evaluated; this one is ${report.status}.`);
  const logged = report.attempt;
  if (!logged) return conflict('This report has no attempt to re-evaluate.');
  const unchanged = () => json(200, { changed: false, xpAwarded: 0, bonusXp: 0, completedMissionIds: [], newTaskState: null, report } satisfies S['ReevaluationResult']);
  const task = h.tasks.find((t) => t.taskId === report.taskId);
  if (!task) return unchanged();
  // A part locked as correct on attempt 1 was not re-entered on attempt 2: it stays CORRECT (backend slice 9).
  const results = task.input.parts.map((part) =>
    logged.rawInput[part.key] === undefined && logged.verdicts[part.key] === 'CORRECT' ? { key: part.key, verdict: 'CORRECT' as const } : check(part, logged.rawInput[part.key]),
  );
  const correct = results.length > 0 && results.every((r) => r.verdict === 'CORRECT');
  const wasCorrect = Object.values(logged.verdicts).every((v) => v === 'CORRECT');
  if (!correct || wasCorrect) return unchanged();
  const record = () => {
    logged.reevaluation = { verdicts: Object.fromEntries(results.map((r) => [r.key, r.verdict])), reevaluatedAt: h.progress.now };
    report.status = 'FIXED';
  };
  if (logged.replay) {
    record();
    return json(200, { changed: true, xpAwarded: 0, bonusXp: 0, completedMissionIds: [], newTaskState: null, report } satisfies S['ReevaluationResult']);
  }
  const outcome: S['TaskState'] = logged.attemptNo === 1 ? 'CORRECT_FIRST_TRY' : 'CORRECT_SECOND_TRY';
  if (RANK[outcome] <= RANK[stored.taskState]) return unchanged();
  const xp = award(outcome, logged.hintsUsed) - award(stored.taskState, logged.hintsUsed);
  const bonus = 20 * stored.completes.length;
  const counts = (h.progress.firstTry[task.input.topicId] ??= { resolved: 0, firstTry: 0 });
  if (stored.taskState === 'UNRESOLVED') counts.resolved += 1;
  if (outcome === 'CORRECT_FIRST_TRY') counts.firstTry += 1;
  stored.taskState = outcome;
  record();
  h.progress.awards.push({ reportId: report.reportId, xp, bonus });
  return json(200, { changed: true, xpAwarded: xp, bonusXp: bonus, completedMissionIds: [...stored.completes], newTaskState: outcome, report } satisfies S['ReevaluationResult']);
}

/** Answers `/api/admin/stats` and `/api/admin/reports/**` (signed in, CSRF already checked); null for any other path. */
export function handleProgress(h: ProgressHost, request: Request, url: URL, check: Check): Response | null {
  const path = url.pathname;
  const method = request.method;
  if (path === '/api/admin/stats' && method === 'GET') return stats(h, url);
  if (path === '/api/admin/reports' && method === 'GET') {
    const status = url.searchParams.get('status');
    if (status !== null && !STATUSES.includes(status)) return invalid('status', 'status must be OPEN, FIXED or DISMISSED.');
    return json(200, ordered(h.progress.reports).filter((r) => status === null || r.report.status === status).map((r) => r.report));
  }
  const match = /^\/api\/admin\/reports\/([^/]+)\/(reevaluate|dismiss)$/.exec(path);
  if (!match || method !== 'POST') return null;
  const id = decodeURIComponent(match[1]);
  if (!UUID.test(id)) return invalid('reportId', 'reportId must be a UUID.');
  const stored = h.progress.reports.find((r) => r.report.reportId === id);
  if (!stored) return problem(404, 'Resource not found');
  if (match[2] === 'reevaluate') return reevaluate(h, stored, check);
  if (stored.report.status !== 'OPEN') return conflict(`Only an open report can be dismissed; this one is ${stored.report.status}.`);
  stored.report.status = 'DISMISSED';
  return json(200, stored.report);
}

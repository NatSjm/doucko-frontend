// @trace FR-22
// @trace FR-26
// @trace FR-27
// @trace FR-28
// @trace FR-29
// @trace FR-30
// @trace FR-31
// @trace NFR-7
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages as m } from '@/i18n';
import { format } from '@/i18n/format';
import { stubChildBackend, type StubbedBackend } from '@/test/admin-backend';
import { addTask, FLAGS, FORMAT_TIP, SEED } from '@/test/fake-admin-backend';
import { childRequest, PRACTICE, PROMPTS, practise } from '@/test/fake-child-backend';
import { renderAt } from '@/test/render';
import { TaskScreen } from './TaskScreen';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const at = (missionId: string, taskId?: string) => `/task?missionId=${missionId}${taskId ? `&taskId=${taskId}` : ''}`;
const attempts = (used: number) => format(m['child.task.attempts'], { used, total: 2 });
const part = (key: string) => document.querySelector(`[data-part="${key}"]`) as HTMLElement;
const field = (key: string) => within(part(key)).getByRole('textbox');
const submit = () => screen.getByRole('button', { name: m['child.task.submit'] });
const attemptPosts = (b: StubbedBackend) => b.seen.filter((r) => r.method === 'POST' && r.path.endsWith('/attempts'));
const hintButton = () => screen.queryByRole('button', { name: new RegExp(`^${m['child.task.hint']}`) });

/** Renders the task screen at `path` and waits until the task (its answer form) is shown. */
async function open(path: string) {
  renderAt(<TaskScreen />, path);
  await screen.findByRole('form', { name: m['child.task.answers'] });
}

describe('task screen (FR-26, NFR-7)', () => {
  it('shows the prompt, the image and one labelled input per part, with focus in the first input', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    expect(screen.getByRole('heading', { level: 1, name: format(m['child.task.title'], { n: 1 }) })).toBeInTheDocument();
    expect(screen.getByText(PROMPTS.sum)).toBeInTheDocument();
    const image = screen.getByRole('img', { name: format(m['child.task.image'], { n: 1 }) });
    expect(image).toHaveAttribute('src', `/api/child/images/${PRACTICE.imageSum}`);
    expect(screen.getByRole('textbox', { name: 'a' })).toHaveFocus();
    expect(screen.getByText(attempts(0))).toBeInTheDocument();
  });

  it('submits both parts of a two-part task together with Tab and Enter', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskRound));
    expect(field('a')).toHaveFocus();
    await userEvent.keyboard('3,5');
    await userEvent.tab();
    expect(field('b')).toHaveFocus();
    await userEvent.keyboard('7{Enter}');
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(attemptPosts(backend)).toHaveLength(1);
    expect(JSON.parse(attemptPosts(backend)[0].body)).toEqual({ answers: { a: '3,5', b: '7' } });
  });

  it('sends nothing while a part is empty and asks for it', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskRound));
    await userEvent.type(field('a'), '3,5');
    await userEvent.click(submit());
    expect(within(part('b')).getByText(m['child.task.required'])).toBeInTheDocument();
    expect(field('b')).toHaveAttribute('aria-invalid', 'true');
    expect(field('b')).toHaveFocus();
    expect(attemptPosts(backend)).toHaveLength(0);
    expect(screen.getByText(attempts(0))).toBeInTheDocument();
  });

  it('an input holds at most 100 code points', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.click(field('a'));
    await userEvent.paste('1'.repeat(150));
    expect((field('a') as HTMLInputElement).value).toHaveLength(100);
  });

  it('starts at the current task when the URL names only the mission, and writes the task into the URL', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA));
    expect(screen.getByText(PROMPTS.sum)).toBeInTheDocument();
    expect(window.location.search).toBe(`?missionId=${PRACTICE.missionA}&taskId=${PRACTICE.taskSum}`);
  });

  it('says the mission is done when no task of it is left', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '8 cm' });
    renderAt(<TaskScreen />, at(PRACTICE.missionPerimeter));
    expect(await screen.findByText(m['child.task.missionDoneText'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['child.common.backToHq'] })).toHaveAttribute('href', '/');
  });

  it.each([
    ['a task of a draft mission', at(PRACTICE.missionDraft, PRACTICE.taskHidden)],
    ['a task outside the mission', at(PRACTICE.missionB, PRACTICE.taskSum)],
    ['a missing mission id', '/task'],
    ['an id that is not a UUID (400)', '/task?missionId=abc&taskId=xyz'],
  ])('answers %s with "Tuhle úlohu jsem nenašel." and a way back', async (_, path) => {
    stubChildBackend();
    renderAt(<TaskScreen />, path);
    expect(await screen.findByText(m['child.task.notFound'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['child.common.backToHq'] })).toHaveAttribute('href', '/');
  });

  it('says it could not load and retries', async () => {
    const backend = stubChildBackend();
    backend.failWith = 500;
    renderAt(<TaskScreen />, at(PRACTICE.missionA, PRACTICE.taskSum));
    expect(await screen.findByText(m['child.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['child.common.retry'] }));
    expect(await screen.findByText(PROMPTS.sum)).toBeInTheDocument();
  });
});

describe('attempts and reveal (FR-27)', () => {
  it('correct on the first attempt: "Výborně!", every part locked, focus on "Další úloha"', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,75{Enter}');
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(field('a')).toHaveAttribute('readonly');
    expect(within(part('a')).getByText(m['child.task.partCorrect'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['child.task.next'] })).toHaveFocus();
    expect(screen.getByRole('link', { name: m['child.task.next'] })).toHaveAttribute('href', `/task?missionId=${PRACTICE.missionA}`);
    expect(screen.queryByRole('button', { name: m['child.task.submit'] })).toBeNull();
    expect(screen.queryByText(format(m['child.task.xp'], { xp: 0 }))).toBeNull();
  });

  it('shows the XP the server awards next to "Výborně!"', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    const original = backend.handle;
    backend.handle = async (request) => {
      const response = await original(request);
      if (!request.url.endsWith('/attempts')) return response;
      return new Response(JSON.stringify({ ...(await response.json()), xpAwarded: 10 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    await userEvent.keyboard('0,75{Enter}');
    expect(await screen.findByText(format(m['child.task.xp'], { xp: 10 }))).toBeInTheDocument();
  });

  it('a wrong part is marked without its correct value, the right one locks, 1 of 2 attempts used', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskRound));
    await userEvent.type(field('a'), '3,5');
    await userEvent.type(field('b'), '7,1{Enter}');
    expect(await screen.findByText(m['child.task.almost'])).toBeInTheDocument();
    expect(within(part('b')).getByText(m['child.task.partWrong'])).toBeInTheDocument();
    expect(part('b')).toHaveClass('dk-part-wrong');
    expect(field('b')).not.toHaveAttribute('readonly');
    expect(field('b')).toHaveValue('7,1');
    expect(field('b')).toHaveFocus();
    expect(part('a')).toHaveClass('dk-part-correct');
    expect(field('a')).toHaveAttribute('readonly');
    expect(screen.getByText(attempts(1))).toBeInTheDocument();
    expect(screen.queryByText(m['child.task.correctAnswer'])).toBeNull();
    // The second attempt re-enters only the wrong part (OQ-11).
    await userEvent.clear(field('b'));
    await userEvent.type(field('b'), '7{Enter}');
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(JSON.parse(attemptPosts(backend)[1].body)).toEqual({ answers: { b: '7' } });
    expect(backend.practice.progress.get(PRACTICE.taskRound)?.state).toBe('CORRECT_SECOND_TRY');
  });

  it('reveals every answer after the second wrong attempt, neutral and read-only', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskRound));
    await userEvent.type(field('a'), '3,4');
    await userEvent.type(field('b'), '7,1{Enter}');
    await screen.findByText(m['child.task.almost']);
    await userEvent.type(field('a'), '{Control>}a{/Control}3,3');
    await userEvent.type(field('b'), '{Control>}a{/Control}7,2{Enter}');
    expect(await screen.findByText(m['child.task.revealed'])).toBeInTheDocument();
    for (const key of ['a', 'b']) {
      expect(part(key)).toHaveClass('dk-part-revealed');
      expect(field(key)).toHaveAttribute('readonly');
      expect(within(part(key)).getByText(m['child.task.correctAnswer'])).toBeInTheDocument();
    }
    expect(within(part('a')).getByText('3,5')).toBeInTheDocument();
    expect(within(part('b')).getByText('7')).toBeInTheDocument();
    expect(document.querySelector('.dk-fb-almost, .dk-part-wrong')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Špatně|Chyba/);
    expect(screen.getByText(attempts(2))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['child.task.next'] })).toHaveFocus();
  });

  it('grades Czech-formatted numbers: a decimal comma and a no-break thousands space', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionB, PRACTICE.taskThousands));
    await userEvent.keyboard('1\u00a0250{Enter}');
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(JSON.parse(attemptPosts(backend)[0].body)).toEqual({ answers: { a: '1\u00a0250' } });
  });

  it('a choice part is answered by keyboard: Space picks, Enter submits', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskLargest));
    const first = screen.getByRole('radio', { name: /0,65/ });
    expect(screen.getAllByRole('radio')[0]).toHaveFocus();
    first.focus();
    await userEvent.keyboard(' ');
    expect(first).toBeChecked();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText(m['child.task.almost'])).toBeInTheDocument();
    expect(JSON.parse(attemptPosts(backend)[0].body)).toEqual({ answers: { a: ['B'] } });
    expect(part('a')).toHaveClass('dk-part-wrong');
  });

  it('a multi-choice part sends every picked option and reveals the right ones by name', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionB, PRACTICE.taskMulti));
    await userEvent.click(screen.getByRole('checkbox', { name: /0,9/ }));
    await userEvent.click(submit());
    await screen.findByText(m['child.task.almost']);
    await userEvent.click(screen.getByRole('checkbox', { name: /^A/ }));
    await userEvent.click(submit());
    expect(await screen.findByText(m['child.task.revealed'])).toBeInTheDocument();
    expect(JSON.parse(attemptPosts(backend)[1].body)).toEqual({ answers: { a: ['B', 'A'] } });
    expect(within(part('a')).getByText('A – 1,5, C – 2')).toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
  });

  it('an empty choice part is refused on the screen', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskLargest));
    await userEvent.click(submit());
    expect(within(part('a')).getByText(m['child.task.required'])).toBeInTheDocument();
    expect(attemptPosts(backend)).toHaveLength(0);
  });

  it('a 409 (already resolved elsewhere) shows the stored state instead of a verdict of its own', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
    await userEvent.keyboard('0,7{Enter}');
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(field('a')).toHaveAttribute('readonly');
  });

  it('a refused submission (400) says it was not saved and keeps the input', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.override = { match: (method, path) => method === 'POST' && path.endsWith('/attempts'), status: 400, body: { detail: 'answers.a' } };
    await userEvent.keyboard('0,75{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.task.saveFailed']);
    expect(field('a')).toHaveValue('0,75');
    // A refusal stored nothing: the next submit is sent straight away, without a re-read.
    const reads = backend.seen.filter((r) => r.method === 'GET' && r.path.endsWith(`/tasks/${PRACTICE.taskSum}`)).length;
    await userEvent.click(submit());
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(backend.seen.filter((r) => r.method === 'GET' && r.path.endsWith(`/tasks/${PRACTICE.taskSum}`)).length).toBe(reads);
  });

  it('a server error (5xx) may have stored the attempt: the next submit re-reads first', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.override = { match: (method, path) => method === 'POST' && path.endsWith('/attempts'), status: 503, body: {} };
    await userEvent.keyboard('0,75{Enter}');
    await screen.findByRole('alert');
    const reads = backend.seen.filter((r) => r.method === 'GET' && r.path.endsWith(`/tasks/${PRACTICE.taskSum}`)).length;
    await userEvent.click(submit());
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(backend.seen.filter((r) => r.method === 'GET' && r.path.endsWith(`/tasks/${PRACTICE.taskSum}`)).length).toBe(reads + 1);
  });

  it('a hint opened while an answer is on its way stays on screen after the verdict', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const original = backend.handle;
    backend.handle = async (request) => {
      if (request.url.endsWith('/attempts')) await gate;
      return original(request);
    };
    await userEvent.keyboard('0,7{Enter}');
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByText('Zapiš obě čísla na setiny.')).toBeInTheDocument();
    release();
    expect(await screen.findByText(m['child.task.almost'])).toBeInTheDocument();
    expect(screen.getByText('Zapiš obě čísla na setiny.')).toBeInTheDocument();
    expect(hintButton()).toHaveTextContent(format(m['child.task.hintsLeft'], { n: 1 }));
  });
});

describe('more answer kinds and edge cases (FR-26, FR-27)', () => {
  it('a text part takes text, stops at 100 characters and is graded ignoring case', async () => {
    const backend = stubChildBackend();
    const t = addTask(backend, { topicId: SEED.topicDecimals, prompt: 'Napiš slovy číslo 0,1.' });
    t.input.parts = [{ key: 'a', label: 'a', spec: { ...FLAGS, type: 'TEXT', accepted: ['jedna desetina'] } }];
    backend.missions.find((x) => x.missionId === PRACTICE.missionB)?.taskIds.push(t.taskId);
    await open(at(PRACTICE.missionB, t.taskId));
    expect(field('a')).toHaveAttribute('inputmode', 'text');
    await userEvent.paste('x'.repeat(150));
    expect((field('a') as HTMLInputElement).value).toHaveLength(100);
    await userEvent.clear(field('a'));
    await userEvent.keyboard('Jedna Desetina{Enter}');
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(field('a')).toHaveValue('Jedna Desetina');
  });

  it('a correct choice locks the picked option, also after a reload', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskLargest));
    await userEvent.click(screen.getByRole('radio', { name: /0,7$/ }));
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /0,7$/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /0,7$/ }).closest('label')).toHaveClass('dk-choice-correct');
    // A reload: a fresh page against a server that stored the same answer.
    cleanup();
    vi.unstubAllGlobals();
    const again = stubChildBackend();
    await practise(again, PRACTICE.missionA, PRACTICE.taskLargest, { a: ['A'] });
    renderAt(<TaskScreen />, at(PRACTICE.missionA, PRACTICE.taskLargest));
    await screen.findByRole('form', { name: m['child.task.answers'] });
    expect(screen.getByRole('radio', { name: /0,7$/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /0,7$/ })).toBeDisabled();
    expect(backend.practice.attempts).toHaveLength(1);
  });

  it('a multi-choice option can be picked and unpicked', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionB, PRACTICE.taskMulti));
    const box = screen.getByRole('checkbox', { name: /0,9/ });
    await userEvent.click(box);
    await userEvent.click(box);
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: /^A/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /^C/ }));
    await userEvent.click(submit());
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(JSON.parse(attemptPosts(backend)[0].body)).toEqual({ answers: { a: ['A', 'C'] } });
  });

  it('typing into a part clears its "Vyplň prosím odpověď" and its format tip', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskRound));
    await userEvent.click(submit());
    expect(within(part('a')).getByText(m['child.task.required'])).toBeInTheDocument();
    await userEvent.type(field('a'), '3,,5');
    expect(within(part('a')).queryByText(m['child.task.required'])).toBeNull();
    expect(within(part('b')).getByText(m['child.task.required'])).toBeInTheDocument();
    await userEvent.type(field('b'), '7{Enter}');
    expect(await within(part('a')).findByText(FORMAT_TIP)).toBeInTheDocument();
    await userEvent.type(field('a'), '{Backspace}');
    expect(within(part('a')).queryByText(FORMAT_TIP)).toBeNull();
  });

  it('a task that disappeared on submit (404) says so with a way back', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.missions.find((x) => x.missionId === PRACTICE.missionA)!.status = 'DRAFT';
    await userEvent.keyboard('0,75{Enter}');
    expect(await screen.findByText(m['child.task.notFound'])).toBeInTheDocument();
  });

  it('Enter in a resolved task sends nothing more', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,75{Enter}');
    await screen.findByText(m['child.task.correct']);
    field('a').focus();
    await userEvent.keyboard('{Enter}');
    await act(async () => {});
    expect(attemptPosts(backend)).toHaveLength(1);
  });

  it('a second Enter while the answer is on its way is not a second submission', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskLargest));
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const original = backend.handle;
    backend.handle = async (request) => {
      if (request.url.endsWith('/attempts')) await gate;
      return original(request);
    };
    await userEvent.click(screen.getByRole('radio', { name: /0,65/ }));
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');
    release();
    expect(await screen.findByText(m['child.task.almost'])).toBeInTheDocument();
    expect(attemptPosts(backend)).toHaveLength(1);
  });
});

describe('unreadable input costs nothing (FR-22)', () => {
  it('shows the format tip on the part, keeps the typed text and the attempt count', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskRound));
    await userEvent.type(field('a'), '3,5');
    await userEvent.type(field('b'), '7,1{Enter}');
    await screen.findByText(attempts(1));
    await userEvent.clear(field('b'));
    await userEvent.type(field('b'), '5,,2{Enter}');
    expect(await screen.findByText(m['child.task.format'])).toBeInTheDocument();
    expect(within(part('b')).getByText(FORMAT_TIP)).toBeInTheDocument();
    expect(field('b')).toHaveValue('5,,2');
    expect(field('b')).toHaveFocus();
    expect(field('a')).toHaveAttribute('readonly');
    expect(screen.getByText(attempts(1))).toBeInTheDocument();
    expect(backend.practice.attempts).toHaveLength(1);
    expect(backend.practice.progress.get(PRACTICE.taskRound)?.attemptsUsed).toBe(1);
  });
});

describe('hints (FR-28)', () => {
  it('opens hints one at a time before any attempt, counting down to a disabled button', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    expect(hintButton()).toHaveTextContent(format(m['child.task.hintsLeft'], { n: 2 }));
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByText('Zapiš obě čísla na setiny.')).toBeInTheDocument();
    expect(screen.getByText(format(m['child.task.hintOf'], { n: 1, total: 2 }))).toBeInTheDocument();
    expect(hintButton()).toHaveTextContent(format(m['child.task.hintsLeft'], { n: 1 }));
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByText('Sečti 50 setin a 25 setin.')).toBeInTheDocument();
    expect(hintButton()).toHaveTextContent(format(m['child.task.hintsLeft'], { n: 0 }));
    expect(hintButton()).toBeDisabled();
    expect(backend.practice.hintsOpened.get(PRACTICE.taskSum)).toBe(2);
  });

  it('shows no hint button for a task without hints', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskRound));
    expect(hintButton()).toBeNull();
  });

  it('opened hints are shown again after a reload and still count once', async () => {
    const backend = stubChildBackend();
    await childRequest(backend, 'POST', `/api/child/missions/${PRACTICE.missionA}/tasks/${PRACTICE.taskSum}/hints`);
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    expect(screen.getByText('Zapiš obě čísla na setiny.')).toBeInTheDocument();
    expect(hintButton()).toHaveTextContent(format(m['child.task.hintsLeft'], { n: 1 }));
    expect(backend.practice.hintsOpened.get(PRACTICE.taskSum)).toBe(1);
  });

  it('a hint can still be opened after a reveal, and the task stays revealed', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '6 cm' });
    await practise(backend, PRACTICE.missionPerimeter, PRACTICE.taskSquare, { a: '7 cm' });
    await open(at(PRACTICE.missionPerimeter, PRACTICE.taskSquare));
    expect(screen.getByText(m['child.task.revealed'])).toBeInTheDocument();
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByText('Čtverec má čtyři stejné strany.')).toBeInTheDocument();
    expect(backend.practice.progress.get(PRACTICE.taskSquare)?.state).toBe('REVEALED');
    expect(screen.getByText(m['child.task.revealed'])).toBeInTheDocument();
  });

  it('says when a hint could not be opened', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.override = { match: (method, path) => method === 'POST' && path.endsWith('/hints'), status: 409, body: { detail: 'none left' } };
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.task.hintFailed']);
  });

  it('a 409 because every hint is already open (another tab) shows the stored hints and disables the button', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    for (let i = 0; i < 2; i++) await childRequest(backend, 'POST', `/api/child/missions/${PRACTICE.missionA}/tasks/${PRACTICE.taskSum}/hints`);
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.task.hintFailed']);
    expect(await screen.findByText('Sečti 50 setin a 25 setin.')).toBeInTheDocument();
    expect(hintButton()).toBeDisabled();
  });

  it('a 409 whose re-read fails too keeps the screen as it was', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.override = { match: (method, path) => method === 'POST' && path.endsWith('/hints'), status: 409, body: {} };
    const original = backend.handle;
    backend.handle = async (request) => {
      if (request.method === 'GET') throw new TypeError('Failed to fetch');
      return original(request);
    };
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.task.hintFailed']);
    expect(hintButton()).toHaveTextContent(format(m['child.task.hintsLeft'], { n: 2 }));
  });

  it('a hint request without an answer says so and keeps the count', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.down = true;
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.task.hintFailed']);
    expect(hintButton()).toHaveTextContent(format(m['child.task.hintsLeft'], { n: 2 }));
  });

  it('when the last hint opens, focus moves to it instead of the disabled button', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.click(hintButton() as HTMLElement);
    await screen.findByText('Zapiš obě čísla na setiny.');
    await userEvent.click(hintButton() as HTMLElement);
    await screen.findByText('Sečti 50 setin a 25 setin.');
    await waitFor(() => expect(document.querySelector('[data-hint="2"]')).toHaveFocus());
  });
});

describe('translation toggle (FR-29)', () => {
  it('turns the Ukrainian text on next to the Czech, stores it in the profile, and off again', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    const toggle = screen.getByRole('button', { name: m['child.task.showTranslation'] });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Додай 0,5 + 0,25.')).toBeNull();
    await userEvent.click(toggle);
    const uk = await screen.findByText('Додай 0,5 + 0,25.');
    expect(uk.closest('[lang]')).toHaveAttribute('lang', 'uk');
    expect(screen.getByText(PROMPTS.sum)).toBeInTheDocument();
    expect(backend.practice.settings.secondaryTaskLocale).toBe('uk');
    expect(screen.getByRole('button', { name: m['child.task.hideTranslation'] })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: m['child.task.submit'] })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: m['child.task.hideTranslation'] }));
    await waitFor(() => expect(screen.queryByText('Додай 0,5 + 0,25.')).toBeNull());
    expect(backend.practice.settings.secondaryTaskLocale).toBeNull();
  });

  it('a remembered toggle shows the translation of the next task at once', async () => {
    const backend = stubChildBackend();
    backend.practice.settings.secondaryTaskLocale = 'uk';
    await open(at(PRACTICE.missionB, PRACTICE.taskThousands));
    expect(screen.getByText('Скільки буде 1 000 + 250?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m['child.task.hideTranslation'] })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a task without a translation shows the toggle as unavailable and only Czech', async () => {
    const backend = stubChildBackend();
    backend.practice.settings.secondaryTaskLocale = 'uk';
    await open(at(PRACTICE.missionA, PRACTICE.taskRound));
    expect(screen.getByRole('button', { name: m['child.task.translationUnavailable'] })).toBeDisabled();
    expect(document.querySelector('[lang="uk"]')).toBeNull();
  });

  it('a translated hint shows the Ukrainian text next to the Czech', async () => {
    const backend = stubChildBackend();
    backend.practice.settings.secondaryTaskLocale = 'uk';
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.click(hintButton() as HTMLElement);
    expect(await screen.findByText('Zapiš obě čísla na setiny.')).toBeInTheDocument();
    expect(screen.getByText('Запиши обидва числа в сотих.')).toHaveAttribute('lang', 'uk');
  });

  it('keeps the old state and says so when the setting cannot be saved', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.override = { match: (method) => method === 'PATCH', status: 500, body: {} };
    await userEvent.click(screen.getByRole('button', { name: m['child.task.showTranslation'] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.task.translationFailed']);
    expect(screen.getByRole('button', { name: m['child.task.showTranslation'] })).toHaveAttribute('aria-pressed', 'false');
    expect(backend.practice.settings.secondaryTaskLocale).toBeNull();
  });
});

describe('report a problem (FR-30)', () => {
  const reportButton = () => screen.getByRole('button', { name: m['child.report.open'] });
  const dialog = () => screen.getByRole('dialog', { name: m['child.report.title'] });

  it('after a wrong verdict: stored with the raw attempt, thanks shown, attempts unchanged', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.keyboard('0,7{Enter}');
    await screen.findByText(attempts(1));
    await userEvent.click(reportButton());
    expect(within(dialog()).getAllByRole('radio')[0]).toHaveFocus();
    await userEvent.click(within(dialog()).getByRole('radio', { name: m['child.report.reason.ANSWER_IS_CORRECT'] }));
    await userEvent.click(within(dialog()).getByRole('button', { name: m['child.report.send'] }));
    expect(await screen.findByText(m['child.report.thanks'])).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(backend.practice.reports).toEqual([{ missionId: PRACTICE.missionA, taskId: PRACTICE.taskSum, reason: 'ANSWER_IS_CORRECT', note: null, attempt: { a: '0,7' } }]);
    expect(screen.getByText(attempts(1))).toBeInTheDocument();
    expect(reportButton()).toHaveFocus();
  });

  it('before any attempt: stored with no attempt attached', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.click(reportButton());
    await userEvent.click(within(dialog()).getByRole('radio', { name: m['child.report.reason.UNCLEAR_PROMPT'] }));
    await userEvent.type(within(dialog()).getByRole('textbox', { name: m['child.report.note'] }), 'Nevím, co se sčítá.');
    await userEvent.click(within(dialog()).getByRole('button', { name: m['child.report.send'] }));
    await screen.findByText(m['child.report.thanks']);
    expect(backend.practice.reports[0]).toMatchObject({ reason: 'UNCLEAR_PROMPT', note: 'Nevím, co se sčítá.', attempt: null });
  });

  it('"Jiné" needs a note; with one it is sent', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.click(reportButton());
    await userEvent.click(within(dialog()).getByRole('radio', { name: m['child.report.reason.OTHER'] }));
    await userEvent.click(within(dialog()).getByRole('button', { name: m['child.report.send'] }));
    expect(within(dialog()).getByText(m['child.report.noteRequired'])).toBeInTheDocument();
    expect(backend.seen.filter((r) => r.path.endsWith('/reports'))).toHaveLength(0);
    const note = within(dialog()).getByRole('textbox', { name: m['child.report.note'] });
    expect(note).toHaveAttribute('aria-invalid', 'true');
    // At most 1000 code points (the contract's limit), counted like the server: an emoji is one.
    await userEvent.click(note);
    await userEvent.paste('😀'.repeat(1001));
    expect([...(note as HTMLTextAreaElement).value]).toHaveLength(1000);
    await userEvent.clear(note);
    await userEvent.type(note, '  {Enter}');
    await userEvent.click(within(dialog()).getByRole('button', { name: m['child.report.send'] }));
    expect(backend.seen.filter((r) => r.path.endsWith('/reports'))).toHaveLength(0);
    await userEvent.type(note, 'Obrázek se nenačetl.');
    await userEvent.click(within(dialog()).getByRole('button', { name: m['child.report.send'] }));
    await screen.findByText(m['child.report.thanks']);
    expect(backend.practice.reports[0]).toMatchObject({ reason: 'OTHER', note: 'Obrázek se nenačetl.' });
  });

  it('asks for a reason first', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.click(reportButton());
    await userEvent.click(within(dialog()).getByRole('button', { name: m['child.report.send'] }));
    expect(within(dialog()).getByText(m['child.report.reasonRequired'])).toBeInTheDocument();
    expect(backend.practice.reports).toHaveLength(0);
  });

  it('Escape and "Zrušit" close the dialog and return focus to the report button', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.click(reportButton());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reportButton()).toHaveFocus();
    await userEvent.click(reportButton());
    await userEvent.click(within(dialog()).getByRole('button', { name: m['child.report.cancel'] }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reportButton()).toHaveFocus();
  });

  it('keeps the dialog and says so when the report cannot be sent', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    await userEvent.click(reportButton());
    await userEvent.click(within(dialog()).getByRole('radio', { name: m['child.report.reason.UNCLEAR_PROMPT'] }));
    backend.down = true;
    await userEvent.click(within(dialog()).getByRole('button', { name: m['child.report.send'] }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(m['child.report.failed']);
  });
});

describe('save and resume (FR-31)', () => {
  it('after a reload the stored attempt shows: wrong part marked, right part locked, 1 of 2 used', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionA, PRACTICE.taskSum, { a: '0,75' });
    await practise(backend, PRACTICE.missionA, PRACTICE.taskRound, { a: '3,5', b: '7,1' });
    await open(at(PRACTICE.missionA));
    expect(screen.getByText(PROMPTS.round)).toBeInTheDocument();
    expect(screen.getByText(attempts(1))).toBeInTheDocument();
    expect(part('b')).toHaveClass('dk-part-wrong');
    expect(field('a')).toHaveValue('3,5');
    expect(field('a')).toHaveAttribute('readonly');
    expect(field('b')).toHaveFocus();
  });

  it('a revealed task shows its answers after a reload', async () => {
    const backend = stubChildBackend();
    await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1200' });
    await practise(backend, PRACTICE.missionB, PRACTICE.taskThousands, { a: '1300' });
    await open(at(PRACTICE.missionB, PRACTICE.taskThousands));
    expect(screen.getByText(m['child.task.revealed'])).toBeInTheDocument();
    expect(within(part('a')).getByText('1250')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['child.task.next'] })).toHaveFocus();
  });

  it('with the server unreachable no verdict is shown and the input is kept; once back the same answer is attempt 1', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.down = true;
    await userEvent.keyboard('0,7{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.task.saveFailed']);
    expect(field('a')).toHaveValue('0,7');
    expect(screen.queryByText(m['child.task.almost'])).toBeNull();
    expect(backend.practice.attempts).toHaveLength(0);
    backend.down = false;
    await userEvent.click(submit());
    expect(await screen.findByText(m['child.task.almost'])).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(backend.practice.attempts).toEqual([{ missionId: PRACTICE.missionA, taskId: PRACTICE.taskSum, attemptNo: 1, answers: { a: '0,7' } }]);
  });

  it('a lost response: the next submit re-reads the stored attempt and shows it instead of sending again', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.practice.dropResponse = (method, path) => method === 'POST' && path.endsWith('/attempts');
    await userEvent.keyboard('0,7{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(m['child.task.saveFailed']);
    expect(backend.practice.attempts).toHaveLength(1);
    await userEvent.click(submit());
    expect(await screen.findByText(m['child.task.almost'])).toBeInTheDocument();
    expect(screen.getByText(attempts(1))).toBeInTheDocument();
    expect(attemptPosts(backend)).toHaveLength(1);
    expect(backend.practice.attempts).toHaveLength(1);
  });

  it('a lost response with nothing stored sends the attempt normally after the re-read', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.down = true;
    await userEvent.keyboard('0,75{Enter}');
    await screen.findByRole('alert');
    backend.down = false;
    await userEvent.click(submit());
    expect(await screen.findByText(m['child.task.correct'])).toBeInTheDocument();
    expect(attemptPosts(backend)).toHaveLength(2);
    expect(backend.seen.filter((r) => r.method === 'GET' && r.path.endsWith(`/tasks/${PRACTICE.taskSum}`)).length).toBeGreaterThanOrEqual(2);
  });

  it('when the re-read fails too, the failure stays and nothing is sent', async () => {
    const backend = stubChildBackend();
    await open(at(PRACTICE.missionA, PRACTICE.taskSum));
    backend.down = true;
    await userEvent.keyboard('0,75{Enter}');
    await screen.findByRole('alert');
    await userEvent.click(submit());
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent(m['child.task.saveFailed']);
    expect(backend.practice.attempts).toHaveLength(0);
  });

  it('the last task of a mission says the mission is done and leads back to HQ', async () => {
    stubChildBackend();
    await open(at(PRACTICE.missionPerimeter, PRACTICE.taskSquare));
    await userEvent.keyboard('8 cm{Enter}');
    expect(await screen.findByText(m['child.task.missionDone'])).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: m['child.task.next'] })).toBeNull();
    const back = screen.getAllByRole('link', { name: m['child.common.backToHq'] });
    expect(back.at(-1)).toHaveFocus();
  });
});

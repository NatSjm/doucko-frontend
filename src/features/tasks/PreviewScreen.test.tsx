// @trace FR-4
// @trace FR-7
// @trace FR-8
// @trace FR-10
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { format } from '@/i18n/format';
import { messages } from '@/i18n';
import { stubSignedInAdmin } from '@/test/admin-backend';
import { SEED } from '@/test/fake-admin-backend';
import { renderAt } from '@/test/render';
import { PreviewScreen } from './PreviewScreen';

const m = messages;
const childView = () => screen.getByRole('region', { name: m['admin.preview.childView'] });
const tester = () => screen.getByRole('region', { name: m['admin.preview.tester'] });

// Many keystrokes in a large form: under coverage and a parallel suite one test can pass 5 s.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open(taskId: string = SEED.taskDecimal) {
  const backend = stubSignedInAdmin();
  renderAt(<PreviewScreen />, `/admin/tasks/preview?taskId=${taskId}`);
  await screen.findByRole('heading', { level: 1, name: m['admin.preview.title'] });
  await screen.findByRole('region', { name: m['admin.preview.childView'] });
  await within(childView()).findByText(backend.tasks.find((t) => t.taskId === taskId)?.input.prompt ?? '');
  return backend;
}

describe('preview (FR-10)', () => {
  it('shows the draft task as the child sees it, in Czech, without the source reference', async () => {
    await open();
    const view = childView();
    expect(within(view).getByText('Zapiš jednu polovinu jako desetinné číslo.').closest('[lang]')).toHaveAttribute('lang', 'cs');
    expect(within(view).getByPlaceholderText(m['child.task.answerPlaceholder'])).toBeInTheDocument();
    expect(within(view).getByLabelText('a')).toBeInTheDocument();
    // Preview hides the source reference.
    expect(screen.queryByText('Matematika 6 – pracovní sešit')).toBeNull();
    expect(screen.queryByText('57')).toBeNull();
    expect(screen.getByRole('link', { name: m['admin.preview.edit'] })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
  });

  it('shows the task images in order (FR-4)', async () => {
    await open();
    expect(await within(childView()).findByRole('img', { name: format(m['child.task.image'], { n: 1 }) })).toHaveAttribute(
      'src',
      expect.stringMatching(/^blob:/),
    );
  });

  it('shows no image area for a task without images (Task without images)', async () => {
    await open(SEED.taskChoice);
    expect(within(childView()).queryByRole('img')).toBeNull();
    expect(childView().querySelector('.task-images')).toBeNull();
  });

  it('opens the hints one by one, in order (FR-7)', async () => {
    await open();
    const hint = within(childView()).getByRole('button', { name: new RegExp(m['child.task.hint']) });
    expect(hint).toHaveTextContent('0/2');
    await userEvent.click(hint);
    expect(within(childView()).getByText('Polovina je jedna děleno dvěma.')).toBeInTheDocument();
    expect(within(childView()).getByText(format(m['child.task.hintOf'], { n: 1, total: 2 }))).toBeInTheDocument();
    await userEvent.click(hint);
    expect(within(childView()).getByText('Kolik je pět desetin?')).toBeInTheDocument();
    expect(hint).toBeDisabled();
  });

  it('shows no hint control for a task without hints (Task without hints)', async () => {
    await open(SEED.taskPerimeter);
    expect(within(childView()).queryByRole('button', { name: new RegExp(m['child.task.hint']) })).toBeNull();
    expect(within(childView()).getByText('cm')).toBeInTheDocument();
  });

  it('shows the Ukrainian prompt beside the Czech one when the toggle is on, hints falling back to Czech (FR-8)', async () => {
    const backend = await open();
    const toggle = within(childView()).getByRole('button', { name: m['child.task.showTranslation'] });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    const translated = await within(childView()).findByText('Запиши одну половину як десятковий дріб.');
    expect(translated.closest('[lang]')).toHaveAttribute('lang', 'uk');
    expect(backend.seen.some((r) => r.path.endsWith('/preview') && r.search === '?locale=uk')).toBe(true);
    expect(within(childView()).getByText('Zapiš jednu polovinu jako desetinné číslo.')).toBeInTheDocument();
    await userEvent.click(within(childView()).getByRole('button', { name: new RegExp(m['child.task.hint']) }));
    expect(within(childView()).getByText('Polovina je jedna děleno dvěma.')).toBeInTheDocument();
    await userEvent.click(within(childView()).getByRole('button', { name: m['child.task.hideTranslation'] }));
    await waitFor(() => expect(within(childView()).queryByText('Запиши одну половину як десятковий дріб.')).toBeNull());
  });

  it('offers no translation toggle without a translation', async () => {
    await open(SEED.taskChoice);
    expect(within(childView()).queryByRole('button', { name: m['child.task.showTranslation'] })).toBeNull();
  });

  it('renders choice options lettered A, B, C', async () => {
    await open(SEED.taskChoice);
    const options = within(childView()).getAllByRole('radio');
    expect(options).toHaveLength(3);
    await userEvent.click(options[2]);
    expect(options[2]).toBeChecked();
    expect(within(childView()).getByText('C')).toBeInTheDocument();
  });

  it('says the task was not found for an unknown id', async () => {
    stubSignedInAdmin();
    renderAt(<PreviewScreen />, '/admin/tasks/preview?taskId=99999999-9999-4999-8999-999999999999');
    expect(await screen.findByText(m['admin.editor.notFound'])).toBeInTheDocument();
  });

  it('offers a retry when the preview cannot be loaded', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<PreviewScreen />, `/admin/tasks/preview?taskId=${SEED.taskDecimal}`);
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['admin.session.retry'] }));
    expect(await screen.findByRole('heading', { level: 1, name: m['admin.preview.title'] })).toBeInTheDocument();
  });
});

describe('answer tester (FR-10)', () => {
  const answer = (label: string) => within(tester()).getByLabelText(format(m['admin.preview.answerFor'], { label }));
  const result = (label: string) => within(tester()).findByRole('group', { name: format(m['admin.preview.result'], { label }) });

  it('shows CORRECT with the normalized value for a Czech-notation answer, and records nothing', async () => {
    const backend = await open();
    await userEvent.type(answer('a'), '0,50{Enter}');
    const res = await result('a');
    expect(within(res).getByText(m['admin.verdict.CORRECT'])).toBeInTheDocument();
    expect(within(res).getByText('0.5')).toBeInTheDocument();
    const check = backend.seen.find((r) => r.path.endsWith('/check'));
    expect(JSON.parse(check?.body ?? '{}')).toEqual({ answers: { a: '0,50' } });
    expect(check?.headers.get('X-XSRF-TOKEN')).toBe('xsrf-123');
  });

  it('shows WRONG with the normalized value', async () => {
    await open();
    await userEvent.type(answer('a'), '0,4');
    await userEvent.click(within(tester()).getByRole('button', { name: m['admin.preview.check'] }));
    const res = await result('a');
    expect(within(res).getByText(m['admin.verdict.WRONG'])).toBeInTheDocument();
    expect(within(res).getByText('0.4')).toBeInTheDocument();
  });

  it('shows UNPARSEABLE and the Czech tip the child would see', async () => {
    await open();
    await userEvent.type(answer('a'), '5,,2{Enter}');
    const res = await result('a');
    expect(within(res).getByText(m['admin.verdict.UNPARSEABLE'])).toBeInTheDocument();
    const tip = within(res).getByText('Tohle číslo neumím přečíst. Zkus třeba 5,2.');
    expect(tip.closest('[lang]')).toHaveAttribute('lang', 'cs');
  });

  it('tests a choice part by option', async () => {
    const backend = await open(SEED.taskChoice);
    await userEvent.click(within(tester()).getByRole('checkbox', { name: 'C' }));
    await userEvent.click(within(tester()).getByRole('button', { name: m['admin.preview.check'] }));
    expect(within(await result('a')).getByText(m['admin.verdict.CORRECT'])).toBeInTheDocument();
    expect(JSON.parse(backend.seen.find((r) => r.path.endsWith('/check'))?.body ?? '{}')).toEqual({ answers: { a: ['C'] } });
    await userEvent.click(within(tester()).getByRole('checkbox', { name: 'C' }));
    await userEvent.click(within(tester()).getByRole('checkbox', { name: 'A' }));
    await userEvent.click(within(tester()).getByRole('button', { name: m['admin.preview.check'] }));
    await waitFor(async () => expect(within(await result('a')).getByText(m['admin.verdict.WRONG'])).toBeInTheDocument());
  });

  it('has nothing to test on a graphic task without parts', async () => {
    await open(SEED.taskGraphic);
    expect(within(tester()).getByText(m['admin.preview.noParts'])).toBeInTheDocument();
  });

  it('says checking failed when the server cannot be reached', async () => {
    const backend = await open();
    backend.down = true;
    await userEvent.type(answer('a'), '1{Enter}');
    expect(await within(tester()).findByRole('alert')).toHaveTextContent(m['admin.preview.checkFailed']);
  });
});

describe('answer tester defaults', () => {
  it('sends an unanswered choice part as an empty selection', async () => {
    const backend = await open(SEED.taskChoice);
    await userEvent.click(within(tester()).getByRole('button', { name: m['admin.preview.check'] }));
    await within(tester()).findByRole('group', { name: format(m['admin.preview.result'], { label: 'a' }) });
    expect(JSON.parse(backend.seen.find((r) => r.path.endsWith('/check'))?.body ?? '{}')).toEqual({ answers: { a: [] } });
  });

  it('sends an unanswered typed part as an empty answer', async () => {
    const backend = await open();
    await userEvent.click(within(tester()).getByRole('button', { name: m['admin.preview.check'] }));
    await within(tester()).findByRole('group', { name: format(m['admin.preview.result'], { label: 'a' }) });
    expect(JSON.parse(backend.seen.find((r) => r.path.endsWith('/check'))?.body ?? '{}')).toEqual({ answers: { a: '' } });
  });
});

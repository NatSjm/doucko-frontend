// @trace FR-8
// @trace FR-10
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { I18nProvider, messages } from '@/i18n';
import { format } from '@/i18n/format';
import { TaskView, type TaskViewData } from './TaskView';

const text = (cs: string, uk?: string) => ({ cs, secondary: uk ? { locale: 'uk', text: uk } : null });

/** A self-authored task view with every part kind and a full `uk` translation. */
const TASK: TaskViewData = {
  taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009',
  missionId: null,
  position: 1,
  prompt: text('Vyber a doplň.', 'Вибери та доповни.'),
  translationAvailable: true,
  images: [],
  parts: [
    { key: 'a', label: text('a', 'а'), type: 'CHOICE_MULTI', options: [{ key: 'A', text: text('sudé', 'парне') }, { key: 'B', text: text('liché') }] },
    { key: 'b', label: text('b'), type: 'TEXT', unit: null },
    { key: 'c', label: text('c'), type: 'CHOICE_SINGLE' },
  ],
  hints: { total: 1, opened: [{ index: 1, text: text('Dělitelnost dvěma.', 'Подільність на два.'), remaining: 0 }] },
  maxAttempts: 2,
  attemptsUsed: 0,
  state: 'UNRESOLVED',
  lastFeedback: null,
};

function show(task: TaskViewData = TASK) {
  return render(
    <I18nProvider>
      <TaskView task={task} showTranslation onToggleTranslation={() => {}} renderImage={() => null} />
    </I18nProvider>,
  );
}

describe('child task view', () => {
  it('lets the child pick several options of a multi-choice part and unpick one', async () => {
    show();
    expect(screen.getByText(messages['child.task.chooseAll'])).toBeInTheDocument();
    const [even, odd] = screen.getAllByRole('checkbox');
    await userEvent.click(even);
    await userEvent.click(odd);
    expect(even).toBeChecked();
    expect(odd).toBeChecked();
    await userEvent.click(even);
    expect(even).not.toBeChecked();
  });

  it('shows translated labels, options and hints in their language beside the Czech', async () => {
    show();
    expect(screen.getByText('парне')).toHaveAttribute('lang', 'uk');
    expect(screen.getByText('а')).toHaveAttribute('lang', 'uk');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(messages['child.task.hint']) }));
    expect(screen.getByText('Подільність на два.')).toHaveAttribute('lang', 'uk');
    expect(screen.getByText(format(messages['child.task.hintOf'], { n: 1, total: 1 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages['child.task.hideTranslation'] })).toHaveAttribute('aria-pressed', 'true');
  });

  it('gives a text part a text keyboard and keeps what is typed', async () => {
    show();
    const field = screen.getByLabelText('b');
    expect(field).toHaveAttribute('inputmode', 'text');
    await userEvent.type(field, 'pravý');
    expect(field).toHaveValue('pravý');
  });

  it('renders a choice part without options as an empty group', () => {
    show();
    const groups = screen.getAllByRole('group');
    expect(within(groups[1]).queryAllByRole('radio')).toHaveLength(0);
  });
});

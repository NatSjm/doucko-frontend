// @trace FR-2
// @trace FR-3
// @trace FR-4
// @trace FR-6
// @trace FR-7
// @trace FR-8
// @trace NFR-8
// @trace NFR-17
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { format } from '@/i18n/format';
import { messages } from '@/i18n';
import { stubSignedInAdmin, type StubbedAdminBackend } from '@/test/admin-backend';
import { makePng, SEED } from '@/test/fake-admin-backend';
import { renderAt } from '@/test/render';
import { TaskEditorScreen } from './TaskEditorScreen';

vi.mock('@/features/sources/pdf', () => import('@/test/pdf-mock'));

const m = messages;
/** What every spec sends besides its own fields (the contract defaults of the flags). */
const BASE = { tolerance: null, exactDecimals: null, allowEquivalent: true, requireLowestTerms: false, unitRequired: true, diacriticsStrict: false };
const label = (key: keyof typeof messages, vars: Record<string, string | number> = {}) => format(m[key], vars);
const field = (name: string) => screen.getByLabelText(name, { exact: true });
const part = (n: number) => screen.getByRole('group', { name: label('admin.editor.part', { n }) });
const save = () => userEvent.click(screen.getByRole('button', { name: m['admin.editor.save'] }));
const lastBody = (backend: StubbedAdminBackend, method: string) =>
  JSON.parse(backend.seen.filter((r) => r.method === method && r.path.startsWith('/api/admin/tasks')).at(-1)?.body ?? 'null');

// Many keystrokes in a large form: under coverage and a parallel suite one test can pass 5 s.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openNew(query = `?sourceId=${SEED.sourceId}&page=57`) {
  const backend = stubSignedInAdmin();
  renderAt(<TaskEditorScreen />, `/admin/tasks/edit${query}`);
  await screen.findByRole('heading', { level: 1, name: m['admin.editor.newTitle'] });
  await waitFor(() => expect(field(m['admin.editor.source'])).toHaveValue(SEED.sourceId));
  return backend;
}

/** Fills a typical single-part INTEGER task with the keyboard path of NFR-8. */
async function typeSinglePartTask(prompt = 'Kolik je 7 + 5?', expected = '12') {
  await userEvent.type(field(m['admin.editor.prompt']), prompt);
  await userEvent.selectOptions(field(m['admin.editor.topic']), 'Desetinná čísla');
  await userEvent.type(field(m['admin.editor.taskNo']), '4');
  await userEvent.type(within(part(1)).getByLabelText(label('admin.editor.accepted', { n: 1 })), expected);
}

describe('new task form (FR-3)', () => {
  it('prefills source and page from the query and shows the PDF at that page beside the form (FR-2)', async () => {
    await openNew();
    expect(field(m['admin.editor.page'])).toHaveValue('57');
    expect(field(m['admin.editor.grade'])).toHaveValue('6');
    expect(await screen.findByRole('img', { name: label('admin.viewer.canvas', { page: 57 }) })).toBeInTheDocument();
  });

  it('offers exactly the seeded topics of the grade (Topic choices)', async () => {
    await openNew();
    const options = within(field(m['admin.editor.topic'])).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([m['admin.common.choose'], 'Desetinná čísla', 'Obvod a obsah']);
  });

  it('without a source in the query asks for one and shows no viewer', async () => {
    stubSignedInAdmin();
    renderAt(<TaskEditorScreen />, '/admin/tasks/edit');
    await screen.findByRole('heading', { level: 1, name: m['admin.editor.newTitle'] });
    expect(await screen.findByText(m['admin.viewer.empty'])).toBeInTheDocument();
    await userEvent.selectOptions(field(m['admin.editor.source']), 'Sbírka úloh 6');
    expect(field(m['admin.editor.page'])).toHaveValue('1');
    expect(await screen.findByRole('img', { name: label('admin.viewer.canvas', { page: 1 }) })).toBeInTheDocument();
  });

  it('saves a single-part task with Enter, then keeps source and page and puts focus in the prompt (NFR-8)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('status')).toHaveTextContent(m['admin.editor.created']);
    expect(lastBody(backend, 'POST')).toMatchObject({
      prompt: 'Kolik je 7 + 5?',
      topicId: SEED.topicDecimals,
      grade: 6,
      difficulty: 1,
      modality: 'TEXT',
      sourceRef: { sourceId: SEED.sourceId, page: 57, taskNo: '4', subPart: null },
      parts: [{ label: 'a', spec: { type: 'INTEGER', accepted: ['12'] } }],
      hints: [],
    });
    const saved = backend.tasks.at(-1);
    expect(screen.getByRole('link', { name: m['admin.editor.openSaved'] })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${saved?.taskId}`);
    expect(screen.getByRole('link', { name: m['admin.editor.preview'] })).toHaveAttribute('href', `/admin/tasks/preview?taskId=${saved?.taskId}`);
    expect(field(m['admin.editor.source'])).toHaveValue(SEED.sourceId);
    expect(field(m['admin.editor.page'])).toHaveValue('57');
    expect(field(m['admin.editor.prompt'])).toHaveValue('');
    expect(field(m['admin.editor.taskNo'])).toHaveValue('');
    expect(field(m['admin.editor.prompt'])).toHaveFocus();
  });

  it('Ctrl+Enter saves from the multi-line prompt', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.click(field(m['admin.editor.prompt']));
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await screen.findByText(m['admin.editor.created']);
    expect(backend.tasks).toHaveLength(5);
  });

  it('refuses a page outside the source before sending, with the range (Missing, out-of-range or malformed page)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.clear(field(m['admin.editor.page']));
    await userEvent.type(field(m['admin.editor.page']), '121');
    await save();
    expect(await screen.findByText(label('admin.editor.pageRange', { count: 120 }))).toBeInTheDocument();
    expect(field(m['admin.editor.page'])).toHaveAttribute('aria-invalid', 'true');
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
  });

  it('shows server refusals inline on the named fields and focuses the first', async () => {
    const backend = await openNew();
    await userEvent.type(within(part(1)).getByLabelText(label('admin.editor.accepted', { n: 1 })), '12,5');
    await save();
    const prompt = field(m['admin.editor.prompt']);
    await waitFor(() => expect(prompt).toHaveAttribute('aria-invalid', 'true'));
    expect(prompt).toHaveAccessibleDescription('Prompt is required.');
    expect(prompt).toHaveFocus();
    expect(field(m['admin.editor.topic'])).toHaveAccessibleDescription('Choose a topic.');
    expect(field(m['admin.editor.taskNo'])).toHaveAccessibleDescription('Task number is required.');
    expect(within(part(1)).getByLabelText(label('admin.editor.accepted', { n: 1 }))).toHaveAccessibleDescription(
      '12,5 is not a whole number; DECIMAL fits it.',
    );
    expect(backend.tasks).toHaveLength(4);
  });

  it('lists a refusal on a path without its own field in the form alert', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    backend.override = {
      match: (method) => method === 'POST',
      status: 400,
      body: { errors: [{ field: 'translations', message: 'Supported task locales: uk.' }] },
    };
    await save();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(m['admin.common.formErrors']);
    expect(alert).toHaveTextContent('Supported task locales: uk.');
  });

  it('a text task without parts is refused with the server message (Text task without parts)', async () => {
    await openNew();
    await typeSinglePartTask();
    await userEvent.click(within(part(1)).getByRole('button', { name: label('admin.editor.removePart', { n: 1 }) }));
    expect(screen.getByText(m['admin.editor.noParts'])).toBeInTheDocument();
    await save();
    expect(await screen.findByText('A text task needs at least one answer part.')).toBeInTheDocument();
  });

  it('says saving failed when the server cannot be reached', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    backend.down = true;
    await save();
    expect(await screen.findByRole('alert')).toHaveTextContent(m['admin.common.saveFailed']);
  });

  it('keeps the half-filled form when the viewer jumps to another page (Jump to a page)', async () => {
    await openNew();
    await userEvent.type(field(m['admin.editor.prompt']), 'Rozepsaná úloha');
    const viewerPage = screen.getByLabelText(m['admin.viewer.page']);
    await userEvent.clear(viewerPage);
    await userEvent.type(viewerPage, '30{Enter}');
    expect(await screen.findByRole('img', { name: label('admin.viewer.canvas', { page: 30 }) })).toBeInTheDocument();
    expect(field(m['admin.editor.prompt'])).toHaveValue('Rozepsaná úloha');
    expect(field(m['admin.editor.page'])).toHaveValue('57');
  });
});

describe('answer parts and specs (FR-6)', () => {
  it('stores two parts in order with their specs (Multi-part task)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addPart'] }));
    expect(within(part(2)).getByLabelText(m['admin.editor.partLabel'])).toHaveValue('b');
    await userEvent.selectOptions(within(part(2)).getByLabelText(m['admin.editor.partType']), m['admin.type.NUMBER_WITH_UNIT']);
    expect(within(part(2)).getByLabelText(m['admin.editor.unitRequired'])).toBeChecked();
    await userEvent.type(within(part(2)).getByLabelText(label('admin.editor.accepted', { n: 1 })), '24 cm²');
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').parts.map((p: { label: string; spec: unknown }) => [p.label, p.spec])).toEqual([
      ['a', { ...BASE, type: 'INTEGER', accepted: ['12'] }],
      ['b', { ...BASE, type: 'NUMBER_WITH_UNIT', accepted: ['24 cm²'] }],
    ]);
  });

  it('reorders and removes parts', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addPart'] }));
    await userEvent.type(within(part(2)).getByLabelText(label('admin.editor.accepted', { n: 1 })), '7');
    await userEvent.click(within(part(2)).getByRole('button', { name: label('admin.editor.movePartUp', { n: 2 }) }));
    expect(within(part(1)).getByLabelText(m['admin.editor.partLabel'])).toHaveValue('b');
    await userEvent.click(within(part(1)).getByRole('button', { name: label('admin.editor.movePartDown', { n: 1 }) }));
    expect(within(part(1)).getByLabelText(m['admin.editor.partLabel'])).toHaveValue('a');
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').parts.map((p: { label: string }) => p.label)).toEqual(['a', 'b']);
  });

  it('accepts several answers per part and removes one', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.selectOptions(within(part(1)).getByLabelText(m['admin.editor.partType']), m['admin.type.TEXT']);
    await userEvent.clear(within(part(1)).getByLabelText(label('admin.editor.accepted', { n: 1 })));
    await userEvent.type(within(part(1)).getByLabelText(label('admin.editor.accepted', { n: 1 })), 'pravý úhel');
    await userEvent.click(within(part(1)).getByRole('button', { name: m['admin.editor.addAccepted'] }));
    await userEvent.type(within(part(1)).getByLabelText(label('admin.editor.accepted', { n: 2 })), 'pravý');
    await userEvent.click(within(part(1)).getByRole('button', { name: m['admin.editor.addAccepted'] }));
    await userEvent.click(within(part(1)).getByRole('button', { name: label('admin.editor.removeAccepted', { n: 3 }) }));
    await userEvent.click(within(part(1)).getByLabelText(m['admin.editor.diacriticsStrict']));
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').parts[0].spec).toEqual({ ...BASE, type: 'TEXT', accepted: ['pravý úhel', 'pravý'], diacriticsStrict: true });
  });

  it('edits decimal and fraction flags', async () => {
    const backend = await openNew();
    await typeSinglePartTask('Zapiš.', '0,50');
    await userEvent.selectOptions(within(part(1)).getByLabelText(m['admin.editor.partType']), m['admin.type.DECIMAL']);
    await userEvent.type(within(part(1)).getByLabelText(m['admin.editor.exactDecimals']), '2');
    await userEvent.type(within(part(1)).getByLabelText(m['admin.editor.tolerance']), '0,01');
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addPart'] }));
    await userEvent.selectOptions(within(part(2)).getByLabelText(m['admin.editor.partType']), m['admin.type.FRACTION']);
    await userEvent.type(within(part(2)).getByLabelText(label('admin.editor.accepted', { n: 1 })), '1 1/2');
    await userEvent.click(within(part(2)).getByLabelText(m['admin.editor.allowEquivalent']));
    await userEvent.click(within(part(2)).getByLabelText(m['admin.editor.lowestTerms']));
    await save();
    await screen.findByText(m['admin.editor.created']);
    const [decimal, fraction] = lastBody(backend, 'POST').parts.map((p: { spec: unknown }) => p.spec);
    expect(decimal).toEqual({ ...BASE, type: 'DECIMAL', accepted: ['0,50'], tolerance: '0,01', exactDecimals: 2 });
    expect(fraction).toEqual({ ...BASE, type: 'FRACTION', accepted: ['1 1/2'], allowEquivalent: false, requireLowestTerms: true });
  });

  it('authors a single-choice part with lettered options and the correct one (Single-choice options and answer)', async () => {
    const backend = await openNew();
    await typeSinglePartTask('Které číslo je větší než 4?');
    await userEvent.selectOptions(within(part(1)).getByLabelText(m['admin.editor.partType']), m['admin.type.CHOICE_SINGLE']);
    const options = within(part(1)).getByRole('group', { name: m['admin.editor.options'] });
    await userEvent.type(within(options).getByLabelText(label('admin.editor.option', { key: 'A' })), '3');
    await userEvent.type(within(options).getByLabelText(label('admin.editor.option', { key: 'B' })), '4');
    await userEvent.click(within(options).getByRole('button', { name: m['admin.editor.addOption'] }));
    await userEvent.type(within(options).getByLabelText(label('admin.editor.option', { key: 'C' })), '5');
    await userEvent.click(within(options).getByRole('button', { name: m['admin.editor.addOption'] }));
    await userEvent.click(within(options).getByRole('button', { name: label('admin.editor.removeOption', { key: 'D' }) }));
    await userEvent.click(within(options).getByLabelText(label('admin.editor.optionCorrect', { key: 'C' })));
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').parts[0].spec).toEqual({
      ...BASE,
      type: 'CHOICE_SINGLE',
      accepted: ['C'],
      options: [
        { key: 'A', text: '3' },
        { key: 'B', text: '4' },
        { key: 'C', text: '5' },
      ],
    });
  });

  it('marks several options correct in a multi-choice part', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.selectOptions(within(part(1)).getByLabelText(m['admin.editor.partType']), m['admin.type.CHOICE_MULTI']);
    const options = within(part(1)).getByRole('group', { name: m['admin.editor.options'] });
    await userEvent.type(within(options).getByLabelText(label('admin.editor.option', { key: 'A' })), 'x');
    await userEvent.type(within(options).getByLabelText(label('admin.editor.option', { key: 'B' })), 'y');
    await userEvent.click(within(options).getByLabelText(label('admin.editor.optionCorrect', { key: 'A' })));
    await userEvent.click(within(options).getByLabelText(label('admin.editor.optionCorrect', { key: 'B' })));
    await userEvent.click(within(options).getByLabelText(label('admin.editor.optionCorrect', { key: 'B' })));
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').parts[0].spec.accepted).toEqual(['A']);
  });

  it('saves a graphic task with zero parts (Graphic task without parts)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.click(screen.getByLabelText(m['admin.editor.modalityGraphic']));
    await userEvent.click(within(part(1)).getByRole('button', { name: label('admin.editor.removePart', { n: 1 }) }));
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST')).toMatchObject({ modality: 'GRAPHIC', parts: [] });
    // The next task starts as GRAPHIC without parts too, and a part can be added back.
    expect(screen.getByText(m['admin.editor.noParts'])).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(m['admin.editor.modalityText']));
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addPart'] }));
    expect(within(part(1)).getByLabelText(m['admin.editor.partLabel'])).toHaveValue('a');
  });

  it('offers no more than 10 parts', async () => {
    await openNew();
    const add = screen.getByRole('button', { name: m['admin.editor.addPart'] });
    for (let i = 0; i < 9; i++) await userEvent.click(add);
    expect(add).toBeDisabled();
  });
});

describe('hints (FR-7)', () => {
  it('adds hints and moves the third to the top (Ordered hints)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    expect(screen.getByText(m['admin.editor.noHints'])).toBeInTheDocument();
    for (const text of ['první', 'druhá', 'třetí']) {
      await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addHint'] }));
      const n = screen.getAllByLabelText(/^Hint \d+$/).length;
      await userEvent.type(field(label('admin.editor.hint', { n })), text);
    }
    await userEvent.click(screen.getByRole('button', { name: label('admin.editor.moveHintUp', { n: 3 }) }));
    await userEvent.click(screen.getByRole('button', { name: label('admin.editor.moveHintUp', { n: 2 }) }));
    await userEvent.click(screen.getByRole('button', { name: label('admin.editor.moveHintDown', { n: 2 }) }));
    await userEvent.click(screen.getByRole('button', { name: label('admin.editor.moveHintUp', { n: 3 }) }));
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').hints).toEqual(['třetí', 'první', 'druhá']);
  });

  it('removes a hint and shows the server refusal of an empty one inline (Empty hint)', async () => {
    await openNew();
    await typeSinglePartTask();
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addHint'] }));
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addHint'] }));
    await userEvent.click(screen.getByRole('button', { name: label('admin.editor.removeHint', { n: 2 }) }));
    await userEvent.type(field(label('admin.editor.hint', { n: 1 })), '   ');
    await save();
    await waitFor(() => expect(field(label('admin.editor.hint', { n: 1 }))).toHaveAccessibleDescription('A hint cannot be empty.'));
  });
});

describe('translations (FR-8)', () => {
  it('offers every configured task locale and sends what was entered, marked with its lang', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addHint'] }));
    await userEvent.type(field(label('admin.editor.hint', { n: 1 })), 'Sečti.');
    const uk = screen.getByRole('group', { name: label('admin.editor.translation', { locale: 'uk' }) });
    const prompt = within(uk).getByLabelText(label('admin.editor.trPrompt', { locale: 'uk' }));
    expect(prompt).toHaveAttribute('lang', 'uk');
    await userEvent.type(prompt, 'Скільки буде 7 + 5?');
    await userEvent.type(within(uk).getByLabelText(label('admin.editor.trPartLabel', { n: 1, locale: 'uk' })), 'а');
    await userEvent.type(within(uk).getByLabelText(label('admin.editor.trHint', { n: 1, locale: 'uk' })), 'Додай.');
    await save();
    await screen.findByText(m['admin.editor.created']);
    const body = lastBody(backend, 'POST');
    expect(body.translations).toEqual({
      uk: { prompt: 'Скільки буде 7 + 5?', partLabels: { [body.parts[0].key]: 'а' }, hints: ['Додай.'], options: {} },
    });
  });

  it('translates choice option texts keyed by part and option', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.selectOptions(within(part(1)).getByLabelText(m['admin.editor.partType']), m['admin.type.CHOICE_SINGLE']);
    const uk = screen.getByRole('group', { name: label('admin.editor.translation', { locale: 'uk' }) });
    await userEvent.type(within(uk).getByLabelText(label('admin.editor.trOption', { key: 'B', n: 1, locale: 'uk' })), 'ні');
    await userEvent.type(within(part(1)).getByLabelText(label('admin.editor.option', { key: 'A' })), 'ano');
    await userEvent.type(within(part(1)).getByLabelText(label('admin.editor.option', { key: 'B' })), 'ne');
    await userEvent.click(within(part(1)).getByLabelText(label('admin.editor.optionCorrect', { key: 'A' })));
    await save();
    await screen.findByText(m['admin.editor.created']);
    const body = lastBody(backend, 'POST');
    expect(body.translations.uk.options).toEqual({ [`${body.parts[0].key}.B`]: 'ні' });
  });

  it('offers a second locale when configuration adds one (New locale by configuration only)', async () => {
    const backend = stubSignedInAdmin();
    backend.reference.taskLocales = ['uk', 'ru'];
    renderAt(<TaskEditorScreen />, '/admin/tasks/edit');
    expect(await screen.findByRole('group', { name: label('admin.editor.translation', { locale: 'ru' }) })).toBeInTheDocument();
  });
});

describe('existing task (FR-3 edit, FR-4 images)', () => {
  async function openExisting(taskId: string = SEED.taskDecimal) {
    const backend = stubSignedInAdmin();
    renderAt(<TaskEditorScreen />, `/admin/tasks/edit?taskId=${taskId}`);
    await screen.findByRole('heading', { level: 1, name: m['admin.editor.editTitle'] });
    await waitFor(() => expect(field(m['admin.editor.prompt'])).toHaveValue('Zapiš jednu polovinu jako desetinné číslo.'));
    return backend;
  }

  it('loads every field and the normalized interpretation of each accepted answer', async () => {
    await openExisting();
    expect(field(m['admin.editor.page'])).toHaveValue('57');
    expect(field(m['admin.editor.subPart'])).toHaveValue('b');
    expect(field(label('admin.editor.hint', { n: 2 }))).toHaveValue('Kolik je pět desetin?');
    expect(within(part(1)).getByText('0.5', { selector: '[data-content]' })).toBeInTheDocument();
    expect(screen.getByText(m['admin.status.DRAFT'])).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: label('admin.viewer.canvas', { page: 57 }) })).toBeInTheDocument();
  });

  it('saves changes with updateTask and stays on the task', async () => {
    const backend = await openExisting();
    await userEvent.clear(field(m['admin.editor.prompt']));
    await userEvent.type(field(m['admin.editor.prompt']), 'Zapiš polovinu.');
    await save();
    expect(await screen.findByRole('status')).toHaveTextContent(m['admin.editor.updated']);
    expect(lastBody(backend, 'PUT').prompt).toBe('Zapiš polovinu.');
    expect(backend.tasks[0].input.prompt).toBe('Zapiš polovinu.');
    expect(field(m['admin.editor.prompt'])).toHaveValue('Zapiš polovinu.');
  });

  it('says the task was not found for an unknown id', async () => {
    stubSignedInAdmin();
    renderAt(<TaskEditorScreen />, '/admin/tasks/edit?taskId=99999999-9999-4999-8999-999999999999');
    expect(await screen.findByText(m['admin.editor.notFound'])).toBeInTheDocument();
  });

  it('offers a retry when the task cannot be loaded', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<TaskEditorScreen />, `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['admin.session.retry'] }));
    expect(await screen.findByRole('heading', { level: 1, name: m['admin.editor.editTitle'] })).toBeInTheDocument();
  });

  it('a new task offers images only after saving', async () => {
    await openNew();
    expect(screen.getByText(m['admin.images.saveFirst'])).toBeInTheDocument();
  });

  it('attaches a PNG, moves it first and removes the other (Attach and reorder images)', async () => {
    const backend = await openExisting();
    const images = screen.getByRole('region', { name: m['admin.images.title'] });
    expect(await within(images).findByRole('img', { name: label('admin.images.alt', { n: 1 }) })).toHaveAttribute('src', expect.stringMatching(/^blob:/));
    await userEvent.upload(within(images).getByLabelText(m['admin.images.add']), new File([makePng() as BlobPart], 'obr.png', { type: 'image/png' }));
    expect(await within(images).findByText(m['admin.images.attached'])).toBeInTheDocument();
    await within(images).findByRole('img', { name: label('admin.images.alt', { n: 2 }) });
    const added = backend.tasks[0].images[1].imageId;
    await userEvent.click(within(images).getByRole('button', { name: label('admin.images.moveEarlier', { n: 2 }) }));
    await waitFor(() => expect(backend.tasks[0].images[0].imageId).toBe(added));
    expect(lastBody(backend, 'PUT')).toEqual({ imageIds: [added, SEED.imageDecimal] });
    await userEvent.click(within(images).getByRole('button', { name: label('admin.images.moveLater', { n: 1 }) }));
    await waitFor(() => expect(backend.tasks[0].images[1].imageId).toBe(added));
    await userEvent.click(within(images).getByRole('button', { name: label('admin.images.remove', { n: 1 }) }));
    await waitFor(() => expect(backend.tasks[0].images.map((i) => i.imageId)).toEqual([added]));
    expect(backend.seen.find((r) => r.method === 'DELETE')?.headers.get('X-XSRF-TOKEN')).toBe('xsrf-123');
  });

  it('refuses a GIF before upload and leaves the images unchanged (Rejected image)', async () => {
    const backend = await openExisting();
    const images = screen.getByRole('region', { name: m['admin.images.title'] });
    await userEvent.upload(within(images).getByLabelText(m['admin.images.add']), new File(['GIF89a....'], 'a.gif', { type: 'image/gif' }), {
      applyAccept: false,
    });
    expect(await within(images).findByText(m['admin.images.rule'])).toBeInTheDocument();
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
    expect(backend.tasks[0].images).toHaveLength(1);
  });

  it('shows the server refusal of an image (11th image)', async () => {
    const backend = await openExisting();
    backend.override = {
      match: (method, path) => method === 'POST' && path.endsWith('/images'),
      status: 400,
      body: { errors: [{ field: 'file', message: 'A task can have at most 10 images.' }] },
    };
    const images = screen.getByRole('region', { name: m['admin.images.title'] });
    await userEvent.upload(within(images).getByLabelText(m['admin.images.add']), new File([makePng() as BlobPart], 'obr.png', { type: 'image/png' }));
    expect(await within(images).findByText('A task can have at most 10 images.')).toBeInTheDocument();
  });

  it('says an image change failed when the server cannot be reached', async () => {
    const backend = await openExisting();
    const images = screen.getByRole('region', { name: m['admin.images.title'] });
    await within(images).findByRole('img', { name: label('admin.images.alt', { n: 1 }) });
    backend.down = true;
    await userEvent.click(within(images).getByRole('button', { name: label('admin.images.remove', { n: 1 }) }));
    expect(await within(images).findByText(m['admin.images.failed'])).toBeInTheDocument();
  });

  it('a task without images says so', async () => {
    stubSignedInAdmin();
    renderAt(<TaskEditorScreen />, `/admin/tasks/edit?taskId=${SEED.taskChoice}`);
    const images = await screen.findByRole('region', { name: m['admin.images.title'] });
    expect(await within(images).findByText(m['admin.images.empty'])).toBeInTheDocument();
  });
});

describe('more editor paths', () => {
  it('opens a source from the query without a page at page 1', async () => {
    await openNew(`?sourceId=${SEED.sourceId}`);
    expect(field(m['admin.editor.page'])).toHaveValue('1');
  });

  it('turns "unit required" off for a number-with-unit part', async () => {
    const backend = await openNew();
    await typeSinglePartTask('Obvod?', '14 cm');
    await userEvent.selectOptions(within(part(1)).getByLabelText(m['admin.editor.partType']), m['admin.type.NUMBER_WITH_UNIT']);
    await userEvent.click(within(part(1)).getByLabelText(m['admin.editor.unitRequired']));
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').parts[0].spec.unitRequired).toBe(false);
  });

  it('translates only the second hint; the first falls back to Czech (Partial translation)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addHint'] }));
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addHint'] }));
    await userEvent.type(field(label('admin.editor.hint', { n: 1 })), 'První.');
    await userEvent.type(field(label('admin.editor.hint', { n: 2 })), 'Druhá.');
    await userEvent.type(field(label('admin.editor.trHint', { n: 2, locale: 'uk' })), 'Друга.');
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').translations.uk.hints).toEqual([null, 'Друга.']);
  });

  it('shows the status of a published task', async () => {
    stubSignedInAdmin();
    renderAt(<TaskEditorScreen />, `/admin/tasks/edit?taskId=${SEED.taskPerimeter}`);
    expect(await screen.findByText(m['admin.status.PUBLISHED'])).toBeInTheDocument();
  });

  it('offers a retry on a new task when the reference data cannot be loaded', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<TaskEditorScreen />, '/admin/tasks/edit');
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(screen.getByRole('button', { name: m['admin.session.retry'] }));
    expect(await screen.findByRole('heading', { level: 1, name: m['admin.editor.newTitle'] })).toBeInTheDocument();
    expect(await screen.findByLabelText(m['admin.editor.prompt'])).toBeInTheDocument();
  });

  it('ignores a file dialog closed without a file', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<TaskEditorScreen />, `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
    const images = await screen.findByRole('region', { name: m['admin.images.title'] });
    fireEvent.change(within(images).getByLabelText(m['admin.images.add']), { target: { files: [] } });
    expect(within(images).queryByRole('alert')).toBeNull();
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
  });
});

describe('details of the source reference and the task', () => {
  it('sends sub-part, difficulty and part label, and shows a grade that differs from the source on the grade field', async () => {
    const backend = stubSignedInAdmin();
    backend.reference.grades = [6, 7];
    renderAt(<TaskEditorScreen />, `/admin/tasks/edit?sourceId=${SEED.sourceId}&page=57`);
    await screen.findByLabelText(m['admin.editor.prompt']);
    await typeSinglePartTask();
    await userEvent.type(field(m['admin.editor.subPart']), 'b');
    await userEvent.selectOptions(field(m['admin.editor.difficulty']), '3');
    await userEvent.clear(within(part(1)).getByLabelText(m['admin.editor.partLabel']));
    await userEvent.type(within(part(1)).getByLabelText(m['admin.editor.partLabel']), 'x');
    await userEvent.selectOptions(field(m['admin.editor.grade']), '7');
    // A grade change clears the topic: grade-7 topics are offered instead (none are seeded here).
    expect(field(m['admin.editor.topic'])).toHaveValue('');
    await save();
    await waitFor(() => expect(field(m['admin.editor.grade'])).toHaveAccessibleDescription('The task grade must match the source grade (6).'));
    expect(lastBody(backend, 'POST')).toMatchObject({ grade: 7, difficulty: 3, sourceRef: { subPart: 'b' }, parts: [{ label: 'x' }] });
  });
});

describe('review fixes in the editor', () => {
  it('a removed hint takes its translation with it (F01)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addHint'] }));
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addHint'] }));
    await userEvent.type(field(label('admin.editor.hint', { n: 1 })), 'První.');
    await userEvent.type(field(label('admin.editor.hint', { n: 2 })), 'Druhá.');
    await userEvent.type(field(label('admin.editor.trHint', { n: 1, locale: 'uk' })), 'Перша.');
    await userEvent.click(screen.getByRole('button', { name: label('admin.editor.removeHint', { n: 1 }) }));
    expect(field(label('admin.editor.trHint', { n: 1, locale: 'uk' }))).toHaveValue('');
    await save();
    await screen.findByText(m['admin.editor.created']);
    expect(lastBody(backend, 'POST').hints).toEqual(['Druhá.']);
    expect(lastBody(backend, 'POST').translations).toBeUndefined();
  });

  it('a removed option moves the later option translations up a letter (F02)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    await userEvent.selectOptions(within(part(1)).getByLabelText(m['admin.editor.partType']), m['admin.type.CHOICE_SINGLE']);
    await userEvent.click(within(part(1)).getByRole('button', { name: m['admin.editor.addOption'] }));
    for (const [key, text] of [['A', 'x'], ['B', 'y'], ['C', 'z']])
      await userEvent.type(within(part(1)).getByLabelText(label('admin.editor.option', { key })), text);
    await userEvent.type(field(label('admin.editor.trOption', { key: 'C', n: 1, locale: 'uk' })), 'зет');
    await userEvent.click(within(part(1)).getByLabelText(label('admin.editor.optionCorrect', { key: 'C' })));
    await userEvent.click(within(part(1)).getByRole('button', { name: label('admin.editor.removeOption', { key: 'B' }) }));
    await save();
    await screen.findByText(m['admin.editor.created']);
    const body = lastBody(backend, 'POST');
    expect(body.parts[0].spec.options).toEqual([{ key: 'A', text: 'x' }, { key: 'B', text: 'z' }]);
    expect(body.translations.uk.options).toEqual({ [`${body.parts[0].key}.B`]: 'зет' });
  });

  it('refuses exact decimal places that are not a whole number before sending (F03)', async () => {
    const backend = await openNew();
    await typeSinglePartTask('Zapiš.', '0,5');
    await userEvent.selectOptions(within(part(1)).getByLabelText(m['admin.editor.partType']), m['admin.type.DECIMAL']);
    await userEvent.type(within(part(1)).getByLabelText(m['admin.editor.exactDecimals']), 'dva');
    await save();
    await waitFor(() =>
      expect(within(part(1)).getByLabelText(m['admin.editor.exactDecimals'])).toHaveAccessibleDescription(m['admin.editor.exactDecimalsInvalid']),
    );
    expect(backend.seen.some((r) => r.method === 'POST')).toBe(false);
  });

  it('keeps what is typed while a save runs (F08)', async () => {
    const backend = await openNew();
    await typeSinglePartTask();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const handle = backend.handle;
    backend.handle = async (request) => {
      if (request.method === 'POST') await gate;
      return handle(request);
    };
    await save();
    await userEvent.type(field(m['admin.editor.taskNo']), '9');
    release();
    await screen.findByText(m['admin.editor.created']);
    expect(field(m['admin.editor.taskNo'])).toHaveValue('49');
  });

  it('clears index-keyed errors when the parts change (F09)', async () => {
    await openNew();
    await userEvent.type(within(part(1)).getByLabelText(label('admin.editor.accepted', { n: 1 })), 'abc');
    await save();
    await screen.findByText('This value cannot be read.');
    await userEvent.click(screen.getByRole('button', { name: m['admin.editor.addPart'] }));
    expect(screen.queryByText('This value cannot be read.')).toBeNull();
  });
});

describe('saving without a source and editing during an update', () => {
  it('sends a task without a source and shows the refusal on the source field', async () => {
    stubSignedInAdmin();
    renderAt(<TaskEditorScreen />, '/admin/tasks/edit');
    await screen.findByLabelText(m['admin.editor.prompt']);
    await save();
    await waitFor(() => expect(field(m['admin.editor.source'])).toHaveAccessibleDescription('Choose a source.'));
  });

  it('keeps what is typed while an update runs', async () => {
    const backend = stubSignedInAdmin();
    renderAt(<TaskEditorScreen />, `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
    await waitFor(() => expect(field(m['admin.editor.prompt'])).toHaveValue('Zapiš jednu polovinu jako desetinné číslo.'));
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const handle = backend.handle;
    backend.handle = async (request) => {
      if (request.method === 'PUT') await gate;
      return handle(request);
    };
    await save();
    await userEvent.type(field(m['admin.editor.taskNo']), '9');
    release();
    await screen.findByText(m['admin.editor.updated']);
    expect(field(m['admin.editor.taskNo'])).toHaveValue('49');
  });
});

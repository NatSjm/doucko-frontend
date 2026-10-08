// @trace FR-9
// @trace FR-55
// Store spec content-authoring: "Missions", "Field limits: Too many tasks in a mission", "Mission
// publishing rules", "Draft and published status", "Edit existing content: Reorder a mission",
// "Delete only unused content" (refusals shown with their reason and blockers).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/i18n';
import { format } from '@/i18n/format';
import { stubSignedInAdmin, type StubbedAdminBackend } from '@/test/admin-backend';
import { addTask, SEED } from '@/test/fake-admin-backend';
import { renderAt } from '@/test/render';
import { MissionEditorScreen } from './MissionEditorScreen';

const m = messages;
const DECIMAL = 'Zapiš jednu polovinu jako desetinné číslo.';
const CHOICE = 'Které číslo je větší než 4?';
const field = (name: string) => screen.getByLabelText(name, { exact: true });
const taskList = () => screen.getByRole('list', { name: m['admin.missionEditor.tasks'] });
const listed = () => within(taskList()).queryAllByRole('listitem').map((li) => li.querySelector('[data-content]')?.textContent);
const picker = () => screen.getByRole('region', { name: m['admin.missionEditor.addTitle'] });
const addButton = (prompt: string) => within(picker()).getByRole('button', { name: `${m['admin.missionEditor.add']} ${prompt}` });
const counter = (count: number) => format(m['admin.missions.counter'], { count });
const button = (name: string) => screen.getByRole('button', { name });
const statusPanel = () => screen.getByRole('region', { name: m['admin.missionEditor.statusTitle'] });
const sent = (backend: StubbedAdminBackend, method: string, path: RegExp) => backend.seen.filter((r) => r.method === method && path.test(r.path));

vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openNew(prepare?: (b: StubbedAdminBackend) => void) {
  const backend = stubSignedInAdmin();
  prepare?.(backend);
  renderAt(<MissionEditorScreen />, '/admin/missions/edit');
  await screen.findByRole('heading', { level: 1, name: m['admin.missionEditor.newTitle'] });
  await screen.findByLabelText(m['admin.missionEditor.topic'], { exact: true });
  return backend;
}

async function openSaved(prepare?: (b: StubbedAdminBackend) => void) {
  const backend = stubSignedInAdmin();
  prepare?.(backend);
  renderAt(<MissionEditorScreen />, `/admin/missions/edit?missionId=${SEED.missionDecimals}`);
  await screen.findByRole('heading', { level: 1, name: m['admin.missionEditor.editTitle'] });
  await within(await screen.findByRole('list', { name: m['admin.missionEditor.tasks'] })).findByText(DECIMAL);
  return backend;
}

async function chooseTopic(name: string) {
  await userEvent.selectOptions(field(m['admin.missionEditor.topic']), name);
  await within(picker()).findAllByRole('button');
}

describe('new mission (FR-9)', () => {
  it('creates a draft mission with a topic, a position and tasks in a chosen order (Create a mission)', async () => {
    let third = '';
    const backend = await openNew((b) => {
      third = addTask(b, { topicId: SEED.topicDecimals, prompt: 'Zaokrouhli 3,46 na desetiny.' }).taskId;
    });
    expect(within(picker()).getByText(m['admin.missionEditor.chooseTopic'])).toBeInTheDocument();
    expect(screen.getByText(counter(0))).toBeInTheDocument();
    await chooseTopic('Desetinná čísla');
    // Only tasks of the chosen topic are offered.
    expect(within(picker()).queryByText('Vypočítej obvod obdélníku se stranami 3 cm a 4 cm.')).not.toBeInTheDocument();
    await userEvent.type(field(m['admin.missionEditor.position']), '2');
    await userEvent.click(addButton(DECIMAL));
    await userEvent.click(addButton(CHOICE));
    await userEvent.click(addButton('Zaokrouhli 3,46 na desetiny.'));
    expect(screen.getByText(counter(3))).toBeInTheDocument();
    // A task in the mission is not offered again (Same task twice).
    expect(within(picker()).queryByText(DECIMAL)).not.toBeInTheDocument();
    // Keyboard: move the third task to the first place.
    button(format(m['admin.missionEditor.moveUp'], { n: 3 })).focus();
    await userEvent.keyboard('{Enter}');
    expect(button(format(m['admin.missionEditor.moveUp'], { n: 2 }))).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(listed()).toEqual(['Zaokrouhli 3,46 na desetiny.', DECIMAL, CHOICE]);
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByText(m['admin.missionEditor.created'])).toBeInTheDocument();
    const created = backend.missions.at(-1);
    expect(created).toMatchObject({ topicId: SEED.topicDecimals, position: 2, status: 'DRAFT', taskIds: [third, SEED.taskDecimal, SEED.taskChoice] });
    expect(JSON.parse(sent(backend, 'POST', /^\/api\/admin\/missions$/)[0].body)).toEqual({
      topicId: SEED.topicDecimals,
      position: 2,
      taskIds: [third, SEED.taskDecimal, SEED.taskChoice],
    });
    // The saved mission is now the one being edited: the URL names it, publishing is offered.
    expect(window.location.search).toBe(`?missionId=${created?.missionId}`);
    expect(screen.getByRole('heading', { level: 1, name: m['admin.missionEditor.editTitle'] })).toBeInTheDocument();
    expect(button(m['admin.missionEditor.publish'])).toBeEnabled();
  });

  it('saves 12 tasks with the counter at 12/10 and no blocking message (Mission size other than 10)', async () => {
    const backend = await openNew((b) => {
      for (let i = 0; i < 10; i++) addTask(b, { topicId: SEED.topicPerimeter });
    });
    await chooseTopic('Obvod a obsah');
    await userEvent.type(field(m['admin.missionEditor.position']), '1');
    for (let i = 0; i < 12; i++) await userEvent.click(within(picker()).getAllByRole('button', { name: new RegExp(`^${m['admin.missionEditor.add']} `) })[0]);
    expect(screen.getByText(counter(12))).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByText(m['admin.missionEditor.created'])).toBeInTheDocument();
    expect(backend.missions.at(-1)?.taskIds).toHaveLength(12);
  });

  it.each(['', '0', 'abc', '1,5', '1000'])('refuses position %j inline before sending (Missing or duplicate position)', async (raw) => {
    const backend = await openNew();
    await chooseTopic('Desetinná čísla');
    if (raw) await userEvent.type(field(m['admin.missionEditor.position']), raw);
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByText(m['admin.missionEditor.positionInvalid'])).toBeInTheDocument();
    expect(field(m['admin.missionEditor.position'])).toHaveAttribute('aria-invalid', 'true');
    expect(field(m['admin.missionEditor.position'])).toHaveFocus();
    expect(sent(backend, 'POST', /missions/)).toHaveLength(0);
  });

  it('shows a duplicate position refused by the server under the position field; Enter saves', async () => {
    const backend = await openNew();
    await chooseTopic('Desetinná čísla');
    await userEvent.type(field(m['admin.missionEditor.position']), '1{Enter}');
    expect(await screen.findByText('Position 1 is already taken in this topic.')).toBeInTheDocument();
    expect(field(m['admin.missionEditor.position'])).toHaveAttribute('aria-invalid', 'true');
    expect(backend.missions).toHaveLength(1);
  });

  it('requires a topic before saving', async () => {
    const backend = await openNew();
    await userEvent.type(field(m['admin.missionEditor.position']), '4');
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByText('Choose a topic.')).toBeInTheDocument();
    expect(field(m['admin.missionEditor.topic'])).toHaveAttribute('aria-invalid', 'true');
    expect(backend.missions).toHaveLength(1);
  });

  it('locks the topic while the mission has tasks (Changing the topic of a non-empty mission)', async () => {
    await openNew();
    await chooseTopic('Desetinná čísla');
    expect(field(m['admin.missionEditor.topic'])).toBeEnabled();
    await userEvent.click(addButton(DECIMAL));
    expect(field(m['admin.missionEditor.topic'])).toBeDisabled();
    expect(screen.getByText(m['admin.missionEditor.topicLocked'])).toBeInTheDocument();
    await userEvent.click(button(format(m['admin.missionEditor.remove'], { n: 1 })));
    expect(field(m['admin.missionEditor.topic'])).toBeEnabled();
    // The removed task is offered again, and focus lands on the search (no row left).
    expect(addButton(DECIMAL)).toBeInTheDocument();
    expect(field(m['admin.missionEditor.search'])).toHaveFocus();
  });

  it('filters the offered tasks by a search without diacritics', async () => {
    await openNew();
    await chooseTopic('Desetinná čísla');
    await userEvent.type(field(m['admin.missionEditor.search']), 'vetsi');
    await waitFor(() => expect(within(picker()).queryByText(DECIMAL)).not.toBeInTheDocument());
    expect(within(picker()).getByText(CHOICE)).toBeInTheDocument();
    await userEvent.clear(field(m['admin.missionEditor.search']));
    await userEvent.type(field(m['admin.missionEditor.search']), 'nic takového');
    expect(await within(picker()).findByText(m['admin.missionEditor.noneToAdd'])).toBeInTheDocument();
  });

  it('offers a retry when the topic tasks cannot load', async () => {
    const backend = await openNew();
    backend.override = { match: (method, path) => method === 'GET' && path === '/api/admin/tasks', status: 500, body: { title: 'Server error' } };
    await userEvent.selectOptions(field(m['admin.missionEditor.topic']), 'Desetinná čísla');
    expect(await within(picker()).findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    await userEvent.click(within(picker()).getByRole('button', { name: m['admin.session.retry'] }));
    expect(await within(picker()).findByRole('button', { name: `${m['admin.missionEditor.add']} ${DECIMAL}` })).toBeInTheDocument();
  });

  it('after adding a task, focus moves to the next task to add', async () => {
    await openNew();
    await chooseTopic('Desetinná čísla');
    await userEvent.click(addButton(DECIMAL));
    expect(addButton(CHOICE)).toHaveFocus();
    await userEvent.click(addButton(CHOICE));
    expect(field(m['admin.missionEditor.search'])).toHaveFocus();
  });

  it('offers no 51st task and states the maximum of 50 (Too many tasks in a mission)', async () => {
    const backend = stubSignedInAdmin();
    const ids = Array.from({ length: 51 }, () => addTask(backend, { topicId: SEED.topicPerimeter }).taskId);
    backend.missions[0] = { ...backend.missions[0], topicId: SEED.topicPerimeter, taskIds: ids.slice(0, 50) };
    renderAt(<MissionEditorScreen />, `/admin/missions/edit?missionId=${SEED.missionDecimals}`);
    expect(await screen.findByText(counter(50))).toBeInTheDocument();
    expect(within(picker()).getByText(m['admin.missionEditor.max'])).toBeInTheDocument();
    const adds = await within(picker()).findAllByRole('button');
    expect(adds).toHaveLength(3);
    for (const add of adds) expect(add).toBeDisabled();
  });
});

describe('saved mission (FR-55)', () => {
  it('reorders and saves: the stored order follows (Reorder a mission)', async () => {
    const backend = await openSaved();
    expect(listed()).toEqual([DECIMAL, CHOICE]);
    expect(field(m['admin.missionEditor.position'])).toHaveValue('1');
    expect(screen.getByText(counter(2))).toBeInTheDocument();
    await userEvent.click(button(format(m['admin.missionEditor.moveDown'], { n: 1 })));
    // Focus follows the moved task; at the end its "down" button is disabled, so "up" takes focus.
    expect(button(format(m['admin.missionEditor.moveUp'], { n: 2 }))).toHaveFocus();
    expect(listed()).toEqual([CHOICE, DECIMAL]);
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByText(m['admin.missionEditor.updated'])).toBeInTheDocument();
    expect(backend.missions[0].taskIds).toEqual([SEED.taskChoice, SEED.taskDecimal]);
  });

  it('removes a task and adds another; the task stays in other missions (Task shared by two missions)', async () => {
    const backend = await openSaved((b) => {
      b.missions.push({ missionId: 'ffffffff-ffff-4fff-8fff-0000000000b1', topicId: SEED.topicDecimals, position: 2, taskIds: [SEED.taskChoice], status: 'DRAFT' });
    });
    await userEvent.click(button(format(m['admin.missionEditor.remove'], { n: 1 })));
    expect(listed()).toEqual([CHOICE]);
    expect(button(format(m['admin.missionEditor.remove'], { n: 1 }))).toHaveFocus();
    await userEvent.click(addButton(DECIMAL));
    expect(listed()).toEqual([CHOICE, DECIMAL]);
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByText(m['admin.missionEditor.updated'])).toBeInTheDocument();
    expect(backend.missions[0].taskIds).toEqual([SEED.taskChoice, SEED.taskDecimal]);
    expect(backend.missions[1].taskIds).toEqual([SEED.taskChoice]);
  });

  it('shows a refused task inline on its row (taskIds[i])', async () => {
    const backend = await openSaved();
    backend.override = {
      match: (method, path) => method === 'PUT' && path.endsWith(SEED.missionDecimals),
      status: 400,
      body: { title: 'Invalid input', errors: [{ field: 'taskIds[1]', message: 'The task is of topic Obvod a obsah, the mission of topic Desetinná čísla.' }] },
    };
    await userEvent.click(button(m['admin.missionEditor.save']));
    const rows = within(taskList()).getAllByRole('listitem');
    expect(await within(rows[1]).findByText('The task is of topic Obvod a obsah, the mission of topic Desetinná čísla.')).toBeInTheDocument();
    expect(within(rows[0]).queryByText(/The task is of topic/)).not.toBeInTheDocument();
  });

  it('shows a state-rule refusal with its reason (Removing the last task of a published mission)', async () => {
    const backend = await openSaved((b) => {
      b.missions[0].status = 'PUBLISHED';
      b.missions[0].taskIds = [SEED.taskDecimal];
    });
    await userEvent.click(button(format(m['admin.missionEditor.remove'], { n: 1 })));
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByRole('alert')).toHaveTextContent('The last task cannot be removed from a published mission. Unpublish the mission first.');
    expect(backend.missions[0].taskIds).toEqual([SEED.taskDecimal]);
  });

  it('keeps edits typed while a save runs', async () => {
    const backend = await openSaved();
    const handle = backend.handle;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    backend.handle = async (request) => {
      if (request.method === 'PUT') await gate;
      return handle(request);
    };
    await userEvent.click(button(m['admin.missionEditor.save']));
    await userEvent.clear(field(m['admin.missionEditor.position']));
    await userEvent.type(field(m['admin.missionEditor.position']), '7');
    release();
    expect(await screen.findByText(m['admin.missionEditor.updated'])).toBeInTheDocument();
    expect(field(m['admin.missionEditor.position'])).toHaveValue('7');
    expect(button(m['admin.missionEditor.publish'])).toBeDisabled();
  });

  it('names a blocker it cannot resolve by its id', async () => {
    const backend = await openSaved();
    backend.override = {
      match: (method, path) => method === 'PUT' && path.endsWith('/status'),
      status: 409,
      body: { title: 'Not allowed now', detail: 'Blocked.', conflicts: ['dddddddd-0000-4000-8000-00000000ffff'] },
    };
    await userEvent.click(button(m['admin.missionEditor.publish']));
    expect(await screen.findByRole('alert')).toHaveTextContent(format(m['admin.conflict.unknownItem'], { id: 'dddddddd-0000-4000-8000-00000000ffff' }));
  });

  it('a new mission retries loading the reference data', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<MissionEditorScreen />, '/admin/missions/edit');
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(button(m['admin.session.retry']));
    expect(await screen.findByLabelText(m['admin.missionEditor.topic'], { exact: true })).toBeInTheDocument();
  });

  it('says a mission is not found', async () => {
    stubSignedInAdmin();
    renderAt(<MissionEditorScreen />, '/admin/missions/edit?missionId=ffffffff-ffff-4fff-8fff-00000000ffff');
    expect(await screen.findByText(m['admin.missionEditor.notFound'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['admin.missionEditor.back'] })).toHaveAttribute('href', '/admin/missions');
  });

  it('shows a retry when the mission cannot load', async () => {
    const backend = stubSignedInAdmin();
    backend.failWith = 500;
    renderAt(<MissionEditorScreen />, `/admin/missions/edit?missionId=${SEED.missionDecimals}`);
    expect(await screen.findByText(m['admin.common.loadFailed'])).toBeInTheDocument();
    backend.failWith = null;
    await userEvent.click(button(m['admin.session.retry']));
    expect(await screen.findByRole('list', { name: m['admin.missionEditor.tasks'] })).toBeInTheDocument();
  });

  it('says saving failed without a server answer', async () => {
    const backend = await openSaved();
    backend.down = true;
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['admin.common.saveFailed']);
  });
});

describe('publishing (FR-9, store rules FR-57)', () => {
  it('a refused publish names the blocking draft tasks and the mission stays a draft (Mission with a draft task)', async () => {
    const backend = await openSaved();
    await userEvent.click(button(m['admin.missionEditor.publish']));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Only published text tasks can be in a published mission: 2 tasks block publishing.');
    expect(within(alert).getByRole('link', { name: DECIMAL })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${SEED.taskDecimal}`);
    expect(within(alert).getByRole('link', { name: CHOICE })).toHaveAttribute('href', `/admin/tasks/edit?taskId=${SEED.taskChoice}`);
    expect(backend.missions[0].status).toBe('DRAFT');
    expect(within(statusPanel()).getByText(m['admin.status.DRAFT'])).toBeInTheDocument();
  });

  it('an empty mission cannot be published (Empty mission cannot be published)', async () => {
    const backend = stubSignedInAdmin();
    backend.missions[0].taskIds = [];
    renderAt(<MissionEditorScreen />, `/admin/missions/edit?missionId=${SEED.missionDecimals}`);
    await userEvent.click(await screen.findByRole('button', { name: m['admin.missionEditor.publish'] }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A mission needs at least one task to be published.');
  });

  it('publishes a valid mission and unpublishes it again (Publish a valid mission)', async () => {
    const backend = await openSaved((b) => b.tasks.forEach((t) => (t.status = 'PUBLISHED')));
    await userEvent.click(button(m['admin.missionEditor.publish']));
    expect(await screen.findByText(m['admin.missionEditor.published'])).toBeInTheDocument();
    expect(backend.missions[0].status).toBe('PUBLISHED');
    expect(within(statusPanel()).getByText(m['admin.status.PUBLISHED'])).toBeInTheDocument();
    await userEvent.click(button(m['admin.missionEditor.unpublish']));
    expect(await screen.findByText(m['admin.missionEditor.unpublished'])).toBeInTheDocument();
    expect(backend.missions[0].status).toBe('DRAFT');
  });

  it('after a publish, the task rows show the tasks published meanwhile, not a stale Draft (vision-verify phase 6)', async () => {
    const backend = await openSaved();
    await userEvent.click(button(m['admin.missionEditor.publish']));
    await screen.findByRole('alert');
    expect(within(taskList()).getAllByText(m['admin.status.DRAFT'])).toHaveLength(2);
    // The tasks are published elsewhere (the task list or another tab); publishing again succeeds.
    backend.tasks.forEach((t) => (t.status = 'PUBLISHED'));
    await userEvent.click(button(m['admin.missionEditor.publish']));
    expect(await screen.findByText(m['admin.missionEditor.published'])).toBeInTheDocument();
    await waitFor(() => expect(within(taskList()).queryAllByText(m['admin.status.DRAFT'])).toHaveLength(0));
    expect(within(taskList()).getAllByText(m['admin.status.PUBLISHED'])).toHaveLength(2);
  });

  it('after a refused publish, the task rows show a task published meanwhile (review F08)', async () => {
    const backend = await openSaved();
    expect(within(taskList()).getAllByText(m['admin.status.DRAFT'])).toHaveLength(2);
    // One task is published elsewhere; the other still blocks the mission.
    backend.tasks.find((t) => t.taskId === SEED.taskDecimal)!.status = 'PUBLISHED';
    await userEvent.click(button(m['admin.missionEditor.publish']));
    await screen.findByRole('alert');
    await waitFor(() => expect(within(taskList()).getAllByText(m['admin.status.DRAFT'])).toHaveLength(1));
    expect(within(taskList()).getAllByText(m['admin.status.PUBLISHED'])).toHaveLength(1);
  });

  it('asks to save changes before publishing', async () => {
    await openSaved();
    await userEvent.click(button(format(m['admin.missionEditor.moveDown'], { n: 1 })));
    expect(button(m['admin.missionEditor.publish'])).toBeDisabled();
    expect(screen.getByText(m['admin.missionEditor.saveFirst'])).toBeInTheDocument();
  });

  it('a later publish clears an earlier save refusal (review F02)', async () => {
    const backend = await openSaved((b) => b.tasks.forEach((t) => (t.status = 'PUBLISHED')));
    backend.down = true;
    await userEvent.click(button(m['admin.missionEditor.save']));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['admin.common.saveFailed']);
    backend.down = false;
    await userEvent.click(button(m['admin.missionEditor.publish']));
    expect(await screen.findByText(m['admin.missionEditor.published'])).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the status change failed without a server answer', async () => {
    const backend = await openSaved();
    backend.down = true;
    await userEvent.click(button(m['admin.missionEditor.publish']));
    expect(await screen.findByRole('alert')).toHaveTextContent(m['admin.common.actionFailed']);
  });
});

describe('deleting (FR-55, store rule FR-56)', () => {
  it('deletes an unused mission after confirming and keeps its tasks (Delete an unused mission keeps its tasks)', async () => {
    const backend = await openSaved();
    await userEvent.click(button(m['admin.missionEditor.delete']));
    expect(screen.getByText(m['admin.missionEditor.confirmDelete'])).toBeInTheDocument();
    await userEvent.click(button(m['admin.common.delete']));
    expect(await screen.findByText(m['admin.missionEditor.deleted'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m['admin.missionEditor.back'] })).toHaveAttribute('href', '/admin/missions');
    expect(backend.missions).toHaveLength(0);
    expect(backend.tasks.map((t) => t.taskId)).toContain(SEED.taskDecimal);
  });

  it('disables delete with an explanation offering to unpublish when practice records exist (Mission with attempted tasks)', async () => {
    await openSaved((b) => b.usage.add(SEED.taskChoice));
    expect(button(m['admin.missionEditor.delete'])).toBeDisabled();
    expect(screen.getByText(m['admin.missionEditor.notDeletable'])).toBeInTheDocument();
  });

  it('shows a delete refused by the server with its reason and blockers', async () => {
    const backend = await openSaved();
    backend.usage.add(SEED.taskChoice);
    await userEvent.click(button(m['admin.missionEditor.delete']));
    await userEvent.click(button(m['admin.common.delete']));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Practice records reference tasks of this mission, so it cannot be deleted. Unpublish it instead.');
    expect(within(alert).getByRole('link', { name: CHOICE })).toBeInTheDocument();
    expect(backend.missions).toHaveLength(1);
  });
});

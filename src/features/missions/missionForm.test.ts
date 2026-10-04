// @trace FR-9
// @trace FR-55
// Store spec content-authoring: "Missions" (position 1–999, ordered tasks, a task at most once),
// "Field limits" (0–50 tasks per mission), "Edit existing content: Reorder a mission".
import { describe, expect, it } from 'vitest';
import type { AdminMission } from './api';
import { addTask, emptyMissionForm, fromAdminMission, isDirty, MAX_TASKS, moveTask, parsePosition, removeTask, toMissionInput } from './missionForm';

const mission: AdminMission = {
  missionId: 'm-1',
  topicId: 'topic-1',
  position: 3,
  taskIds: ['t1', 't2', 't3'],
  status: 'DRAFT',
  hasAttempts: false,
  deletable: true,
};

describe('mission form model (FR-9, FR-55)', () => {
  it('starts empty: no topic, no position, no tasks', () => {
    expect(emptyMissionForm()).toEqual({ topicId: '', position: '', taskIds: [] });
  });

  it('round-trips a stored mission, keeping the task order', () => {
    const form = fromAdminMission(mission);
    expect(form).toEqual({ topicId: 'topic-1', position: '3', taskIds: ['t1', 't2', 't3'] });
    expect(toMissionInput(form)).toEqual({ topicId: 'topic-1', position: 3, taskIds: ['t1', 't2', 't3'] });
  });

  it('the form owns a copy of the task list', () => {
    const form = fromAdminMission(mission);
    form.taskIds.push('t4');
    expect(mission.taskIds).toEqual(['t1', 't2', 't3']);
  });

  it.each([
    ['1', 1],
    ['999', 999],
    [' 42 ', 42],
  ])('accepts position %j as %i', (raw, value) => {
    expect(parsePosition(raw)).toBe(value);
  });

  it.each(['', '0', '1000', 'abc', '1,5', '1.5', '-3', '01', '2e2'])('refuses position %j (Missing or duplicate position)', (raw) => {
    expect(parsePosition(raw)).toBeNull();
  });

  it('moves a task up and down; a move past either end changes nothing (Reorder a mission)', () => {
    const ids = ['t1', 't2', 't3'];
    expect(moveTask(ids, 2, -1)).toEqual(['t1', 't3', 't2']);
    expect(moveTask(moveTask(ids, 2, -1), 1, -1)).toEqual(['t3', 't1', 't2']);
    expect(moveTask(ids, 0, 1)).toEqual(['t2', 't1', 't3']);
    expect(moveTask(ids, 0, -1)).toEqual(ids);
    expect(moveTask(ids, 2, 1)).toEqual(ids);
    expect(ids).toEqual(['t1', 't2', 't3']);
  });

  it('adds a task at the end, never twice (Same task twice)', () => {
    expect(addTask(['t1'], 't2')).toEqual(['t1', 't2']);
    expect(addTask(['t1', 't2'], 't1')).toEqual(['t1', 't2']);
  });

  it(`adds no task past the maximum of ${MAX_TASKS} (Too many tasks in a mission)`, () => {
    const full = Array.from({ length: MAX_TASKS }, (_, i) => `t${i}`);
    expect(MAX_TASKS).toBe(50);
    expect(addTask(full, 'extra')).toEqual(full);
    expect(addTask(full.slice(1), 'extra')).toHaveLength(MAX_TASKS);
  });

  it('removes a task by index and keeps the order of the rest', () => {
    expect(removeTask(['t1', 't2', 't3'], 1)).toEqual(['t1', 't3']);
  });

  it('is dirty when topic, position, tasks or their order differ from the stored mission', () => {
    const form = fromAdminMission(mission);
    expect(isDirty(form, mission)).toBe(false);
    expect(isDirty({ ...form, position: '4' }, mission)).toBe(true);
    expect(isDirty({ ...form, position: ' 3 ' }, mission)).toBe(false);
    expect(isDirty({ ...form, topicId: 'topic-2' }, mission)).toBe(true);
    expect(isDirty({ ...form, taskIds: ['t2', 't1', 't3'] }, mission)).toBe(true);
    expect(isDirty({ ...form, taskIds: ['t1', 't2'] }, mission)).toBe(true);
    expect(isDirty(emptyMissionForm(), null)).toBe(true);
  });
});

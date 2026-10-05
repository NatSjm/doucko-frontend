import type { AdminMission, MissionInput } from './api';

/** Tasks per mission (content-authoring "Field limits"); 10 is only the target the counter shows (CA-D18). */
export const MAX_TASKS = 50;

/** The mission editor's state: the position as typed, the task ids in mission order. */
export interface MissionForm {
  topicId: string;
  position: string;
  taskIds: string[];
}

export function emptyMissionForm(): MissionForm {
  return { topicId: '', position: '', taskIds: [] };
}

export function fromAdminMission(m: AdminMission): MissionForm {
  return { topicId: m.topicId, position: String(m.position), taskIds: [...m.taskIds] };
}

/** A position is a whole number from 1 to 999 written plainly (CA-D17); anything else is null. */
export function parsePosition(raw: string): number | null {
  const value = raw.trim();
  return /^[1-9]\d{0,2}$/.test(value) ? Number(value) : null;
}

/** The request body; call it only with a valid position (see [parsePosition]). */
export function toMissionInput(f: MissionForm): MissionInput {
  return { topicId: f.topicId, position: parsePosition(f.position) as number, taskIds: [...f.taskIds] };
}

/** The ids with the task at `i` moved by `delta` places; a move past either end changes nothing. */
export function moveTask(ids: string[], i: number, delta: number): string[] {
  const j = i + delta;
  if (j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Appends a task: never twice (CA-D12), never past [MAX_TASKS]. */
export function addTask(ids: string[], id: string): string[] {
  return ids.includes(id) || ids.length >= MAX_TASKS ? ids : [...ids, id];
}

export function removeTask(ids: string[], i: number): string[] {
  return ids.filter((_, k) => k !== i);
}

/** True when the form would change the stored mission (or there is none yet). */
export function isDirty(f: MissionForm, m: AdminMission | null): boolean {
  if (!m) return true;
  return f.topicId !== m.topicId || parsePosition(f.position) !== m.position || f.taskIds.join() !== m.taskIds.join();
}

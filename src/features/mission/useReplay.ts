import { useState } from 'react';
import { navigate } from '@/app/navigation';
import { ApiError } from '@/features/admin-access/problem';
import { startReplay } from './api';

/**
 * Starts or resumes a replay of a completed mission (`startReplay`, FR-33) and opens the first
 * unresolved task of that run. A 409 means the mission is no longer complete (its content changed):
 * `onConflict` shows what the server holds now instead of an error that a retry cannot fix. Any other
 * failure sets `failed` (cleared before each new try). Shared by the briefing and the summary.
 */
export function useReplay(missionId: string, onConflict: () => void) {
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  async function start() {
    setStarting(true);
    setFailed(false);
    try {
      const task = await startReplay(missionId);
      navigate(`/task?missionId=${missionId}&taskId=${task.taskId}`);
    } catch (error) {
      setStarting(false);
      if (error instanceof ApiError && error.status === 409) onConflict();
      else setFailed(true);
    }
  }
  return { start, starting, failed };
}

import { adminDateTime } from '@/i18n/format';

/** A report or attempt time as the admin reads it: "5 Oct 2026, 16:20", Europe/Prague. */
export function formatTime(instant: string): string {
  return adminDateTime(instant);
}

/** One part's raw input exactly as logged; a choice answer (its option keys) joined. */
export function rawText(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : value;
}

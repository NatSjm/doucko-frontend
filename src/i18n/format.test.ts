// @trace NFR-9
import { describe, expect, it } from 'vitest';
import { format } from './format';

describe('format (catalog placeholders)', () => {
  it('fills every placeholder by name, numbers included', () => {
    expect(format('Page {page} of {count}', { page: 5, count: 120 })).toBe('Page 5 of 120');
  });

  it('leaves an unknown placeholder visible, so a missing value is noticed', () => {
    expect(format('Hint {n} ({locale})', { n: 2 })).toBe('Hint 2 ({locale})');
  });

  it('keeps a pseudo-catalog wrapper around the filled text', () => {
    expect(format('⟦Part {n}⟧', { n: 1 })).toBe('⟦Part 1⟧');
  });
});

describe('admin dates', () => {
  it('shows a calendar date as served (ISO 8601), never shifted by a time zone', async () => {
    const { adminDate } = await import('./format');
    expect(adminDate('2026-09-14')).toBe('2026-09-14');
  });

  it('shows an instant in Europe/Prague with a 24-hour time, summer and winter', async () => {
    const { adminDateTime } = await import('./format');
    expect(adminDateTime('2026-10-05T14:20:00Z')).toBe('2026-10-05 16:20');
    expect(adminDateTime('2026-01-05T23:20:00Z')).toBe('2026-01-06 00:20');
  });
});

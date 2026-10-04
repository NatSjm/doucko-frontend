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

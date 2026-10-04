// @trace FR-2
import { describe, expect, it } from 'vitest';
import { parsePage } from './page';

describe('parsePage (content-authoring "Page out of range or not a whole number")', () => {
  it('reads a whole page number within 1..pageCount', () => {
    expect(parsePage('57', 120)).toBe(57);
    expect(parsePage(' 1 ', 120)).toBe(1);
    expect(parsePage('120', 120)).toBe(120);
  });

  it.each(['130', '121', '0', 'abc', '5,5', '5.5', '2,0', '99999999999', '', '-3', '1e2'])('refuses %j for a 120-page source', (raw) => {
    expect(parsePage(raw, 120)).toBeNull();
  });
});

/**
 * A page number the admin typed: a whole number from 1 to `pageCount`, written with digits only (no
 * sign, decimal part or exponent), or null (content-authoring "Page out of range or not a whole number").
 */
export function parsePage(raw: string, pageCount: number): number | null {
  const text = raw.trim();
  if (!/^\d{1,9}$/.test(text)) return null;
  const page = Number(text);
  return page >= 1 && page <= pageCount ? page : null;
}

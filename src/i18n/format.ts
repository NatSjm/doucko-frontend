/**
 * Fills `{name}` placeholders of a catalog string: `format(t('admin.viewer.status'), { page, count })`.
 * An unknown placeholder stays visible, so a missing value shows up instead of vanishing.
 */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

const PRAGUE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Prague',
});

/**
 * An admin date: the calendar date (`YYYY-MM-DD`) as served, never shifted by a time zone. Admin
 * dates are numeric (ISO 8601), so they read the same in every browser and carry no words outside
 * the catalog (NFR-9).
 */
export function adminDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

/** An admin time, "2026-10-05 16:20", of an instant in Europe/Prague (the product's time zone), 24 h. */
export function adminDateTime(instant: string): string {
  const p = Object.fromEntries(PRAGUE.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/**
 * Fills `{name}` placeholders of a catalog string: `format(t('admin.viewer.status'), { page, count })`.
 * An unknown placeholder stays visible, so a missing value shows up instead of vanishing.
 */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

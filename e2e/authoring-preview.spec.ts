// @trace FR-7
// @trace FR-8
// @trace FR-10
// Store spec content-authoring: "Preview and answer tester", "Hints", "Translations".
import { format } from '../src/i18n/format';
import { messages as m } from '../src/i18n/messages';
import { SEED } from '../src/test/fake-admin-backend';
import { signedInAdmin } from './fixtures/admin';
import { AGAINST_STACK, expect, test } from './fixtures/test';

test.skip(AGAINST_STACK, 'answers come from the fake admin backend; the stack smoke covers the real one');

test('the preview shows the draft task as the child sees it, without the source reference (FR-10)', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto(`/admin/tasks/preview?taskId=${SEED.taskDecimal}`);
  const view = page.getByRole('region', { name: m['admin.preview.childView'] });
  await expect(view.getByText('Zapiš jednu polovinu jako desetinné číslo.')).toBeVisible();
  await expect(view.locator('[lang="cs"]').first()).toBeAttached();
  await expect(view.getByPlaceholder(m['child.task.answerPlaceholder'])).toBeVisible();
  await expect(page.getByText('Matematika 6 – pracovní sešit')).toHaveCount(0);
  // Hints open one by one (FR-7); the translation toggle shows Ukrainian beside Czech (FR-8).
  await view.getByRole('button', { name: new RegExp(m['child.task.hint']) }).click();
  await expect(view.getByText('Polovina je jedna děleno dvěma.')).toBeVisible();
  await view.getByRole('button', { name: m['child.task.showTranslation'] }).click();
  await expect(view.locator('[lang="uk"]').getByText('Запиши одну половину як десятковий дріб.')).toBeVisible();
  await expect(view.getByText('Zapiš jednu polovinu jako desetinné číslo.')).toBeVisible();
});

test('keyboard only: the answer tester shows CORRECT, WRONG and UNPARSEABLE with the normalized value (FR-10)', async ({ page }) => {
  await signedInAdmin(page);
  await page.goto(`/admin/tasks/preview?taskId=${SEED.taskDecimal}`);
  const tester = page.getByRole('region', { name: m['admin.preview.tester'] });
  const answer = tester.getByLabel(format(m['admin.preview.answerFor'], { label: 'a' }));
  const result = tester.getByRole('group', { name: format(m['admin.preview.result'], { label: 'a' }) });
  await answer.fill('0,50');
  await answer.press('Enter');
  await expect(result.getByText(m['admin.verdict.CORRECT'])).toBeVisible();
  await expect(result.getByText('0.5', { exact: true })).toBeVisible();
  await answer.fill('0,4');
  await answer.press('Enter');
  await expect(result.getByText(m['admin.verdict.WRONG'])).toBeVisible();
  await answer.fill('5,,2');
  await answer.press('Enter');
  await expect(result.getByText(m['admin.verdict.UNPARSEABLE'])).toBeVisible();
  await expect(result.getByText('Tohle číslo neumím přečíst. Zkus třeba 5,2.')).toBeVisible();
});

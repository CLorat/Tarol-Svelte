import { expect, expectAccessible, test } from './fixtures.js';
import { components, others } from './routes.js';

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    for (const name of components) {
      test(`component ${name}: renders, axe 0, CLS ≤ 0.01`, async ({ page }) => {
        await page.goto(`/?theme=${theme}#/components/${name}`);
        await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
        await expect(page.locator('[data-testid=example]')).toBeVisible();
        await expect(page.locator('[data-testid=example] [aria-busy=true]')).toHaveCount(0);
        await expect(page.getByRole('table', { name: `Props of ${name}` }).or(page.getByText('None.'))).toBeVisible();
        await expectAccessible(page);
      });
    }
    for (const hash of others) {
      test(`page ${hash}: axe 0, CLS ≤ 0.01`, async ({ page }) => {
        await page.goto(`/?theme=${theme}${hash}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectAccessible(page);
      });
    }
  });
}

test('the props tables come from the components’ types', async ({ page }) => {
  await page.goto('/#/components/Combobox');
  const table = page.getByRole('table', { name: 'Props of Combobox' });
  await expect(table.getByRole('rowheader', { name: 'filter?' })).toBeVisible();
  await expect(table).toContainText('(option: ComboboxOption, text: string) => boolean');
  await expect(table.getByRole('row', { name: /value\?.*bindable/ })).toContainText('null');
});

test('the keyboard table and a live example work together: the menu button by keys', async ({ page }) => {
  await page.goto('/#/components/MenuButton');
  await expect(page.getByRole('table', { name: 'Keyboard support of MenuButton' })).toBeVisible();
  await page.getByRole('button', { name: 'Actions' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused(); // the menu opens on its toggle event
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Chosen: delete')).toBeVisible();
});

import { expect, test } from './fixtures.js';
import { components, settled } from './routes.js';

// SV-12: one screenshot per component × theme × density, compared in the Linux CI container only (TAROL_VISUAL=1);
// fonts and anti-aliasing differ on other systems, so baselines made elsewhere would only produce noise.
test.skip(process.env['TAROL_VISUAL'] !== '1', 'visual regression runs in the CI container (TAROL_VISUAL=1)');

for (const name of components)
  for (const theme of ['light', 'dark'] as const)
    for (const density of ['comfortable', 'compact'] as const)
      test(`${name} ${theme} ${density}`, async ({ page }) => {
        await page.goto(`/?theme=${theme}&density=${density}#/components/${name}`);
        await page.locator(settled).waitFor();
        await expect(page.locator('[data-testid=example]')).toHaveScreenshot(`${name}-${theme}-${density}.png`, {
          animations: 'disabled',
          caret: 'hide',
        });
      });

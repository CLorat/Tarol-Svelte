import { expect, test } from '@playwright/test';

// SV-21: the GitHub Pages build is the catalogue alone. Run with VITE_TAROL_PAGES=1 (the webServer builds with it).
test.skip(process.env['VITE_TAROL_PAGES'] !== '1', 'the GitHub Pages build only (VITE_TAROL_PAGES=1)');

test('the Pages build calls no backend and hides the screens that need one', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== 'http://localhost:5173') foreign.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'tarol-svelte' })).toBeVisible();
  await expect(page.getByRole('link', { name: /ArtFlow|admin/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'DataTable' })).toBeVisible();

  await page.goto('/#/components/DataTable');
  await expect(page.getByRole('gridcell').first()).toBeVisible();

  for (const hash of ['#/auctions', '#/admin']) {
    await page.goto(`/${hash}`);
    await expect(page.getByTestId('needs-sample')).toBeVisible();
  }
  expect(foreign).toEqual([]);
});

test('assets load from relative paths, so the site works under /Tarol-Svelte/', async ({ page }) => {
  await page.goto('/');
  const sources = await page.locator('script[src], link[rel="stylesheet"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('src') ?? e.getAttribute('href') ?? ''),
  );
  expect(sources.length).toBeGreaterThan(0);
  for (const s of sources) expect(s.startsWith('./')).toBe(true);
});

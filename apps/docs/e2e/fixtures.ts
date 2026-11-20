import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { loginConfig, password, userId, type Person } from './sample.js';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
// the IIFE build is not in the package's exports: resolve the package, then the file next to its entry
const vitalsPath = join(dirname(require.resolve('web-vitals')), 'web-vitals.iife.js');
// Playwright wraps an init script in a function, so the IIFE's `var webVitals` would stay local: publish it
const vitalsScript = `${readFileSync(vitalsPath, 'utf8')};window.webVitals = webVitals;`;

interface Vitals {
  inp: number | null;
  cls: number;
}

declare global {
  interface Window {
    __vitals: Vitals;
    webVitals: {
      onINP: (f: (m: { value: number }) => void, o: { reportAllChanges: boolean }) => void;
      onCLS: (f: (m: { value: number }) => void, o: { reportAllChanges: boolean }) => void;
    };
    axe: { run: (root: Element, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> };
  }
}

/**
 * Signs a human user in the way a person does: the app's "Sign in" button, Zitadel's login page (user name, then the
 * password of this sample run), back to the app with code + PKCE (`@clorat/tarol-oidc`). The app gets its login settings
 * from `oidc.json`, served here from the sample's setup output (the client id is made per run). Tokens live in the page's
 * memory, so later navigations must change the hash only (`page.goto('/#/…')` keeps the document).
 */
export async function signIn(page: Page, person: Person, path = '/#/'): Promise<void> {
  await page.route('**/oidc.json', (route) => route.fulfill({ json: loginConfig() }));
  await page.goto(path);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('#loginName').fill(person);
  await page.locator('#submit-button').click();
  await page.locator('#password').fill(password(person));
  await page.locator('#submit-button').click();
  await expect(page.getByTestId('user')).toHaveText(userId(person));
  await expect.poll(() => new URL(page.url()).hash).toBe(new URL(path, 'http://localhost').hash); // back where it started
}

/** Expects no axe-core violation (WCAG 2.0–2.2 A/AA) on the page (philosophy P6). */
export async function expectAccessible(page: Page): Promise<void> {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const r = await window.axe.run(document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });
  expect(violations).toEqual([]);
}

/** Web vitals of the page so far: INP (null before the first interaction) and CLS (philosophy P1). */
export async function vitals(page: Page): Promise<Vitals> {
  return page.evaluate(() => window.__vitals);
}

/** Every test records INP and CLS and asserts P1's limits: INP ≤ 100 ms, CLS ≤ 0.01. */
export const test = base.extend<{ vitalsChecked: undefined }>({
  vitalsChecked: [
    async ({ page }, use, info) => {
      await page.addInitScript({ content: vitalsScript });
      await page.addInitScript(() => {
        window.__vitals = { inp: null, cls: 0 };
        addEventListener('DOMContentLoaded', () => {
          window.webVitals.onINP((m) => (window.__vitals.inp = m.value), { reportAllChanges: true });
          window.webVitals.onCLS((m) => (window.__vitals.cls = m.value), { reportAllChanges: true });
        });
      });
      await use(undefined);
      if (info.status !== 'passed' || page.isClosed()) return;
      const v = await vitals(page);
      info.annotations.push({ type: 'vitals', description: `INP ${String(v.inp)} ms, CLS ${v.cls.toFixed(4)}` });
      expect(v.cls, 'CLS').toBeLessThanOrEqual(0.01);
      if (v.inp !== null) expect(v.inp, 'INP').toBeLessThanOrEqual(100);
    },
    { auto: true },
  ],
});

export { expect };

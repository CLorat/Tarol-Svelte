import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import '../dist/tokens.css';
import { expectAccessible } from './axe.js';
import Variants from './fixtures/Variants.svelte';

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** Emulates `prefers-reduced-motion` in the page (Playwright `page.emulateMedia`). */
    reducedMotion: (value: 'reduce' | 'no-preference') => Promise<void>;
  }
}

let app: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  document.body.innerHTML = '';
  await commands.reducedMotion('no-preference');
});
function render<P extends Record<string, unknown>>(component: Component<P>, props: NoInfer<P> = {} as P): void {
  app = mount(component, { target: document.body, props });
  flushSync();
}
const duration = (name: string) => getComputedStyle(page.getByRole('button', { name }).element()).transitionDuration;

// Tatalu FB-F06.1-3: axe reported color-contrast on a Button checked right after its variant changed, while the
// background was still in its transition (the text colour switches at once).
describe('motion (TS-35)', () => {
  it('animates the button background by default', () => {
    render(Variants);
    expect(duration('Week')).toBe('0.12s');
  });

  it('has no colour transition under prefers-reduced-motion: reduce, so axe right after a variant switch passes', async () => {
    await commands.reducedMotion('reduce');
    render(Variants);
    expect(duration('Week')).toBe('0s');
    await userEvent.click(page.getByRole('button', { name: 'Week' }));
    await expectAccessible();
  });

  it('ThemeRoot motion="reduce" sets the duration tokens to 0 (the test recipe, and an in-app setting)', async () => {
    render(Variants, { motion: 'reduce' });
    const root = getComputedStyle(document.querySelector('.t-root')!);
    expect([root.getPropertyValue('--t-duration-fast'), root.getPropertyValue('--t-duration-normal')]).toEqual([
      '0ms',
      '0ms',
    ]);
    expect(duration('Week')).toBe('0s');
    await userEvent.click(page.getByRole('button', { name: 'Week' }));
    await expectAccessible();
  });
});

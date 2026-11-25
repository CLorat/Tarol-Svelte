import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import '@clorat/tarol-design/tokens.css';
import { expectAccessible } from './axe.js';
import Shell from './fixtures/Shell.svelte';

// TS-1 (Tatalu): AppShell on a phone. Measured in Chromium at 360 × 740 (a small Android phone) and 1024 × 768.
let app: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  document.body.innerHTML = '';
  window.scrollTo(0, 0);
});
async function show(width: number, navPosition?: 'side' | 'bottom'): Promise<{ nav: DOMRect; main: DOMRect }> {
  await page.viewport(width, width < 600 ? 740 : 768);
  app = mount(Shell, { target: document.body, props: { navPosition } });
  flushSync();
  const nav = document.querySelector('nav')!.getBoundingClientRect();
  const main = document.querySelector('main')!.getBoundingClientRect();
  return { nav, main };
}
const noHorizontalScroll = (): boolean => document.documentElement.scrollWidth <= window.innerWidth;

describe('AppShell on a phone (TS-1)', () => {
  it('the default stacks the nav above the page at 360 px: the page keeps the full width, no horizontal scroll', async () => {
    const { nav, main } = await show(360);
    expect(main.width).toBe(360);
    expect(nav.bottom).toBeLessThanOrEqual(main.top + 1);
    expect(noHorizontalScroll()).toBe(true);
    await expectAccessible();
  });

  it('navPosition="bottom" is a one-row bar at the bottom of the viewport with targets of at least 44 px', async () => {
    const { nav, main } = await show(360, 'bottom');
    expect(main.width).toBe(360);
    expect(nav.bottom).toBe(window.innerHeight); // at the thumb while the page scrolls
    expect(nav.height).toBeLessThanOrEqual(64);
    const links = [...document.querySelectorAll('nav a')].map((a) => a.getBoundingClientRect());
    expect(new Set(links.map((l) => Math.round(l.top))).size).toBe(1); // one row
    for (const l of links) expect(l.height).toBeGreaterThanOrEqual(44);
    expect(noHorizontalScroll()).toBe(true);
    page.getByTestId('last').element().scrollIntoView();
    const last = page.getByTestId('last').element().getBoundingClientRect();
    expect(last.bottom).toBeLessThanOrEqual(document.querySelector('nav')!.getBoundingClientRect().top); // never under the bar
    await expectAccessible();
  });

  it('navPosition="bottom": the page scrolls in its own area above the bar, never under it, the document not at all (TS-19)', async () => {
    const { nav } = await show(360, 'bottom');
    const main = document.querySelector('main')!;
    // the document has no scroll, not even by the bar's height (Tatalu FB-INT-2)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
    expect(main.scrollHeight).toBeGreaterThan(main.clientHeight);
    main.scrollTop = main.scrollHeight / 2; // mid-scroll: with a sticky bar, lines pass under it here
    expect(main.getBoundingClientRect().bottom).toBeLessThanOrEqual(nav.top + 0.5);
    // the scroll area ends where the bar begins: nothing of the page is ever under the bar
    expect(nav.bottom).toBe(window.innerHeight);
    await expectAccessible();
  });

  it('navPosition="bottom" is the side nav on a wide screen', async () => {
    const { nav, main } = await show(1024, 'bottom');
    expect(nav.right).toBeLessThanOrEqual(main.left + 1);
    expect(nav.top).toBeLessThan(100);
    await expectAccessible();
  });
});

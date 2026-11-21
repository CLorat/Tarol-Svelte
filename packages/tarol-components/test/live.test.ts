// DataTable under live updates (frontend-ease.md §B, 5c): rows that move or go away under a keyboard user.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { List } from '@clorat/tarol-svelte';
import { expectAccessible } from './axe.js';
import { fakeClient, type Row } from './fake.js';
import LiveTable from './fixtures/LiveTable.svelte';

let app: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (app) await unmount(app);
  document.body.innerHTML = '';
});

async function focused(): Promise<List<Row>> {
  let l!: List<Row>;
  app = mount(LiveTable, {
    target: document.body,
    props: { client: fakeClient(5).client, expose: (x: List<Row>) => (l = x) },
  });
  flushSync();
  await expect.element(page.getByRole('gridcell', { name: 'Auction 1' })).toBeInTheDocument();
  document.querySelector<HTMLElement>('tbody tr:nth-child(2) td')?.focus(); // Auction 1
  await userEvent.keyboard('{ArrowDown}'); // Auction 2
  expect(document.activeElement?.textContent).toBe('Auction 2');
  return l;
}
const text = (): string | undefined => document.activeElement?.textContent ?? undefined;

it('a live re-sort keeps focus on the same row, and the arrows go on from there', async () => {
  const l = await focused();
  l.patch((items) => [...items].reverse()); // other users' bids move Auction 2: 4 3 2 1 0
  await expect.poll(text).toBe('Auction 2');
  expect(document.activeElement?.closest('tr')?.getAttribute('aria-rowindex')).toBe('4');
  await userEvent.keyboard('{ArrowDown}');
  expect(text()).toBe('Auction 1'); // the row after Auction 2 in the new order
  await expectAccessible();
});

it('an update in place keeps focus', async () => {
  const l = await focused();
  l.patch((items) => items.map((r) => (r.id === 'r2' ? { ...r, bids: r.bids + 1 } : r)));
  flushSync();
  expect(text()).toBe('Auction 2');
});

it('when the focused row goes away, focus stays in the grid at the same place', async () => {
  const l = await focused();
  l.patch((items) => items.filter((r) => r.id !== 'r2'));
  await expect.poll(text).toBe('Auction 3');
});

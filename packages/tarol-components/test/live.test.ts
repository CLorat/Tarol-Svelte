// PROTOTYPE measurement (docs/review/frontend-ease.md, candidate 5): a row moved by a live update under the keyboard user.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { List } from '@clorat/tarol-svelte';
import { fakeClient, type Row } from './fake.js';
import LiveTable from './fixtures/LiveTable.svelte';

let app: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (app) await unmount(app);
  document.body.innerHTML = '';
});

it.fails('keyboard focus after a live re-sort (today: lost to <body>): ArrowDown goes on from the focused row', async () => {
  const f = fakeClient(5);
  let l!: List<Row>;
  app = mount(LiveTable, { target: document.body, props: { client: f.client, expose: (x: List<Row>) => (l = x) } });
  flushSync();
  await expect.element(page.getByRole('gridcell', { name: 'Auction 1' })).toBeInTheDocument();
  (document.querySelector('tbody tr:nth-child(2) td') as HTMLElement).focus(); // Auction 1
  await userEvent.keyboard('{ArrowDown}'); // Auction 2
  expect(document.activeElement?.textContent).toBe('Auction 2');
  l.patch((items) => [...items].reverse()); // another user's bids move Auction 2 to the top: 4 3 2 1 0
  flushSync();
  const focused = document.activeElement?.textContent;
  await userEvent.keyboard('{ArrowDown}');
  console.log(`LIVE focused after re-sort: ${String(focused)}; after ArrowDown: ${String(document.activeElement?.textContent)}`);
  expect(document.activeElement?.textContent).toBe('Auction 1'); // the row after Auction 2 in the new order
});

it('keyboard focus after a live update in place (no reorder) stays', async () => {
  const f = fakeClient(5);
  let l!: List<Row>;
  app = mount(LiveTable, { target: document.body, props: { client: f.client, expose: (x: List<Row>) => (l = x) } });
  flushSync();
  await expect.element(page.getByRole('gridcell', { name: 'Auction 1' })).toBeInTheDocument();
  (document.querySelector('tbody tr:nth-child(2) td') as HTMLElement).focus();
  l.patch((items) => items.map((r) => (r.id === 'r1' ? { ...r, bids: r.bids + 1 } : r)));
  flushSync();
  console.log(`LIVE in place: ${String(document.activeElement?.textContent)}`);
  expect(document.activeElement?.textContent).toBe('Auction 1');
});

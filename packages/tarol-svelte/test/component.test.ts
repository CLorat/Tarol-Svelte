import { flushSync, mount, unmount } from 'svelte';
import { expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { fakeClient, okResult } from './fakes.js';
import Root from './Root.svelte';

it('a component under setTarol lists, pages and refilters through the context client', async () => {
  const f = fakeClient((_, o) => {
    const q = o?.query ?? {};
    if (q['settled']) return okResult({ items: [{ id: 's1' }], next: null });
    return okResult(
      q['after'] ? { items: [{ id: 'c' }], next: null } : { items: [{ id: 'a' }, { id: 'b' }], next: 'n1' },
    );
  });
  const app = mount(Root, { target: document.body, props: { client: f.client } });
  await expect.element(page.getByRole('listitem').nth(1)).toHaveTextContent('b');
  await page.getByRole('button', { name: 'more' }).click();
  await expect.element(page.getByRole('listitem').nth(2)).toHaveTextContent('c');
  await expect.element(page.getByRole('button', { name: 'more' })).not.toBeInTheDocument();
  await page.getByRole('checkbox', { name: 'settled' }).click();
  flushSync();
  await expect.poll(() => [...document.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['s1']);
  expect(f.reads.at(-1)?.options?.query).toEqual({ settled: true, limit: 2 });
  await unmount(app);
});

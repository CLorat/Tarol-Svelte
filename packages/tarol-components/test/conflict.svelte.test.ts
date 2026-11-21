// PROTOTYPE measurement (candidate 5): the notice when a field changes on the server under the user.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@clorat/tarol-design/tokens.css';
import { expectAccessible } from './axe.js';
import { fakeClient } from './fake.js';
import EditForm from './fixtures/EditForm.svelte';

let app: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (app) await unmount(app);
  document.body.innerHTML = '';
});

it('keeps the input and focus, announces the change politely, passes axe; layout shift measured', async () => {
  const server = $state({ v: { title: 'Vase' }, version: 3 });
  app = mount(EditForm, { target: document.body, props: { client: fakeClient(1).client, server } });
  flushSync();
  const input = page.getByRole('textbox', { name: 'Title' });
  await input.fill('Blue vase');
  await new Promise((r) => setTimeout(r, 600)); // past the 500 ms in which CLS ignores shifts after input
  let shift = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
      if (!e.hadRecentInput) shift += e.value;
  }).observe({ type: 'layout-shift' });
  server.v = { title: 'Green vase' };
  server.version = 4;
  flushSync();
  await expect.element(page.getByRole('status').filter({ hasText: 'Green vase' })).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 200));
  console.log(`CONFLICT layout shift: ${shift.toFixed(4)}; focus on input: ${String(document.activeElement === input.element())}`);
  await expect.element(input).toHaveValue('Blue vase');
  await expectAccessible();
  await userEvent.click(page.getByRole('button', { name: 'Use the new value' }));
  await expect.element(input).toHaveValue('Green vase');
});

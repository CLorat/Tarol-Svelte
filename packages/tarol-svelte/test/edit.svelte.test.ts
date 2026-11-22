// changeForm(…, { from }) (SV-26): an edit form under a live view.
import { flushSync } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { changeForm } from '../src/index.js';
import { fakeClient, okResult } from './fakes.js';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
interface Input {
  title: string;
  reserve: number;
}
interface View extends Input {
  id: string;
  bids: number;
}

function edit(server: { v: View | undefined; version: number | undefined }) {
  const f = fakeClient(() => okResult(undefined));
  let form!: ReturnType<typeof changeForm<Input>>;
  cleanup = $effect.root(() => {
    form = changeForm<Input>(
      (i) => ({ method: 'PUT', path: '/a', body: i }),
      { title: '', reserve: 0 },
      {
        client: f.client,
        from: () => server.v,
        expectedVersion: () => server.version,
      },
    );
  });
  flushSync();
  return { f, form: () => form };
}

it('takes the view once it is loaded, reading only the input’s own fields', () => {
  const server = $state<{ v: View | undefined; version: number | undefined }>({ v: undefined, version: undefined });
  const { form } = edit(server);
  expect(form().values).toEqual({ title: '', reserve: 0 });
  server.v = { id: 'a', bids: 2, title: 'Vase', reserve: 100 };
  server.version = 3;
  flushSync();
  expect(form().values).toEqual({ title: 'Vase', reserve: 100 });
});

it('keeps the user input, reports the conflict, and submits the version the edit started from', async () => {
  const server = $state<{ v: View | undefined; version: number | undefined }>({
    v: { id: 'a', bids: 0, title: 'Vase', reserve: 100 },
    version: 3,
  });
  const { f, form } = edit(server);
  form().values.title = 'Blue vase'; // the user edits the title
  server.v = { id: 'a', bids: 0, title: 'Green vase', reserve: 120 }; // another user changed both
  server.version = 4;
  flushSync();
  expect(form().values).toEqual({ title: 'Blue vase', reserve: 120 }); // the untouched field followed
  expect(form().conflict('title')).toEqual({ theirs: 'Green vase' });
  expect(form().conflict('reserve')).toBeUndefined();
  await form().submit();
  expect(f.changes.at(-1)?.options?.expectedVersion).toBe(3); // a 409 then, never a silent overwrite
  form().resolve('title', 'mine');
  expect(form().conflict('title')).toBeUndefined();
  await form().submit();
  expect(f.changes.at(-1)?.options?.expectedVersion).toBe(4);
});

it('"theirs" takes the server value; a change the server already has is no conflict', async () => {
  const server = $state<{ v: View | undefined; version: number | undefined }>({
    v: { id: 'a', bids: 0, title: 'Vase', reserve: 100 },
    version: 3,
  });
  const { f, form } = edit(server);
  form().values.title = 'Blue vase';
  server.v = { id: 'a', bids: 1, title: 'Green vase', reserve: 100 };
  server.version = 4;
  flushSync();
  form().resolve('title', 'theirs');
  expect(form().values.title).toBe('Green vase');
  // the user's own save comes back through the live view: no conflict, and the next submit uses the new version
  form().values.title = 'Red vase';
  await form().submit();
  server.v = { id: 'a', bids: 1, title: 'Red vase', reserve: 100 };
  server.version = 5;
  flushSync();
  expect(form().conflict('title')).toBeUndefined();
  form().values.reserve = 150;
  await form().submit();
  expect(f.changes.at(-1)?.options?.expectedVersion).toBe(5);
});

it('reset drops the conflicts', () => {
  const server = $state<{ v: View | undefined; version: number | undefined }>({
    v: { id: 'a', bids: 0, title: 'Vase', reserve: 100 },
    version: 3,
  });
  const { form } = edit(server);
  form().values.title = 'Blue vase';
  server.v = { id: 'a', bids: 0, title: 'Green vase', reserve: 100 };
  flushSync();
  expect(form().conflict('title')).toBeDefined();
  form().reset();
  expect(form().conflict('title')).toBeUndefined();
});

it('without from, the expected version is read at submit (unchanged behaviour)', async () => {
  const f = fakeClient(() => okResult(undefined));
  const server = $state({ version: 3 });
  let form!: ReturnType<typeof changeForm<Input>>;
  cleanup = $effect.root(() => {
    form = changeForm<Input>(
      (i) => ({ method: 'PUT', path: '/a', body: i }),
      { title: 'Vase', reserve: 100 },
      {
        client: f.client,
        expectedVersion: () => server.version,
      },
    );
  });
  server.version = 4;
  await form.submit();
  expect(f.changes.at(-1)?.options?.expectedVersion).toBe(4);
});

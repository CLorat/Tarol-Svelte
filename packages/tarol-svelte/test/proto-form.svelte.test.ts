// PROTOTYPE measurement (candidate 5): an edit form under a live view.
import { flushSync } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { changeForm } from '../src/index.js';
import { fakeClient, okResult } from './fakes.js';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
type V = { title: string; reserve: number };

it('keeps the user input, reports the conflict, and submits the version the edit started from', async () => {
  const f = fakeClient(() => okResult(undefined));
  const server = $state<{ v: V; version: number }>({ v: { title: 'Vase', reserve: 100 }, version: 3 });
  let form!: ReturnType<typeof changeForm<V>>;
  cleanup = $effect.root(() => {
    form = changeForm<V>((i) => ({ method: 'PUT', path: '/a', body: i }), { title: '', reserve: 0 }, {
      client: f.client,
      from: () => server.v,
      expectedVersion: () => server.version,
    });
  });
  flushSync();
  expect(form.values).toEqual({ title: 'Vase', reserve: 100 });
  form.values.title = 'Blue vase'; // the user edits the title
  server.v = { title: 'Green vase', reserve: 120 }; // another user changed both
  server.version = 4;
  flushSync();
  expect(form.values).toEqual({ title: 'Blue vase', reserve: 120 }); // untouched field followed the server
  expect(form.conflict('title')).toEqual({ theirs: 'Green vase' });
  await form.submit();
  expect(f.changes.at(-1)?.options?.expectedVersion).toBe(3); // a 409 then, never a silent overwrite
  form.resolve('title', 'mine');
  await form.submit();
  expect(f.changes.at(-1)?.options?.expectedVersion).toBe(4);
});

it('today (no from): the expected version is read at submit, so an old edit overwrites silently', async () => {
  const f = fakeClient(() => okResult(undefined));
  const server = $state({ version: 3 });
  let form!: ReturnType<typeof changeForm<V>>;
  cleanup = $effect.root(() => {
    form = changeForm<V>((i) => ({ method: 'PUT', path: '/a', body: i }), { title: 'Vase', reserve: 100 }, {
      client: f.client,
      expectedVersion: () => server.version,
    });
  });
  form.values.title = 'Blue vase';
  server.version = 4; // the live view revalidated after someone else's change
  await form.submit();
  expect(f.changes.at(-1)?.options?.expectedVersion).toBe(4);
});

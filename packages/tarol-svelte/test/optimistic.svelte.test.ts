import type { ChangeRequest, Result } from '@clorat/tarol-client';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { changeForm, list, query } from '../src/index.js';
import { fakeClient, okResult } from './fakes.js';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});
function root<T>(f: () => T): T {
  let out!: T;
  cleanup = $effect.root(() => {
    out = f();
  });
  flushSync();
  return out;
}
const settle = () => new Promise((r) => setTimeout(r, 0));

interface Auction {
  id: string;
  highest: number;
}

const conflict: Result<unknown> = {
  ok: false,
  status: 409,
  violation: { kind: 'error', code: 'Stream.VersionConflict' },
};
const bid = (input: { amount: number }): ChangeRequest => ({ method: 'POST', path: '/auctions/a/bids', body: input });

function setup(server: { highest: number }) {
  const f = fakeClient(() => okResult<Auction>({ id: 'a', highest: server.highest }, { version: 1 }));
  return root(() => {
    const view = query<Auction>(() => ({ path: '/auctions/a' }), { tarol: { client: f.client } });
    const form = changeForm(
      bid,
      { amount: 150 },
      {
        client: f.client,
        expectedVersion: () => view.version,
        optimistic: (input) => view.patch((a) => ({ ...a, highest: input.amount })),
      },
    );
    return { f, view, form };
  });
}

describe('optimistic changes', () => {
  it('shows the expected value before the backend answers, and keeps it on success', async () => {
    const server = { highest: 100 };
    const { f, view, form } = setup(server);
    await settle();
    expect(view.value?.highest).toBe(100);
    let release!: (r: Result<unknown>) => void;
    f.answerChanges(() => okResult(undefined));
    const original = f.client.change.bind(f.client);
    f.client.change = <T>(r: ChangeRequest) =>
      new Promise<Result<T>>((res) => {
        release = (x) => {
          server.highest = 150;
          void original(r).then(() => {
            res(x as Result<T>);
          });
        };
      });
    const sent = form.submit();
    flushSync();
    expect(view.value?.highest).toBe(150); // before the answer
    release(okResult(undefined));
    expect((await sent)?.ok).toBe(true);
    await settle();
    expect(view.value?.highest).toBe(150);
  });

  it('rolls back on 409 Stream.VersionConflict and reads again', async () => {
    const { f, view, form } = setup({ highest: 120 });
    await settle();
    f.answerChanges(() => conflict);
    const reads = f.reads.length;
    const r = await form.submit();
    expect(r?.ok).toBe(false);
    expect(form.formError).toEqual({ kind: 'error', code: 'Stream.VersionConflict' });
    expect(view.value?.highest).toBe(120);
    await settle();
    expect(f.reads.length).toBeGreaterThan(reads); // revalidated after the rollback
  });

  it('rolls back on a field error too', async () => {
    const { f, view, form } = setup({ highest: 100 });
    await settle();
    f.answerChanges(() => ({ ok: false, status: 400, violation: { kind: 'invalid', errors: { amount: ['Range'] } } }));
    await form.submit();
    expect(view.value?.highest).toBe(100);
    expect(form.error('amount')).toBe('Range');
  });

  it('rolls back when the change throws (aborted)', async () => {
    const { f, view, form } = setup({ highest: 100 });
    await settle();
    f.client.change = () => Promise.reject(new DOMException('aborted', 'AbortError'));
    await expect(form.submit()).rejects.toThrow('aborted');
    expect(view.value?.highest).toBe(100);
    expect(form.pending).toBe(false);
  });

  it('a read that arrived meanwhile wins over the rollback', async () => {
    const server = { highest: 1 };
    const f = fakeClient(() => okResult<Auction>({ id: 'a', highest: server.highest }));
    const view = root(() => query<Auction>(() => ({ path: '/auctions/a' }), { tarol: { client: f.client } }));
    await settle();
    const rollback = view.patch((a) => ({ ...a, highest: 2 }));
    expect(view.value?.highest).toBe(2);
    server.highest = 3; // someone else bid meanwhile
    await view.refresh();
    expect(view.value?.highest).toBe(3);
    rollback();
    expect(view.value?.highest).toBe(3);
  });

  it('without a value there is nothing to patch', () => {
    const f = fakeClient(() => new Promise<Result<unknown>>(() => undefined));
    const view = root(() => query<Auction>(() => ({ path: '/auctions/a' }), { tarol: { client: f.client } }));
    const rollback = view.patch((a) => ({ ...a, highest: 2 }));
    expect(view.value).toBeUndefined();
    rollback();
    expect(view.value).toBeUndefined();
  });

  it('patches a list and restores its rows on rollback', async () => {
    const f = fakeClient(() => okResult({ items: [{ id: 'a' }, { id: 'b' }], next: null }));
    const rows = root(() => list<{ id: string }>(() => ({ path: '/auctions' }), { tarol: { client: f.client } }));
    await settle();
    const rollback = rows.patch((items) => items.filter((i) => i.id !== 'a'));
    expect(rows.items.map((i) => i.id)).toEqual(['b']);
    rollback();
    expect(rows.items.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

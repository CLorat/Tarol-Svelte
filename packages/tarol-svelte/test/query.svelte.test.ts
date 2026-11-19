import type { Page } from '@clorat/tarol-client';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { list, query } from '../src/index.js';
import { fakeClient, fakePush, okResult } from './fakes.js';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

/** Runs rune code inside an effect root, as a component's initialisation would. */
function root<T>(f: () => T): T {
  let out!: T;
  cleanup = $effect.root(() => {
    out = f();
  });
  flushSync();
  return out;
}

describe('query', () => {
  it('reads on creation and exposes value, version and loading', async () => {
    const f = fakeClient(() => okResult({ id: 'a' }, { version: 3 }));
    const q = root(() => query<{ id: string }>(() => ({ path: '/auctions/a' }), { tarol: { client: f.client } }));
    expect(q.loading).toBe(true);
    await expect.poll(() => q.value).toEqual({ id: 'a' });
    expect(q.version).toBe(3);
    expect(q.loading).toBe(false);
    expect(f.reads.map((r) => r.path)).toEqual(['/auctions/a']);
  });

  it('reads again when the request reads changed $state, and aborts the previous read', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const f = fakeClient(async (path) => {
      if (path === '/x/1') await gate;
      return okResult(path);
    });
    const state = $state({ id: 1 });
    const q = root(() => query<string>(() => ({ path: `/x/${String(state.id)}` }), { tarol: { client: f.client } }));
    state.id = 2;
    flushSync();
    await expect.poll(() => q.value).toBe('/x/2');
    release();
    await Promise.resolve();
    expect(q.value).toBe('/x/2'); // the slow first answer does not overwrite the newer one
    expect(f.reads[0]?.options?.signal?.aborted).toBe(true);
  });

  it('reads nothing while the request is null', () => {
    const f = fakeClient(() => okResult(1));
    root(() => query(() => null, { tarol: { client: f.client } }));
    expect(f.reads).toHaveLength(0);
  });

  it('keeps the value and exposes the violation when a revalidation fails', async () => {
    let fail = false;
    const f = fakeClient(() =>
      fail ? { ok: false, status: 403, violation: { kind: 'error', code: 'Auth.Forbidden' } } : okResult(7),
    );
    const q = root(() => query<number>(() => ({ path: '/v' }), { tarol: { client: f.client } }));
    await expect.poll(() => q.value).toBe(7);
    fail = true;
    await q.refresh();
    expect(q.value).toBe(7);
    expect(q.violation).toEqual({ kind: 'error', code: 'Auth.Forbidden' });
  });

  it('revalidates on window focus and after an own change, and stops after destroy', async () => {
    const f = fakeClient(() => okResult(1));
    root(() => query(() => ({ path: '/v' }), { tarol: { client: f.client } }));
    await expect.poll(() => f.reads.length).toBe(1);
    window.dispatchEvent(new FocusEvent('focus'));
    await expect.poll(() => f.reads.length).toBe(2);
    await f.client.change({ method: 'POST', path: '/x' });
    await expect.poll(() => f.reads.length).toBe(3);
    cleanup?.();
    cleanup = undefined;
    window.dispatchEvent(new FocusEvent('focus'));
    await f.client.change({ method: 'POST', path: '/x' });
    expect(f.reads.length).toBe(3);
  });

  it('can opt out of focus and change revalidation', async () => {
    const f = fakeClient(() => okResult(1));
    root(() =>
      query(() => ({ path: '/v' }), {
        tarol: { client: f.client },
        revalidateOnFocus: false,
        revalidateOnChange: false,
      }),
    );
    await expect.poll(() => f.reads.length).toBe(1);
    window.dispatchEvent(new FocusEvent('focus'));
    await f.client.change({ method: 'POST', path: '/x' });
    expect(f.reads.length).toBe(1);
  });

  it('revalidates on every message of a live topic and after a push reconnect', async () => {
    const f = fakeClient(() => okResult(1));
    const p = fakePush();
    root(() =>
      query(() => ({ path: '/v' }), { tarol: { client: f.client, push: p.push }, live: 'artflow.bid-placed' }),
    );
    await expect.poll(() => f.reads.length).toBe(1);
    p.emit('artflow.bid-placed', {});
    await expect.poll(() => f.reads.length).toBe(2);
    p.reconnect();
    await expect.poll(() => f.reads.length).toBe(3);
  });
});

describe('list', () => {
  const pages: Record<string, Page<number>> = {
    first: { items: [1, 2], next: 'c1', total: 3 },
    c1: { items: [3], next: null },
  };

  it('loads the first page, appends the next with after, and ends', async () => {
    const f = fakeClient((_, o) => okResult(pages[(o?.query?.['after'] as string | undefined) ?? 'first']));
    const l = root(() =>
      list<number>(() => ({ path: '/auctions', query: { limit: 2, count: true } }), { tarol: { client: f.client } }),
    );
    await expect.poll(() => l.items).toEqual([1, 2]);
    expect(l.total).toBe(3);
    expect(l.hasMore).toBe(true);
    await l.more();
    expect(l.items).toEqual([1, 2, 3]);
    expect(l.hasMore).toBe(false);
    expect(f.reads[1]?.options?.query).toEqual({ limit: 2, count: true, after: 'c1' });
    await l.more(); // nothing more to load
    expect(f.reads).toHaveLength(2);
  });

  it('starts from the first page again when a filter changes', async () => {
    const f = fakeClient((_, o) =>
      okResult(o?.query?.['after'] ? pages['c1'] : { items: [o?.query?.['settled'] ? 9 : 1], next: 'c1' }),
    );
    const filter = $state({ settled: false });
    const l = root(() =>
      list<number>(() => ({ path: '/auctions', query: { settled: filter.settled } }), { tarol: { client: f.client } }),
    );
    await expect.poll(() => l.items).toEqual([1]);
    await l.more();
    expect(l.items).toEqual([1, 3]);
    filter.settled = true;
    flushSync();
    await expect.poll(() => l.items).toEqual([9]);
  });
});

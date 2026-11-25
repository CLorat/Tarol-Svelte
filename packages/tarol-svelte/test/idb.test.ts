// The IndexedDB adapter of @clorat/tarol-client/idb needs a browser; it is tested here, in this package's Chromium
// project (tarol-client's own tests run in Node).
import { createClient } from '@clorat/tarol-client';
import { idbStore } from '@clorat/tarol-client/idb';
import { createOutbox } from '@clorat/tarol-client/outbox';
import { describe, expect, it } from 'vitest';

describe('idbStore (TS-26, TS-27)', () => {
  it('keeps records per scope across a new store on the same database, and clears one scope', async () => {
    const name = `tarol-test-${crypto.randomUUID()}`;
    const a = idbStore(name);
    await a.put('outbox', { key: 'k1', scope: 't1/anna' });
    await a.put('outbox', { key: 'k2', scope: 't1/ben' });
    await a.put('reads', { key: 't1/anna /x', scope: 't1/anna' });
    const b = idbStore(name); // as after a reload
    expect(await b.list('outbox', 't1/anna')).toEqual([{ key: 'k1', scope: 't1/anna' }]);
    expect(await b.get('reads', 't1/anna /x')).toEqual({ key: 't1/anna /x', scope: 't1/anna' });
    await b.clear('outbox', 't1/anna');
    expect(await b.list('outbox', 't1/anna')).toEqual([]);
    expect(await b.list('outbox', 't1/ben')).toHaveLength(1);
    await b.delete('outbox', 'k2');
    expect(await b.list('outbox', 't1/ben')).toEqual([]);
  });

  it('an outbox entry with its request survives in IndexedDB while offline', async () => {
    const store = idbStore(`tarol-test-${crypto.randomUUID()}`);
    const client = createClient({
      baseUrl: 'http://api',
      fetch: () => Promise.reject(new TypeError('offline')),
      retries: 0,
    });
    const outbox = createOutbox({ client, store, scope: () => 't1/anna', online: () => false, flushOnOnline: false });
    expect(
      (await outbox.submit({ method: 'POST', path: '/notes', body: { text: 'a' } }, { label: 'note' })).state,
    ).toBe('queued');
    const [saved] = await store.list<{ key: string; scope: string; request: unknown }>('outbox', 't1/anna');
    expect(saved?.request).toEqual({ method: 'POST', path: '/notes', body: { text: 'a' } });
    outbox.dispose();
  });
});

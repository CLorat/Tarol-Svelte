import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, type ChangeRequest } from '../src/index.js';
import { createOutbox, memoryStore, offlineReads, type OfflineStore } from '../src/outbox.js';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** A fake backend with a switchable network: answers the queued replies in order and records every request. */
function backend() {
  const calls: Call[] = [];
  const replies: Response[] = [];
  let offline = false;
  const fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
      method: init?.method ?? 'GET',
      headers: { ...(init?.headers as Record<string, string>) },
      body: init?.body as string | undefined,
    });
    if (offline) return Promise.reject(new TypeError('Failed to fetch'));
    const r = replies.shift();
    return r ? Promise.resolve(r) : Promise.reject(new Error('no reply queued'));
  });
  return {
    calls,
    fetch: fetch as unknown as typeof globalThis.fetch,
    reply: (...r: Response[]) => replies.push(...r),
    set offline(value: boolean) {
      offline = value;
    },
  };
}
const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'content-type': type },
  });
const problem = (status: number, body: object) => json(status, body, 'application/problem+json');

const note: ChangeRequest<{ id: string }> = { method: 'POST', path: '/notes', body: { text: 'Slept 1 h' } };
const clock = () => new Date('2026-12-01T07:42:00Z');

let disposers: (() => void)[] = [];
afterEach(() => {
  for (const d of disposers) d();
  disposers = [];
  vi.useRealTimers();
});

function setup(
  o: {
    online?: () => boolean;
    store?: OfflineStore;
    captureHeaders?: boolean;
    scope?: string;
    device?: string | null;
  } = {},
) {
  const b = backend();
  const client = createClient({ baseUrl: 'http://api', fetch: b.fetch, retries: 0 });
  const store = o.store ?? memoryStore();
  const outbox = createOutbox({
    client,
    store,
    scope: () => o.scope ?? 't1/anna',
    ...(o.device === null ? {} : { device: o.device ?? 'tablet-3' }),
    now: clock,
    delays: [1000],
    ...(o.online ? { online: o.online } : {}),
    ...(o.captureHeaders === undefined ? {} : { captureHeaders: o.captureHeaders }),
  });
  disposers.push(() => {
    outbox.dispose();
  });
  return { b, client, store, outbox };
}

describe('outbox (TS-26, Tatalu FB-F17.3-1, FB-F05.1-3)', () => {
  it('sends at once when online and gives the first answer; nothing stays in the store', async () => {
    const { b, store, outbox } = setup();
    b.reply(json(201, { id: 'n1', version: 1 }));
    const r = await outbox.submit(note, { label: 'outbox.note' });
    expect(r.state).toBe('sent');
    expect(r.result?.ok && r.result.value).toEqual({ id: 'n1', version: 1 });
    expect(outbox.entries).toEqual([]);
    expect(await store.list('outbox', 't1/anna')).toEqual([]);
    expect(outbox.lastSync).toBe('2026-12-01T07:42:00.000Z');
  });

  it('stores before sending, keeps one idempotency key across attempts and restarts, and sends in capture order', async () => {
    let online = false;
    const store = memoryStore();
    const first = setup({ online: () => online, store });
    const a = await first.outbox.submit(note, { label: 'outbox.note' });
    const b2 = await first.outbox.submit({ ...note, body: { text: 'Ate well' } });
    expect([a.state, b2.state]).toEqual(['queued', 'queued']);
    expect(first.b.calls).toEqual([]); // offline: not even attempted
    const keys = first.outbox.entries.map((e) => e.key);
    first.outbox.dispose();

    // a restart: a new outbox over the same store finds both, in order
    online = true;
    const second = setup({ online: () => online, store });
    await second.outbox.ready();
    expect(second.outbox.entries.map((e) => e.key)).toEqual(keys);
    second.b.offline = true;
    await second.outbox.flush();
    expect(second.outbox.pending).toBe(2);
    expect(second.outbox.entries[0]?.attempts).toBe(1);
    second.b.offline = false;
    second.b.reply(json(204, undefined), json(204, undefined));
    await second.outbox.flush();
    expect(second.outbox.pending).toBe(0);
    const sent = second.b.calls.map((c) => [c.headers['idempotency-key'], JSON.parse(c.body ?? '{}') as unknown]);
    expect(sent).toEqual([
      [keys[0], { text: 'Slept 1 h' }], // the failed attempt
      [keys[0], { text: 'Slept 1 h' }],
      [keys[1], { text: 'Ate well' }],
    ]);
  });

  it('keeps a refusal as failed with the whole violation (detail and reasons) until retry or discard', async () => {
    const { b, outbox } = setup();
    b.reply(
      problem(409, {
        title: 'Allergy',
        status: 409,
        code: 'DailyLog.AllergyWarning',
        detail: 'peanut',
        reasons: ['Allergen.Peanut'],
        traceId: 'req-7',
      }),
    );
    const r = await outbox.submit(note);
    expect(r.state).toBe('failed');
    const [entry] = outbox.failed;
    expect(entry?.violation).toEqual({
      kind: 'error',
      code: 'DailyLog.AllergyWarning',
      detail: 'peanut',
      reasons: ['Allergen.Peanut'],
    });
    expect([entry?.status, entry?.requestId]).toEqual([409, 'req-7']);
    expect(outbox.pending).toBe(0);
    b.reply(json(204, undefined));
    await outbox.retry(entry?.key ?? '');
    expect(outbox.entries).toEqual([]);
    expect(b.calls.map((c) => c.headers['idempotency-key'])).toEqual([entry?.key, entry?.key]);
  });

  it('keeps a warning to confirm as failed; confirm(key) resends it with Tarol-Confirm and the same key (TS-33)', async () => {
    const { b, outbox } = setup();
    b.reply(
      problem(409, {
        code: 'DailyLog.AllergyWarning',
        confirm: { code: 'DailyLog.AllergyWarning', args: { allergen: 'peanut' } },
      }),
    );
    expect((await outbox.submit(note)).state).toBe('failed');
    const [entry] = outbox.failed;
    expect(entry?.violation).toMatchObject({
      confirm: { code: 'DailyLog.AllergyWarning', args: { allergen: 'peanut' } },
    });
    b.reply(json(204, undefined));
    await outbox.confirm(entry?.key ?? '');
    expect(outbox.entries).toEqual([]);
    expect(b.calls.map((c) => [c.headers['idempotency-key'], c.headers['tarol-confirm']])).toEqual([
      [entry?.key, undefined],
      [entry?.key, 'DailyLog.AllergyWarning'],
    ]);
  });

  it('pauses on 401 until a flush after sign-in, and retries a transient failure after its delay', async () => {
    vi.useFakeTimers();
    const { b, outbox } = setup();
    b.reply(json(401, undefined));
    expect((await outbox.submit(note)).state).toBe('queued');
    expect(outbox.needsSignIn).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.calls).toHaveLength(1); // no timer while sign-in is needed
    b.reply(json(503, undefined), json(204, undefined));
    await outbox.flush();
    expect(outbox.needsSignIn).toBe(false);
    expect(outbox.pending).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(outbox.pending).toBe(0);
    expect(b.calls).toHaveLength(3);
  });

  it('sends Tarol-Device and Tarol-Captured-At when a device is set, unless captureHeaders is false (C-3, Tarol-Net TN-60)', async () => {
    const off = setup({ captureHeaders: false });
    off.b.reply(json(204, undefined));
    await off.outbox.submit(note);
    expect(Object.keys(off.b.calls[0]?.headers ?? {})).not.toContain('tarol-device');
    const none = setup({ device: null });
    none.b.reply(json(204, undefined));
    await none.outbox.submit(note);
    expect(Object.keys(none.b.calls[0]?.headers ?? {})).not.toContain('tarol-captured-at');
    const on = setup();
    on.b.reply(json(204, undefined));
    await on.outbox.submit(note);
    expect(on.b.calls[0]?.headers).toMatchObject({
      'tarol-device': 'tablet-3',
      'tarol-captured-at': '2026-12-01T07:42:00.000Z',
    });
  });

  it('keeps entries per scope and clears the scope (sign-out)', async () => {
    const store = memoryStore();
    const anna = setup({ store, online: () => false });
    await anna.outbox.submit(note);
    const ben = setup({ store, online: () => false, scope: 't1/ben' });
    await ben.outbox.ready();
    expect(ben.outbox.entries).toEqual([]);
    await anna.outbox.clear();
    expect(await store.list('outbox', 't1/anna')).toEqual([]);
  });

  it('extra change headers never replace the client’s own', async () => {
    const { b, client } = setup();
    b.reply(json(204, undefined));
    await client.change(note, { key: 'k1', headers: { 'Idempotency-Key': 'evil', 'X-Trace': 'a' } });
    expect(b.calls[0]?.headers).toMatchObject({ 'idempotency-key': 'k1', 'x-trace': 'a' });
  });
});

describe('offline reads (TS-27, Tatalu FB-F17.3-5)', () => {
  it('keeps chosen paths and answers from them offline with savedAt; other paths are not kept', async () => {
    const b = backend();
    const store = memoryStore();
    const reads = offlineReads({
      store,
      scope: () => 't1/anna',
      keep: (p) => p.startsWith('/children/'),
      fetch: b.fetch,
      now: clock,
    });
    const client = createClient({ baseUrl: 'http://api', fetch: reads.fetch, retries: 0 });
    b.reply(
      new Response(JSON.stringify({ name: 'Mia' }), {
        status: 200,
        headers: { 'content-type': 'application/json', etag: '"3"' },
      }),
    );
    b.reply(json(200, { items: [], next: null }));
    expect((await client.read('/children/c1/card')).ok).toBe(true);
    expect((await client.read('/notes')).ok).toBe(true);
    expect((await reads.saved()).map((s) => s.path)).toEqual(['/children/c1/card']);

    b.offline = true;
    const fresh = createClient({ baseUrl: 'http://api', fetch: reads.fetch, retries: 0 });
    const r = await fresh.read<{ name: string }>('/children/c1/card');
    expect(r.ok && [r.value, r.version]).toEqual([{ name: 'Mia' }, 3]);
    expect(reads.savedAt('/children/c1/card')).toBe('2026-12-01T07:42:00.000Z');
    const n = await fresh.read('/notes');
    expect(!n.ok && n.violation).toMatchObject({ code: 'Network' });

    b.offline = false;
    b.reply(json(200, { name: 'Mia' }));
    await fresh.read('/children/c1/card');
    expect(reads.savedAt('/children/c1/card')).toBeNull();
    await reads.clear();
    expect(await reads.saved()).toEqual([]);
  });
});

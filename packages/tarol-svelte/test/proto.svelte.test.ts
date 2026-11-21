// PROTOTYPE measurements for docs/review/frontend-ease.md: requests per pushed message.
import type { PushedMessage } from '@clorat/tarol-client/push';
import { flushSync } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { list, query, type QueryOptions } from '../src/index.js';
import { fakeClient, fakePush, okResult } from './fakes.js';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
const tick = () => new Promise((r) => setTimeout(r, 0));
const A = '01a1ffbf-64d1-7386-9add-dd64e748f7fc';
const B = '01a1ffbf-0000-7000-8000-000000000000';
type View = { id: string; bids: number };

function setup(options: (push: ReturnType<typeof fakePush>['push']) => Partial<QueryOptions>, delay = 0) {
  let version = 3;
  const f = fakeClient(async () => {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    return okResult<View>({ id: A, bids: version - 1 }, { version });
  });
  const p = fakePush();
  const send = (m: Partial<PushedMessage>) => {
    for (const h of p.handlers.get('artflow.bid-placed') ?? [])
      h({ topic: 'artflow.bid-placed', id: '1', version: 1, subject: A, time: '', sender: 'artflow', data: { amount: 1 }, ...m });
  };
  let q!: ReturnType<typeof query<View>>;
  cleanup = $effect.root(() => {
    q = query<View>(() => ({ path: `/auctions/${A}`, subject: A }), {
      tarol: { client: f.client, push: p.push },
      revalidateOnFocus: false,
      ...options(p.push),
    });
  });
  flushSync();
  return { f, send, q, setVersion: (v: number) => (version = v) };
}

it('candidate 2: messages of other auctions read nothing', async () => {
  const s = setup(() => ({ live: { topic: 'artflow.bid-placed' } }));
  await tick();
  const before = s.f.reads.length;
  for (let i = 0; i < 10; i++) s.send({ subject: B });
  await tick();
  expect(s.f.reads.length - before).toBe(0);
  s.send({ subject: A });
  await tick();
  expect(s.f.reads.length - before).toBe(1);
});

it('candidate 2 off (subject: null): every message counts again, coalesced to 2 reads', async () => {
  const s = setup(() => ({ live: { topic: 'artflow.bid-placed', subject: null } }));
  await tick();
  const before = s.f.reads.length;
  for (let i = 0; i < 10; i++) s.send({ subject: B });
  await tick();
  expect(s.f.reads.length - before).toBe(2);
});

it('coalescing: a burst of 10 messages while a read is in flight makes 2 reads', async () => {
  const s = setup(() => ({ live: 'artflow.bid-placed' }), 5);
  await new Promise((r) => setTimeout(r, 20));
  const before = s.f.reads.length;
  for (let i = 0; i < 10; i++) s.send({});
  await new Promise((r) => setTimeout(r, 40));
  expect(s.f.reads.length - before).toBe(2);
});

it('BC-23: a message the cache already has (own change) reads nothing; the next revision is applied', async () => {
  const s = setup(() => ({
    live: { topic: 'artflow.bid-placed', apply: (v: View) => ({ ...v, bids: v.bids + 1 }) },
  }));
  await tick();
  expect(s.q.version).toBe(3);
  const before = s.f.reads.length;
  s.send({ revision: 3 });
  await tick();
  expect(s.f.reads.length - before).toBe(0);
  s.send({ revision: 4 });
  await tick();
  expect(s.f.reads.length - before).toBe(0);
  expect(s.q.value?.bids).toBe(3);
  expect(s.q.version).toBe(4);
  s.send({ revision: 4 }); // a duplicate delivery (at least once) is not applied twice
  await tick();
  expect(s.q.value?.bids).toBe(3);
  s.send({ revision: 7 }); // a gap: read again
  await tick();
  expect(s.f.reads.length - before).toBe(1);
});

it('without BC-23 (no revision) apply falls back to a read', async () => {
  const s = setup(() => ({ live: { topic: 'artflow.bid-placed', apply: (v: View) => ({ ...v, bids: v.bids + 1 }) } }));
  await tick();
  const before = s.f.reads.length;
  s.send({});
  await tick();
  expect(s.f.reads.length - before).toBe(1);
  expect(s.q.value?.bids).toBe(2);
});

it('BC-23: a list re-reads after the message position (Tarol-Read-After)', async () => {
  const f = fakeClient(() => okResult({ items: [], next: null }));
  const p = fakePush();
  cleanup = $effect.root(() => {
    list(() => ({ path: '/auctions' }), { tarol: { client: f.client, push: p.push }, live: 'artflow.bid-placed', revalidateOnFocus: false });
  });
  flushSync();
  await tick();
  for (const h of p.handlers.get('artflow.bid-placed') ?? [])
    h({ topic: 'artflow.bid-placed', id: '1', version: 1, subject: A, time: '', sender: 'a', data: {}, position: '1838.3' });
  await tick();
  expect(f.reads.at(-1)?.options?.readAfter).toBe('1838.3');
});

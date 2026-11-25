import type { ChangeRequest, Created } from '@clorat/tarol-client';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { action, query } from '../src/index.js';
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

const chooseMain = (input: { location: string }): ChangeRequest => ({
  method: 'POST',
  path: `/locations/${input.location}/main`,
});

describe('action (TS-15, Tatalu FB-F01.3-1)', () => {
  it('runs a change without a form: pending while it is sent, the violation and its code after a refusal', async () => {
    const f = fakeClient(() => okResult(1));
    f.answerChanges(() => ({
      ok: false,
      status: 409,
      requestId: 'r-9',
      violation: { kind: 'error', code: 'Location.Inactive' },
    }));
    const main = root(() => action(chooseMain, { client: f.client }));
    expect(main.pending).toBe(false);
    const running = main.run({ location: 'a' });
    expect(main.pending).toBe(true);
    const r = await running;
    expect(r?.ok).toBe(false);
    expect(main.pending).toBe(false);
    expect(main.violation).toEqual({ kind: 'error', code: 'Location.Inactive' });
    expect(main.code).toBe('Location.Inactive');
    expect(main.requestId).toBe('r-9');
    expect(f.changes[0]?.request.path).toBe('/locations/a/main');
  });

  it('gives the first field code of a 400, clears the violation on success, and keeps the key for a retry', async () => {
    const f = fakeClient(() => okResult(1));
    let answer = 0;
    f.answerChanges(() =>
      answer++ === 0
        ? {
            ok: false,
            status: 400,
            violation: { kind: 'invalid', errors: { until: ['Required'] }, details: { until: [{ code: 'Required' }] } },
          }
        : okResult(undefined),
    );
    let done = 0;
    const main = root(() => action(chooseMain, { client: f.client, onSuccess: () => (done += 1) }));
    await main.run({ location: 'a' });
    expect(main.code).toBe('Required');
    expect((await main.run({ location: 'a' }))?.ok).toBe(true);
    expect(main.violation).toBeUndefined();
    expect(main.code).toBeUndefined();
    expect(done).toBe(1);
    expect(f.changes[0]?.options?.key).toBe(f.changes[1]?.options?.key);
    await main.run({ location: 'b' });
    expect(f.changes[2]?.options?.key).not.toBe(f.changes[1]?.options?.key);
  });

  it('sends the expected version, ignores a second run while one is pending, and types the result', async () => {
    const f = fakeClient(() => okResult(1));
    const create = (input: { reserve: number }): ChangeRequest<Created> => ({
      method: 'POST',
      path: '/auctions',
      body: input,
    });
    const make = root(() => action(create, { client: f.client }));
    const first = make.run({ reserve: 1 }, { expectedVersion: 0 });
    expect(await make.run({ reserve: 1 })).toBeUndefined();
    await first;
    expect(f.changes).toHaveLength(1);
    expect(f.changes[0]?.options?.expectedVersion).toBe(0);
    const r = await make.run({ reserve: 2 });
    if (r?.ok) expectTypeOf(r.value).toEqualTypeOf<Created>();
  });

  it('with awaitRevalidation, resolves after the queries the change revalidates have read again', async () => {
    let release: (() => void) | undefined;
    let changed = false;
    const f = fakeClient(async () => {
      if (changed) await new Promise<void>((r) => (release = r));
      return okResult(changed ? 'new' : 'old');
    });
    f.answerChanges(() => ((changed = true), okResult(undefined)));
    const { view, main } = root(() => ({
      view: query<string>(() => ({ path: '/v' }), { tarol: { client: f.client } }),
      main: action(chooseMain, { client: f.client, awaitRevalidation: true }),
    }));
    await expect.poll(() => view.value).toBe('old');
    let done = false;
    const running = main.run({ location: 'a' }).then(() => (done = true));
    await expect.poll(() => release).toBeDefined();
    expect(done).toBe(false);
    release?.();
    await running;
    expect(view.value).toBe('new');
  });
});

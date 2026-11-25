import type { ChangeRequest } from '@clorat/tarol-client';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { allowNull, at, changeForm, query, type Rules } from '../src/index.js';
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

interface Order {
  customer: string;
  lines: { sku: string; quantity: number }[];
}

const placeOrder = (input: Order): ChangeRequest => ({ method: 'POST', path: '/orders', body: input });
const rules: Rules = {
  customer: [{ rule: 'NotEmpty', code: 'Required' }],
  'lines[].quantity': [{ rule: 'Range', code: 'Range', min: 1, max: 100 }],
};
const initial: Order = {
  customer: 'Ada',
  lines: [
    { sku: 'A', quantity: 1 },
    { sku: 'B', quantity: 2 },
  ],
};

describe('changeForm', () => {
  it('checks a field against its rule on touch, with the backend code', () => {
    const f = fakeClient(() => okResult(1));
    const form = root(() => changeForm(placeOrder, initial, { client: f.client, rules }));
    form.values.lines[1]!.quantity = 0;
    form.touch('lines[1].quantity');
    expect(form.errors).toEqual({ 'lines[1].quantity': ['Range'] });
    form.values.lines[1]!.quantity = 5;
    form.touch('lines[1].quantity');
    expect(form.errors).toEqual({});
  });

  it('does not send while a client rule fails', async () => {
    const f = fakeClient(() => okResult(1));
    const form = root(() => changeForm(placeOrder, initial, { client: f.client, rules }));
    form.values.customer = '  ';
    expect(await form.submit()).toBeUndefined();
    expect(form.error('customer')).toBe('Required');
    expect(f.changes).toHaveLength(0);
  });

  it('puts the server field errors on the field with the same path, and clears one when it is edited', async () => {
    const f = fakeClient(() => okResult(1));
    f.answerChanges(() => ({
      ok: false,
      status: 400,
      violation: {
        kind: 'invalid',
        errors: { 'lines[1].sku': ['Sku.Unknown'] },
        details: { 'lines[1].sku': [{ code: 'Sku.Unknown' }] },
      },
    }));
    const form = root(() => changeForm(placeOrder, initial, { client: f.client, rules }));
    await form.submit();
    expect(form.error('lines[1].sku')).toBe('Sku.Unknown');
    expect(form.formError).toBeUndefined();
    form.values.lines[1]!.sku = 'C';
    form.touch('lines[1].sku');
    expect(form.error('lines[1].sku')).toBeUndefined();
  });

  it('keeps the server detail of a field error and the request id of the failure', async () => {
    const f = fakeClient(() => okResult(1));
    f.answerChanges(() => ({
      ok: false,
      status: 400,
      requestId: 'r-1',
      violation: {
        kind: 'invalid',
        errors: { customer: ['Length'] },
        details: { customer: [{ code: 'Length', detail: '3..60' }] },
      },
    }));
    const form = root(() => changeForm(placeOrder, initial, { client: f.client }));
    await form.submit();
    expect(form.error('customer')).toBe('Length');
    expect(form.detail('customer')).toBe('3..60');
    expect(form.requestId).toBe('r-1');
    form.values.customer = 'Ada';
    form.touch('customer');
    expect(form.detail('customer')).toBeUndefined();
  });

  it('keeps the idempotency key for a retry of the same input and takes a new one for a new input', async () => {
    const f = fakeClient(() => okResult(1));
    f.answerChanges(() => ({ ok: false, status: 0, violation: { kind: 'error', code: 'Network' } }));
    const form = root(() => changeForm(placeOrder, initial, { client: f.client }));
    await form.submit();
    await form.submit();
    form.values.customer = 'Grace';
    await form.submit();
    const keys = f.changes.map((c) => c.options?.key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
    expect(f.changes[2]?.request.body).toEqual({ ...initial, customer: 'Grace' });
  });

  it('reports coded errors and paths no field shows as formError', async () => {
    const f = fakeClient(() => okResult(1));
    const form = root(() => changeForm(placeOrder, initial, { client: f.client }));
    f.answerChanges(() => ({ ok: false, status: 403, violation: { kind: 'error', code: 'Order.NotYours' } }));
    await form.submit();
    expect(form.formError).toEqual({ kind: 'error', code: 'Order.NotYours' });
    f.answerChanges(() => ({
      ok: false,
      status: 400,
      violation: {
        kind: 'invalid',
        errors: { '': ['Json'], customer: ['Length'] },
        details: { '': [{ code: 'Json' }], customer: [{ code: 'Length' }] },
      },
    }));
    await form.submit();
    expect(form.formError).toEqual({ kind: 'invalid', errors: { '': ['Json'] }, details: { '': [{ code: 'Json' }] } });
    expect(form.error('customer')).toBe('Length');
  });

  it('sends the expected version and calls onSuccess', async () => {
    const f = fakeClient(() => okResult(1));
    let done = 0;
    const form = root(() =>
      changeForm(placeOrder, initial, { client: f.client, expectedVersion: () => 4, onSuccess: () => (done += 1) }),
    );
    expect((await form.submit())?.ok).toBe(true);
    expect(f.changes[0]?.options?.expectedVersion).toBe(4);
    expect(done).toBe(1);
    expect(form.pending).toBe(false);
  });

  it('resets values and errors', async () => {
    const f = fakeClient(() => okResult(1));
    f.answerChanges(() => ({
      ok: false,
      status: 400,
      violation: { kind: 'invalid', errors: { customer: ['Length'] }, details: { customer: [{ code: 'Length' }] } },
    }));
    const form = root(() => changeForm(placeOrder, initial, { client: f.client }));
    form.values.customer = 'X';
    await form.submit();
    form.reset();
    expect(form.values.customer).toBe('Ada');
    expect(form.errors).toEqual({});
  });

  it('skips the rules of members of a nullable record while it is null (TS-9, Option<PostalAddress>)', async () => {
    interface Child {
      name: string;
      address: { street: string; city: string } | null;
    }
    const f = fakeClient(() => okResult(1));
    const register = (input: Child): ChangeRequest => ({ method: 'POST', path: '/children', body: input });
    const nested: Rules = {
      'address.street': [{ rule: 'Required', code: 'Required' }],
      'address.city': [{ rule: 'Required', code: 'Required' }],
    };
    const start: Child = { name: 'Mia', address: null };
    const form = root(() => changeForm(register, start, { client: f.client, rules: nested }));
    expect((await form.submit())?.ok).toBe(true);
    form.values.address = { street: '', city: 'Kiel' };
    expect(await form.submit()).toBeUndefined();
    expect(form.errors).toEqual({ 'address.street': ['Required'] });
  });

  it('reports a client rule error of a path no field shows as formError instead of blocking silently (TS-12)', async () => {
    interface AddGuardian {
      name: string;
      guardian?: string;
    }
    const f = fakeClient(() => okResult(1));
    const add = (input: AddGuardian): ChangeRequest => ({ method: 'POST', path: '/guardians', body: input });
    const guardianRules: Rules = {
      name: [{ rule: 'NotEmpty', code: 'Required' }],
      guardian: [{ rule: 'Required', code: 'Required' }],
    };
    const start: AddGuardian = { name: 'Ida' };
    const form = root(() => changeForm(add, start, { client: f.client, rules: guardianRules }));
    expect(await form.submit()).toBeUndefined();
    expect(f.changes).toHaveLength(0);
    expect(form.formError).toEqual({
      kind: 'invalid',
      errors: { guardian: ['Required'] },
      details: { guardian: [{ code: 'Required' }] },
    });
    // a field that shows the path (FormField registers it) takes the error, even before it has a value
    const off = form.register('guardian');
    expect(await form.submit()).toBeUndefined();
    expect(form.formError).toBeUndefined();
    expect(form.error('guardian')).toBe('Required');
    off();
    // a field bound to a value that exists (a hand-written input over '') keeps its error, as before
    form.values.guardian = '';
    form.values.name = '';
    expect(await form.submit()).toBeUndefined();
    expect(form.formError).toBeUndefined();
    expect(form.error('name')).toBe('Required');
  });

  it('with awaitRevalidation, resolves a successful submit after the queries its change revalidates (TS-14)', async () => {
    let value = '15:00';
    let release: (() => void) | undefined;
    const f = fakeClient(async () => {
      if (value !== '15:00') await new Promise<void>((r) => (release = r)); // the revalidation after the save is slow
      return okResult(value);
    });
    f.answerChanges((r) => {
      value = (r.body as { value: string }).value;
      return okResult(undefined);
    });
    const save = (input: { value: string }): ChangeRequest => ({ method: 'PUT', path: '/probe', body: input });
    const { view, form } = root(() => ({
      view: query<string>(() => ({ path: '/probe' }), { tarol: { client: f.client } }),
      form: changeForm(save, { value: '15:30' }, { client: f.client, awaitRevalidation: true }),
    }));
    await expect.poll(() => view.value).toBe('15:00');
    let done = false;
    const submitted = form.submit().then((r) => ((done = true), r));
    await expect.poll(() => release).toBeDefined();
    await Promise.resolve();
    expect(done).toBe(false); // "Saved" would show the old view: a second save would send the old value as last seen
    expect(form.pending).toBe(true);
    release?.();
    expect((await submitted)?.ok).toBe(true);
    expect(view.value).toBe('15:30');
    expect(form.pending).toBe(false);
  });

  it('keeps a draft in browser storage, restores it, and clears it on success (TS-20)', async () => {
    localStorage.removeItem('tarol.draft.order');
    const f = fakeClient(() => okResult(1));
    const first = root(() => changeForm(placeOrder, initial, { client: f.client, draft: 'order' }));
    first.values.customer = 'Grace';
    flushSync();
    expect(JSON.parse(localStorage.getItem('tarol.draft.order') ?? '{}')).toMatchObject({ customer: 'Grace' });
    cleanup?.(); // the form is closed
    const again = root(() => changeForm(placeOrder, initial, { client: f.client, draft: 'order' }));
    expect(again.values.customer).toBe('Grace');
    expect((await again.submit())?.ok).toBe(true);
    flushSync();
    expect(localStorage.getItem('tarol.draft.order')).toBeNull();
    again.values.customer = 'Ada Lovelace';
    flushSync();
    again.reset(); // discarding the input discards the draft
    flushSync();
    expect(localStorage.getItem('tarol.draft.order')).toBeNull();
  });

  it('works without a draft when the storage fails (private window, blocked storage) (TS-20)', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const f = fakeClient(() => okResult(1));
    const form = root(() =>
      changeForm(placeOrder, initial, { client: f.client, draft: { key: 'order', storage: broken } }),
    );
    form.values.customer = 'Grace';
    flushSync();
    expect(form.values.customer).toBe('Grace');
  });

  it('allowNull lets a required member be null until the user chooses; its Required rule stops the submit (TS-21)', async () => {
    interface OpenDayCare {
      name: string;
      state: 'HH' | 'SH';
      places: number;
    }
    const open = (input: OpenDayCare): ChangeRequest => ({ method: 'POST', path: '/daycares', body: input });
    const f = fakeClient(() => okResult(1));
    const form = root(() =>
      changeForm(
        allowNull(open),
        { name: 'Sonnenschein', state: null, places: null },
        { client: f.client, rules: { state: [{ rule: 'Required', code: 'Required' }] } },
      ),
    );
    expectTypeOf(form.values.state).toEqualTypeOf<'HH' | 'SH' | null>();
    expect(await form.submit()).toBeUndefined();
    expect(form.error('state')).toBe('Required');
    form.values.state = 'SH';
    form.values.places = 4;
    expect((await form.submit())?.ok).toBe(true);
    expect(f.changes[0]?.request.body).toEqual({ name: 'Sonnenschein', state: 'SH', places: 4 });
  });

  it('reads values at backend paths', () => {
    expect(at(initial, 'lines[1].quantity')).toBe(2);
    expect(at(initial, 'lines[5].quantity')).toBeUndefined();
    expect(at(initial, 'customer.name')).toBeUndefined();
  });
});

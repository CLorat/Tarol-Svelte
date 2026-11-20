import type { ChangeRequest } from '@clorat/tarol-client';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { at, changeForm, type Rules } from '../src/index.js';
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

  it('reads values at backend paths', () => {
    expect(at(initial, 'lines[1].quantity')).toBe(2);
    expect(at(initial, 'lines[5].quantity')).toBeUndefined();
    expect(at(initial, 'customer.name')).toBeUndefined();
  });
});

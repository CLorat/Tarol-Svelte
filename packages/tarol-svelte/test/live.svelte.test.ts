import { flushSync } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { live } from '../src/index.js';
import { fakePush } from './fakes.js';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe('live', () => {
  it('holds the latest message and counts them; a topic change moves the subscription', () => {
    const p = fakePush();
    const t = $state<{ topic: string | null }>({ topic: 'artflow.a' });
    let l!: ReturnType<typeof live<{ n: number }>>;
    cleanup = $effect.root(() => {
      l = live<{ n: number }>(() => t.topic, p.push);
    });
    flushSync();
    p.emit('artflow.a', { n: 1 });
    p.emit('artflow.a', { n: 2 });
    expect(l.message?.data).toEqual({ n: 2 });
    expect(l.count).toBe(2);
    t.topic = 'artflow.b';
    flushSync();
    p.emit('artflow.a', { n: 3 });
    expect(l.count).toBe(2);
    p.emit('artflow.b', { n: 4 });
    expect(l.message?.data).toEqual({ n: 4 });
    t.topic = null;
    flushSync();
    expect(p.handlers.get('artflow.b')?.size).toBe(0);
  });

  it('needs a push connection', () => {
    expect(() =>
      $effect.root(() => {
        live(() => 'artflow.a');
      }),
    ).toThrow(/setTarol|component/);
  });
});

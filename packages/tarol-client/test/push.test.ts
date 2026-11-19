import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { connectPush, isTopic, type PushOptions } from '../src/push.js';

const RS = '\u001e';

/** A WebSocket double that the test drives as the hub. */
class FakeSocket {
  static all: FakeSocket[] = [];
  sent: unknown[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
    queueMicrotask(() => this.onopen?.());
  }
  send(frame: string) {
    expect(frame.endsWith(RS)).toBe(true);
    this.sent.push(JSON.parse(frame.slice(0, -1)));
  }
  close() {
    this.closed = true;
  }
  /** The server sends frames. */
  push(...frames: object[]) {
    this.onmessage?.({ data: frames.map((f) => JSON.stringify(f) + RS).join('') });
  }
  /** The connection drops. */
  drop() {
    this.onclose?.();
  }
  invocations(target: string) {
    return this.sent.filter(
      (f): f is { invocationId: string; arguments: unknown[] } => (f as { target?: string }).target === target,
    );
  }
  /** Completes every invocation of a target, optionally with a hub error. */
  complete(target: string, error?: string) {
    for (const i of this.invocations(target))
      this.push({ type: 3, invocationId: i.invocationId, ...(error ? { error } : {}) });
  }
}

function last(): FakeSocket {
  const s = FakeSocket.all.at(-1);
  if (!s) throw new Error('no socket opened');
  return s;
}

let negotiate: Mock<typeof fetch>;

function connect(extra: Partial<PushOptions> = {}) {
  return connectPush({
    url: 'http://api/tarol/messages',
    tokens: { token: () => 'tok', tenant: () => 't1' },
    WebSocket: FakeSocket as unknown as typeof WebSocket,
    fetch: negotiate,
    random: () => 0.5, // no jitter
    ...extra,
  });
}

/** Lets the client's timers and promises run: the connect is a timer, then fetch and the socket's open are promises. */
async function settle(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  // the start chain (token, negotiate, json) is several promise hops; drain them so a timer it schedules is registered
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function handshake() {
  await settle();
  last().push({});
  await settle();
}

const message = (topic: string, data: unknown) => ({
  type: 1,
  target: 'message',
  arguments: [
    { topic, id: '1', version: 1, subject: null, time: '2026-11-19T00:00:00+00:00', sender: 'artflow', data },
  ],
});

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
  negotiate = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(JSON.stringify({ connectionToken: 'ct' }), { status: 200 })),
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe('push', () => {
  it('negotiates with the bearer token, opens the socket with the token in the query, and shakes hands', async () => {
    const p = connect();
    await settle();
    expect(negotiate).toHaveBeenCalledWith('http://api/tarol/messages/negotiate?negotiateVersion=1', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
    });
    expect(last().url).toBe('ws://api/tarol/messages?id=ct&access_token=tok');
    expect(last().sent[0]).toEqual({ protocol: 'json', version: 1 });
    expect(p.state).toBe('connecting');
    last().push({});
    expect(p.state).toBe('connected');
    p.close();
  });

  it('queues a subscription made before the connect and delivers messages to its handlers', async () => {
    const p = connect();
    const got: unknown[] = [];
    p.subscribe('artflow.bid-placed', (m) => got.push(m.data));
    await handshake();
    expect(
      last()
        .invocations('Subscribe')
        .map((i) => i.arguments),
    ).toEqual([['artflow.bid-placed']]);
    last().push(message('artflow.bid-placed', { amount: 150 }), message('artflow.other', 1));
    expect(got).toEqual([{ amount: 150 }]);
    p.close();
  });

  it('replays every subscription after a reconnect and tells the data layer to refetch', async () => {
    const p = connect();
    p.subscribe('artflow.a', () => undefined);
    p.subscribe('artflow.b', () => undefined);
    const reconnected = vi.fn();
    p.onReconnect(reconnected);
    await handshake();
    expect(reconnected).not.toHaveBeenCalled();
    last().drop();
    expect(p.state).toBe('reconnecting');
    await handshake(); // first delay is 0
    expect(FakeSocket.all).toHaveLength(2);
    expect(
      last()
        .invocations('Subscribe')
        .map((i) => i.arguments[0]),
    ).toEqual(['artflow.a', 'artflow.b']);
    expect(reconnected).toHaveBeenCalledTimes(1);
    p.close();
  });

  it('keeps restarting after timed-out negotiations, with growing delays (Tarol-Net #71)', async () => {
    negotiate.mockImplementation(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')));
    const p = connect();
    await settle(); // attempt 1 at 0 ms fails
    for (const d of [0, 1000, 2000, 5000, 10000, 10000, 10000]) {
      const before = negotiate.mock.calls.length;
      if (d > 0) {
        await settle(d - 1);
        expect(negotiate.mock.calls.length).toBe(before);
      }
      await settle(1); // the fake clock fires a 0 ms timer scheduled inside a tick only after 1 ms
      expect(negotiate.mock.calls.length).toBe(before + 1);
    }
    expect(p.state).toBe('connecting');
    negotiate.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ connectionToken: 'ct' }))));
    await settle(10000);
    last().push({});
    expect(p.state).toBe('connected');
    p.close();
  });

  it('restarts when the hub refuses the handshake or sends a close frame', async () => {
    const p = connect();
    await settle();
    last().push({ error: 'nope' });
    expect(last().closed).toBe(true);
    await handshake();
    expect(p.state).toBe('connected');
    last().push({ type: 7, error: 'Server shutting down', allowReconnect: true });
    expect(p.state).toBe('reconnecting');
    await handshake();
    expect(p.state).toBe('connected');
    expect(FakeSocket.all).toHaveLength(3);
    p.close();
  });

  it('drops the handlers of a refused subscription and reports the reason', async () => {
    const refused = vi.fn();
    const p = connect({ onRefused: refused });
    const handler = vi.fn();
    p.subscribe('billing.secret', handler);
    await handshake();
    last().complete('Subscribe', 'Forbidden: Subscribe billing.secret');
    await settle();
    expect(refused).toHaveBeenCalledWith('billing.secret', 'Forbidden: Subscribe billing.secret');
    last().push(message('billing.secret', 1));
    expect(handler).not.toHaveBeenCalled();
    p.close();
  });

  it('unsubscribes on the server when the last handler of a topic goes', async () => {
    const p = connect();
    await handshake();
    const off1 = p.subscribe('artflow.a', () => undefined);
    const off2 = p.subscribe('artflow.a', () => undefined);
    expect(last().invocations('Subscribe')).toHaveLength(1);
    off1();
    expect(last().invocations('Unsubscribe')).toHaveLength(0);
    off2();
    expect(
      last()
        .invocations('Unsubscribe')
        .map((i) => i.arguments),
    ).toEqual([['artflow.a']]);
    p.close();
  });

  it('isolates a failing handler from the others', async () => {
    const errors: unknown[] = [];
    const p = connect({ onError: (e) => errors.push(e) });
    const good = vi.fn();
    p.subscribe('artflow.a', () => {
      throw new Error('boom');
    });
    p.subscribe('artflow.a', good);
    await handshake();
    last().push(message('artflow.a', 1));
    expect(good).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    p.close();
  });

  it('publishes and resolves with the hub refusal, or null', async () => {
    const p = connect();
    await handshake();
    const accepted = p.publish('artflow.chat', { text: 'hi' });
    last().complete('Publish');
    expect(await accepted).toBeNull();
    expect(last().invocations('Publish')[0]?.arguments).toEqual(['artflow.chat', { text: 'hi' }]);
    p.close();
    expect(await p.publish('artflow.chat', 1)).toBe('Disconnected');
  });

  it('pings every 15 s and reconnects after 30 s of silence', async () => {
    const p = connect();
    await handshake();
    const s = last();
    await settle(15_000);
    expect(s.sent.filter((f) => (f as { type?: number }).type === 6)).toHaveLength(1);
    await settle(15_000);
    expect(s.closed).toBe(true);
    expect(p.state).toBe('reconnecting');
    p.close();
  });

  it('stops for good on close()', async () => {
    const p = connect();
    await handshake();
    p.close();
    expect(p.state).toBe('closed');
    await settle(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('validates topic names before sending', () => {
    expect(isTopic('artflow.bid-placed')).toBe(true);
    expect(isTopic('noprefix')).toBe(false);
    expect(isTopic('a.b c')).toBe(false);
    expect(isTopic('a/b.c')).toBe(false);
    expect(isTopic('a.' + 'x'.repeat(199))).toBe(false);
    const p = connect();
    expect(() => p.subscribe('bad', () => undefined)).toThrow(TypeError);
    p.close();
  });
});

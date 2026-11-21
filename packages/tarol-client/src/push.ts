import type { TokenProvider } from './client.js';

/** A message from the backend's UI push hub (`PushedMessage` in `Tarol.Messaging.SignalR`). */
export interface PushedMessage<T = unknown> {
  /** The topic, `<system>.<name>`. */
  readonly topic: string;
  /** The event id for a forwarded message, a new UUIDv7 for a published one. */
  readonly id: string;
  /** The contract version. */
  readonly version: number;
  /** The stream id for a forwarded message, else `null`. */
  readonly subject: string | null;
  /** ISO 8601 with offset. */
  readonly time: string;
  /** The source system, or the publishing user's `sub` (stamped by the server). */
  readonly sender: string;
  /** The contract's JSON payload. */
  readonly data: T;
}

/** The connection state. */
export type PushState = 'connecting' | 'connected' | 'reconnecting' | 'closed';

/** Settings of {@link connectPush}. */
export interface PushOptions {
  /** The hub URL, e.g. `/api/tarol/messages`. */
  readonly url: string;
  /** Supplies the token for every connect attempt (a fresh one each time). */
  readonly tokens?: TokenProvider;
  /** Defaults to `globalThis.WebSocket` / `globalThis.fetch`, taken at call time. */
  readonly WebSocket?: typeof WebSocket;
  /** Used for the negotiate request. */
  readonly fetch?: typeof fetch;
  /** Reconnect delays in ms; the last one repeats forever. Default `[0, 1000, 2000, 5000, 10000]`, each ±20 %. */
  readonly delays?: readonly number[];
  /** Random source for the jitter; tests pass a constant. */
  readonly random?: () => number;
  /** A refused subscription, e.g. `{ code: 'Hub.Forbidden', detail: 'Subscribe billing.secret' }`. */
  readonly onRefused?: (topic: string, refusal: HubRefusal) => void;
  /** A handler threw; the other handlers still run. Default: the browser's `reportError`, when there is one. */
  readonly onError?: (error: unknown) => void;
}

/** A live connection to the hub. Reconnects forever until {@link PushClient.close}. */
export interface PushClient {
  /** Subscribes a handler; the subscription survives reconnects. Returns the unsubscribe. */
  subscribe<T = unknown>(topic: string, handler: (message: PushedMessage<T>) => void): () => void;
  /** Publishes to a client topic; resolves with the hub's refusal, or `null` when accepted. */
  publish(topic: string, data: unknown): Promise<HubRefusal | null>;
  /** Called after every reconnect (not the first connect): the server has no replay, so refetch state over HTTP. */
  onReconnect(listener: () => void): () => void;
  /** Called on every state change. Returns the unsubscribe. */
  onState(listener: (state: PushState) => void): () => void;
  /** The current state. */
  readonly state: PushState;
  /** Ends the connection and the restart loop for good. */
  close(): void;
}

/**
 * A refusal of the hub: `HubException` messages are `<code>: <detail>`, and SignalR may wrap them in its own text.
 * Codes: `Hub.Forbidden` (the topic is not readable or writable for the user), `Hub.Topic` (not a topic name),
 * `Auth.Tenant` (no usable tenant claim); the client adds `Hub.Disconnected` (not connected, the call was not sent) and
 * `Hub.Error` (any other text). Codes are message ids like the HTTP codes (philosophy P7).
 */
export interface HubRefusal {
  /** The code, e.g. `Hub.Forbidden`. */
  readonly code: string;
  /** The text after `<code>: `, e.g. `Subscribe billing.secret`; for logs. */
  readonly detail: string;
  /** The whole text as received, SignalR's wrapper included. */
  readonly message: string;
}

const hubCodes = ['Hub.Forbidden', 'Hub.Topic', 'Auth.Tenant'];

/** Reads a hub error message as a {@link HubRefusal}: the first known `<code>: ` inside it, else `Hub.Error`. */
export function hubRefusal(message: string): HubRefusal {
  let best: { code: string; at: number } | undefined;
  for (const code of hubCodes) {
    const at = message.indexOf(`${code}: `);
    if (at >= 0 && (best === undefined || at < best.at)) best = { code, at };
  }
  if (!best) return { code: 'Hub.Error', detail: message, message };
  return { code: best.code, detail: message.slice(best.at + best.code.length + 2), message };
}

const disconnected: HubRefusal = { code: 'Hub.Disconnected', detail: '', message: '' };

const RS = '\u001e';
const topicRule = /^[^.\s/]+\.[^\s/]+$/;

/** `true` for a valid topic name: `<system>.<name>`, at most 200 characters, no whitespace or `/`. */
export function isTopic(topic: string): boolean {
  return topic.length <= 200 && topicRule.test(topic);
}

type Pending = (error: HubRefusal | null) => void;

/**
 * Connects to the UI push hub with the SignalR JSON protocol over WebSocket. Rules from Tarol-Net's
 * `MessagePushClient`: queued and replayed subscriptions, isolated handlers, and a restart loop that a timeout or a
 * network error never ends (Tarol-Net #71).
 */
export function connectPush(options: PushOptions): PushClient {
  const delays = options.delays ?? [0, 1000, 2000, 5000, 10000];
  const random = options.random ?? Math.random;
  const handlers = new Map<string, Set<(m: PushedMessage) => void>>();
  const reconnects = new Set<() => void>();
  const states = new Set<(s: PushState) => void>();
  const pending = new Map<string, Pending>();
  let socket: WebSocket | null = null;
  let state: PushState = 'connecting';
  let attempt = 0;
  let connectedOnce = false;
  let nextId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;

  // a function, so the check after an await is not narrowed away by the compiler
  const closed = (): boolean => state === 'closed';

  const setState = (s: PushState): void => {
    if (state === s) return;
    state = s;
    for (const l of states) l(s);
  };

  const send = (frame: object): void => {
    socket?.send(JSON.stringify(frame) + RS);
  };

  const invoke = (target: string, args: unknown[]): Promise<HubRefusal | null> =>
    new Promise((resolve) => {
      if (state !== 'connected' || !socket) {
        resolve(disconnected);
        return;
      }
      const id = String(++nextId);
      pending.set(id, resolve);
      send({ type: 1, invocationId: id, target, arguments: args });
    });

  const deliver = (msg: PushedMessage): void => {
    for (const h of handlers.get(msg.topic) ?? []) {
      try {
        h(msg);
      } catch (error) {
        // one failing handler must not stop the others (MessagePushClient.cs:231-246)
        (options.onError ?? (globalThis as { reportError?: (e: unknown) => void }).reportError)?.(error);
      }
    }
  };

  const subscribeOnServer = (topic: string): void => {
    void invoke('Subscribe', [topic]).then((error) => {
      // Hub.Disconnected is retried by the replay after the next connect; a hub refusal drops the handlers
      if (error !== null && error !== disconnected) {
        handlers.delete(topic);
        options.onRefused?.(topic, error);
      }
    });
  };

  const schedule = (): void => {
    if (state === 'closed') return;
    setState(connectedOnce ? 'reconnecting' : 'connecting');
    const d = delays[Math.min(attempt, delays.length - 1)] ?? 0;
    attempt++;
    timer = setTimeout(() => void start(), d * (0.8 + 0.4 * random()));
  };

  const drop = (): void => {
    clearInterval(ping);
    clearTimeout(idle);
    for (const p of pending.values()) p(disconnected);
    pending.clear();
    const s = socket;
    socket = null;
    if (s) {
      s.onclose = s.onmessage = s.onerror = null;
      s.close();
    }
  };

  const alive = (): void => {
    clearTimeout(idle);
    // the server pings every 15 s; 30 s of silence means the connection is gone (SignalR's default client timeout)
    idle = setTimeout(() => {
      drop();
      schedule();
    }, 30_000);
  };

  async function start(): Promise<void> {
    if (state === 'closed') return;
    try {
      const token = (await options.tokens?.token()) ?? null;
      const doFetch = options.fetch ?? globalThis.fetch;
      // `location` is absent outside a browser; the DOM types claim it always exists
      const base = new URL(options.url, (globalThis as { location?: Location }).location?.href);
      const n = await doFetch(`${base.href}/negotiate?negotiateVersion=1`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!n.ok) throw new Error(`negotiate ${String(n.status)}`);
      const { connectionToken } = (await n.json()) as { connectionToken: string };
      if (closed()) return;
      const ws = new URL(base.href);
      ws.protocol = ws.protocol === 'https:' ? 'wss:' : 'ws:';
      ws.searchParams.set('id', connectionToken);
      if (token) ws.searchParams.set('access_token', token);
      const Ws = options.WebSocket ?? globalThis.WebSocket;
      const s = new Ws(ws.href);
      socket = s;
      let shaken = false;
      s.onopen = () => {
        s.send(JSON.stringify({ protocol: 'json', version: 1 }) + RS);
      };
      s.onmessage = (e: MessageEvent) => {
        alive();
        for (const frame of String(e.data).split(RS)) {
          if (!frame) continue;
          const m = JSON.parse(frame) as {
            type?: number;
            error?: string;
            target?: string;
            arguments?: unknown[];
            invocationId?: string;
          };
          if (!shaken) {
            shaken = true;
            if (m.error) {
              drop();
              schedule();
              return;
            }
            attempt = 0;
            setState('connected');
            ping = setInterval(() => {
              send({ type: 6 });
            }, 15_000);
            for (const topic of handlers.keys()) subscribeOnServer(topic);
            if (connectedOnce) for (const l of reconnects) l();
            connectedOnce = true;
          } else if (m.type === 1 && m.target === 'message') {
            const msg = m.arguments?.[0] as PushedMessage | undefined;
            if (msg) deliver(msg);
          } else if (m.type === 3 && m.invocationId) {
            pending.get(m.invocationId)?.(m.error === undefined ? null : hubRefusal(m.error));
            pending.delete(m.invocationId);
          } else if (m.type === 7) {
            drop();
            schedule();
          }
        }
      };
      s.onclose = s.onerror = () => {
        drop();
        schedule();
      };
    } catch {
      // any failure, a timeout included, schedules the next attempt: only close() ends the loop (#71)
      drop();
      schedule();
    }
  }

  timer = setTimeout(() => void start(), 0);

  return {
    get state() {
      return state;
    },
    subscribe<T>(topic: string, handler: (m: PushedMessage<T>) => void) {
      if (!isTopic(topic)) throw new TypeError(`not a topic: ${topic} (<system>.<name>, at most 200 characters)`);
      let set = handlers.get(topic);
      const first = !set;
      if (!set) handlers.set(topic, (set = new Set()));
      const h = handler as (m: PushedMessage) => void;
      set.add(h);
      if (first && state === 'connected') subscribeOnServer(topic);
      return () => {
        const current = handlers.get(topic);
        if (!current?.delete(h) || current.size > 0) return;
        handlers.delete(topic);
        void invoke('Unsubscribe', [topic]);
      };
    },
    publish(topic, data) {
      if (!isTopic(topic)) throw new TypeError(`not a topic: ${topic}`);
      return invoke('Publish', [topic, data]);
    },
    onReconnect(listener) {
      reconnects.add(listener);
      return () => reconnects.delete(listener);
    },
    onState(listener) {
      states.add(listener);
      return () => states.delete(listener);
    },
    close() {
      setState('closed');
      clearTimeout(timer);
      drop();
    },
  };
}

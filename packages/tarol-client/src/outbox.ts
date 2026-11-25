import type { ChangeRequest, TarolClient } from './client.js';
import type { Failed, Ok, Result, Violation } from './result.js';

/** A table of an {@link OfflineStore}: the outbox's entries, or the saved reads. */
export type OfflineTable = 'outbox' | 'reads';

/** A stored record: its key, and the scope (`<tenant>/<person>`) it belongs to. */
export interface OfflineRecord {
  /** The record's key. */
  readonly key: string;
  /** The person's scope; records of another scope are never read. */
  readonly scope: string;
}

/**
 * Where the outbox and the offline reads keep their records: `idbStore()` from `@clorat/tarol-client/idb` in a browser,
 * {@link memoryStore} in tests. Values are stored as they are (structured clone), unencrypted: the app chooses the store.
 */
export interface OfflineStore {
  /** The records of a scope. */
  list<T extends OfflineRecord>(table: OfflineTable, scope: string): Promise<T[]>;
  /** One record by key. */
  get<T extends OfflineRecord>(table: OfflineTable, key: string): Promise<T | undefined>;
  /** Writes a record (replaces one with the same key). */
  put(table: OfflineTable, record: OfflineRecord): Promise<void>;
  /** Removes a record. */
  delete(table: OfflineTable, key: string): Promise<void>;
  /** Removes every record of a scope (sign-out, revoke). */
  clear(table: OfflineTable, scope: string): Promise<void>;
}

/** An {@link OfflineStore} in memory: for tests, and for a browser without IndexedDB (nothing survives a reload). */
export function memoryStore(): OfflineStore {
  const tables = new Map<OfflineTable, Map<string, OfflineRecord>>();
  const table = (t: OfflineTable): Map<string, OfflineRecord> => {
    let m = tables.get(t);
    if (!m) tables.set(t, (m = new Map<string, OfflineRecord>()));
    return m;
  };
  const copy = <T>(value: T): T => structuredClone(value);
  return {
    list: <T extends OfflineRecord>(t: OfflineTable, scope: string) =>
      Promise.resolve([...table(t).values()].filter((r) => r.scope === scope).map((r) => copy(r) as T)),
    get: <T extends OfflineRecord>(t: OfflineTable, key: string) => {
      const r = table(t).get(key);
      return Promise.resolve(r === undefined ? undefined : (copy(r) as T));
    },
    put: (t, record) => {
      table(t).set(record.key, copy(record));
      return Promise.resolve();
    },
    delete: (t, key) => {
      table(t).delete(key);
      return Promise.resolve();
    },
    clear: (t, scope) => {
      for (const [k, r] of table(t)) if (r.scope === scope) table(t).delete(k);
      return Promise.resolve();
    },
  };
}

/** A change waiting in the outbox. Its `key` is the idempotency key of every attempt. */
export interface OutboxEntry extends OfflineRecord {
  /** The app's description of the change (a message id, e.g. `outbox.note`). */
  readonly label: string;
  /** The change as captured. */
  readonly request: ChangeRequest<unknown>;
  /** When it was captured (RFC 3339). */
  readonly capturedAt: string;
  /** The capture order (entries are sent by it). */
  readonly sequence: number;
  /** `pending`: still to send; `failed`: refused, kept until the person retries or discards it. */
  readonly state: 'pending' | 'failed';
  /** The whole refusal of a `failed` entry: the code, `detail` and the problem's other members (`reasons` …). */
  readonly violation?: Violation;
  /** The HTTP status of the refusal. */
  readonly status?: number;
  /** The refusal's request id, for the person to quote. */
  readonly requestId?: string;
  /** Attempts so far. */
  readonly attempts: number;
  /** The warning codes the person confirmed for this entry (sent as `Tarol-Confirm`). */
  readonly confirmed?: readonly string[];
}

/** What {@link Outbox.submit} reached on its first attempt. */
export type Submitted<T> =
  | { readonly state: 'sent'; readonly result: Ok<T> }
  | { readonly state: 'queued'; readonly result: Failed | undefined }
  | { readonly state: 'failed'; readonly result: Failed };

/** Options of {@link createOutbox}. */
export interface OutboxOptions {
  /** The client the entries are sent with (its idempotency, token refresh and problem mapping). */
  readonly client: TarolClient;
  /** Where entries are kept: `idbStore()` from `@clorat/tarol-client/idb`, or {@link memoryStore}. */
  readonly store: OfflineStore;
  /** `<tenant>/<person>` of the signed-in (or last signed-in) person; `null` without a session (nothing is sent). */
  readonly scope: () => string | null;
  /** The app's id of this device (opaque). Only sent with `captureHeaders`. */
  readonly device?: string;
  /**
   * Sends `Tarol-Device` and `Tarol-Captured-At` with every attempt. Off by default: the backend accepts them only from
   * Tarol-Net TN-60 on (before that a cross-origin preflight refuses them).
   */
  readonly captureHeaders?: boolean;
  /** Waits between attempts after a transient failure (ms); the last repeats. Default 5, 15, 30, 60 s. */
  readonly delays?: readonly number[];
  /** Whether the device is online. Default `navigator.onLine` (true where it is not a boolean, as in Node). */
  readonly online?: () => boolean;
  /** The clock (tests). */
  readonly now?: () => Date;
  /** Flushes on the window's `online` event. Default `true` in a browser; {@link Outbox.dispose} removes the listener. */
  readonly flushOnOnline?: boolean;
}

/** The outbox of one app: changes are stored first, then sent in capture order with one idempotency key each. */
export interface Outbox {
  /** The entries of the current scope, oldest first. */
  readonly entries: readonly OutboxEntry[];
  /** Entries still to send. */
  readonly pending: number;
  /** Refused entries, waiting for a decision. */
  readonly failed: readonly OutboxEntry[];
  /** A send is running. */
  readonly syncing: boolean;
  /** The server answered 401: nothing is sent until the person signed in again and `flush()` runs. */
  readonly needsSignIn: boolean;
  /** When the last flush sent everything (RFC 3339), else `null`. */
  readonly lastSync: string | null;
  /** Resolves when the stored entries of the scope are loaded. */
  ready(): Promise<void>;
  /** Loads the entries of the current scope again (after a sign-in or a change of person). */
  load(): Promise<void>;
  /** Stores the change, then sends it when online; resolves with the first attempt's outcome. */
  submit<T>(request: ChangeRequest<T>, options?: { readonly label?: string }): Promise<Submitted<T>>;
  /** Sends the pending entries in order (one run at a time). */
  flush(): Promise<void>;
  /** Sends a refused entry again (same key: the server applies it at most once). */
  retry(key: string): Promise<void>;
  /**
   * Confirms the warning of a failed entry (its `violation.confirm`, Tarol-Net TN-37) and sends it again with
   * `Tarol-Confirm` (every code confirmed for it so far) and the same key; does nothing for an entry without a warning.
   */
  confirm(key: string): Promise<void>;
  /** Drops an entry on purpose. */
  discard(key: string): Promise<void>;
  /** Removes every entry of the current scope (sign-out, revoke). */
  clear(): Promise<void>;
  /** Called after every change of the entries or the state. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Stops the timers and the `online` listener. */
  dispose(): void;
}

/** A network failure, a server error or 429: try again later. */
const transient = (status: number): boolean => status === 0 || status === 429 || status >= 500;

/**
 * Creates the outbox (Tatalu FB-F17.3-1): a change is written to the store **before** it is sent, so a closed tab or a
 * restart loses nothing; every attempt sends the entry's key as `Idempotency-Key`; a transient failure keeps it and tries
 * again later; a refusal keeps it as `failed` with the whole violation; a 401 pauses until `flush()` after a sign-in.
 */
export function createOutbox(options: OutboxOptions): Outbox {
  const { client, store } = options;
  const now = options.now ?? (() => new Date());
  // only an explicit `false` is offline (Node 22 has a `navigator` without `onLine`)
  const online =
    options.online ??
    (() => (typeof navigator === 'undefined' ? true : (navigator.onLine as boolean | undefined) !== false));
  const delays = options.delays ?? [5_000, 15_000, 30_000, 60_000];
  const listeners = new Set<() => void>();
  let entries: OutboxEntry[] = [];
  let syncing = false;
  let needsSignIn = false;
  let lastSync: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let running: Promise<void> | null = null;
  /** The answer of each key's latest attempt, for `submit` to hand to the caller. */
  const answers = new Map<string, Result<unknown>>();

  const notify = (): void => {
    for (const l of listeners) l();
  };
  const set = (next: OutboxEntry[]): void => {
    entries = next;
    notify();
  };
  async function replace(key: string, update: (e: OutboxEntry) => OutboxEntry): Promise<void> {
    const current = entries.find((e) => e.key === key);
    if (!current) return;
    const next = update(current);
    await store.put('outbox', next);
    set(entries.map((e) => (e.key === key ? next : e)));
  }
  async function drop(key: string): Promise<void> {
    await store.delete('outbox', key);
    set(entries.filter((e) => e.key !== key));
  }

  async function load(): Promise<void> {
    const scope = options.scope();
    const list = scope ? await store.list<OutboxEntry>('outbox', scope) : [];
    set(list.sort((a, b) => a.sequence - b.sequence || a.capturedAt.localeCompare(b.capturedAt)));
  }
  let loaded = load();

  function schedule(): void {
    if (needsSignIn || entries.every((e) => e.state !== 'pending')) return;
    const delay = delays[Math.min(retries, delays.length - 1)] ?? 60_000;
    retries++;
    timer = setTimeout(() => void flush(), delay);
  }

  async function run(): Promise<void> {
    await loaded;
    clearTimeout(timer);
    const scope = options.scope();
    if (!scope || !online()) {
      if (scope) schedule();
      return;
    }
    syncing = true;
    needsSignIn = false; // a flush is the signal that the person signed in again; a new 401 sets it again
    notify();
    let interrupted = false;
    try {
      for (const entry of [...entries]) {
        if (entry.state !== 'pending') continue;
        const headers: Record<string, string> = {};
        if (options.captureHeaders) {
          headers['tarol-captured-at'] = entry.capturedAt;
          if (options.device !== undefined) headers['tarol-device'] = options.device;
        }
        if (entry.confirmed?.length) headers['tarol-confirm'] = entry.confirmed.join(', ');
        const r = await client.change(entry.request, { key: entry.key, headers });
        answers.set(entry.key, r);
        if (r.ok) {
          await drop(entry.key);
          continue;
        }
        if (r.status === 401) {
          needsSignIn = true;
          interrupted = true;
          break;
        }
        if (transient(r.status)) {
          await replace(entry.key, (e) => ({ ...e, attempts: e.attempts + 1 }));
          interrupted = true;
          break;
        }
        await replace(entry.key, (e) => ({
          ...e,
          state: 'failed',
          violation: r.violation,
          status: r.status,
          ...(r.requestId === undefined ? {} : { requestId: r.requestId }),
          attempts: e.attempts + 1,
        }));
      }
    } finally {
      syncing = false;
    }
    if (interrupted) {
      notify();
      schedule();
      return;
    }
    retries = 0;
    lastSync = now().toISOString();
    notify();
  }

  function flush(): Promise<void> {
    running ??= run().finally(() => {
      running = null;
    });
    return running;
  }

  const onOnline = (): void => {
    retries = 0;
    void flush();
  };
  const listen = (options.flushOnOnline ?? true) && typeof window !== 'undefined';
  if (listen) window.addEventListener('online', onOnline);

  return {
    get entries() {
      return entries;
    },
    get pending() {
      return entries.filter((e) => e.state === 'pending').length;
    },
    get failed() {
      return entries.filter((e) => e.state === 'failed');
    },
    get syncing() {
      return syncing;
    },
    get needsSignIn() {
      return needsSignIn;
    },
    get lastSync() {
      return lastSync;
    },
    ready: () => loaded,
    load() {
      loaded = load();
      return loaded;
    },
    async submit<T>(request: ChangeRequest<T>, o: { readonly label?: string } = {}): Promise<Submitted<T>> {
      await loaded;
      const scope = options.scope();
      if (!scope) throw new Error('outbox.submit needs a scope (a signed-in person)');
      const entry: OutboxEntry = {
        key: globalThis.crypto.randomUUID(),
        scope,
        label: o.label ?? '',
        request,
        capturedAt: now().toISOString(),
        sequence: Math.max(0, ...entries.map((e) => e.sequence)) + 1,
        state: 'pending',
        attempts: 0,
      };
      await store.put('outbox', entry);
      set([...entries, entry]);
      // one flush sends older pending entries first (capture order), then this one
      await flush();
      const answer = answers.get(entry.key) as Result<T> | undefined;
      answers.delete(entry.key);
      if (answer?.ok) return { state: 'sent', result: answer };
      const after = entries.find((e) => e.key === entry.key);
      if (after?.state === 'failed') return { state: 'failed', result: answer ?? failedOf(after) };
      return { state: 'queued', result: answer };
    },
    flush,
    async retry(key) {
      await replace(key, (e) => pendingAgain(e, e.confirmed));
      await flush();
    },
    async confirm(key) {
      const v = entries.find((e) => e.key === key)?.violation;
      const warning = v?.kind === 'error' ? v.confirm : undefined;
      if (!warning) return;
      await replace(key, (e) => pendingAgain(e, [...(e.confirmed ?? []), warning.code]));
      await flush();
    },
    discard: drop,
    async clear() {
      const scope = options.scope();
      if (scope) await store.clear('outbox', scope);
      set([]);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      clearTimeout(timer);
      if (listen) window.removeEventListener('online', onOnline);
      listeners.clear();
    },
  };
}

/** The entry pending again, without its refusal, with the confirmed warning codes. */
function pendingAgain(e: OutboxEntry, confirmed: readonly string[] | undefined): OutboxEntry {
  const { key, scope, label, request, capturedAt, sequence, attempts } = e;
  return {
    key,
    scope,
    label,
    request,
    capturedAt,
    sequence,
    attempts,
    state: 'pending',
    ...(confirmed === undefined ? {} : { confirmed }),
  };
}

/** The refusal of a failed entry as a {@link Failed}. */
function failedOf(e: OutboxEntry): Failed {
  return {
    ok: false,
    violation: e.violation ?? { kind: 'error', code: 'Conflict' },
    status: e.status ?? 0,
    ...(e.requestId === undefined ? {} : { requestId: e.requestId }),
  };
}

export { offlineReads } from './reads.js';
export type { OfflineReads, OfflineReadsOptions } from './reads.js';

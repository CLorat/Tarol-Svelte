import type { Page, QueryValue, Result, TarolClient, Violation } from '@clorat/tarol-client';
import type { PushClient, PushedMessage } from '@clorat/tarol-client/push';
import { getTarol } from './context.js';

/** A read as the generated client describes it: a path and its query-string parameters. */
export interface ReadRequest {
  /** The path below the client's base URL. */
  readonly path: string;
  /** Filters, `sort`, `limit` and the other query-string parameters. */
  readonly query?: Readonly<Record<string, QueryValue>>;
  /** The stream the read shows (the generated client sets it for a view by id): live messages of other streams are skipped. */
  readonly subject?: string;
}

/** A live topic with options (PROTOTYPE). */
export interface LiveTopic<V = never, T = never> {
  /** The topic, `<system>.<name>`. */
  readonly topic: string;
  /** Only messages of this stream (default: the request's `subject`, when it has one). `null`: every message. */
  readonly subject?: string | null;
  /** Applies a message to the cached value without a request; only when the message is the next revision (BC-23). */
  readonly apply?: (value: V, message: PushedMessage<T>) => V;
}

/** Settings of {@link query} and {@link list}. */
export interface QueryOptions {
  /** Push topics that make this query stale: it revalidates on every message and after every push reconnect. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PROTOTYPE
  readonly live?: string | LiveTopic<any, any> | readonly (string | LiveTopic<any, any>)[];
  /** Revalidate when the window gets focus again. Default `true`. */
  readonly revalidateOnFocus?: boolean;
  /** Revalidate after every change this client commits (cheap: ETag 304, `Tarol-Read-After`). Default `true`. */
  readonly revalidateOnChange?: boolean;
  /** The client and push connection, when not taken from {@link setTarol}'s context. */
  readonly tarol?: { readonly client: TarolClient; readonly push?: PushClient };
}

/** The reactive state of a view or any single read. */
export interface Query<T> {
  /** The last value read, kept while revalidating. */
  readonly value: T | undefined;
  /** `true` while a read is in flight. */
  readonly loading: boolean;
  /** The violation of the last read, if it failed. */
  readonly violation: Violation | undefined;
  /** The request id of the last failed read (`Tarol-Request-Id`), for "Reference: …" next to the error. */
  readonly requestId: string | undefined;
  /** The aggregate version from the view's ETag. */
  readonly version: number | undefined;
  /** `true` when a list answered before catching up with this client's own write (`Tarol-Stale`). */
  readonly stale: boolean;
  /** Reads again now (a 304 keeps the value). */
  refresh(): Promise<void>;
  /**
   * Shows `update(value)` at once, before the backend answered (an optimistic change, SV-6). Returns the rollback: it
   * restores the previous value unless a newer read replaced it meanwhile, then reads again. Without a value, nothing is
   * shown and the rollback only reads again.
   */
  patch(update: (value: T) => T): () => void;
}

/** The reactive state of a keyset-paged list. */
export interface List<T> {
  /** The rows of every page loaded so far. */
  readonly items: readonly T[];
  /** The number of all matching rows, when the request asked for it (`count: true`). */
  readonly total: number | undefined;
  /** `true` when there is a next page. */
  readonly hasMore: boolean;
  /** `true` while a page is being read. */
  readonly loading: boolean;
  /** The violation of the last read, if it failed. */
  readonly violation: Violation | undefined;
  /** The request id of the last failed read (`Tarol-Request-Id`), for "Reference: …" next to the error. */
  readonly requestId: string | undefined;
  /** `true` when the first page answered before catching up with this client's own write. */
  readonly stale: boolean;
  /** Loads the next page (keyset: the previous page's `next` as `after`). */
  more(): Promise<void>;
  /** Shows `update(items)` at once (an optimistic change); returns the rollback, as {@link Query.patch}. */
  patch(update: (items: readonly T[]) => readonly T[]): () => void;
  /** Reads the first page again and drops the pages after it. */
  refresh(): Promise<void>;
}

interface Source<T> {
  load(signal: AbortSignal, readAfter?: string): Promise<Result<T>>;
  readonly subject?: string | undefined;
}

/** What a message means for a query (PROTOTYPE): `skip` it, `read` again, or it was applied. */
type Verdict = 'skip' | 'read' | 'applied';

/** Runs the shared loop: re-read on argument change, focus, own change and push topic; abort the previous read. */
function track<T>(
  tarol: { readonly client: TarolClient; readonly push?: PushClient },
  source: () => Source<T> | null,
  options: QueryOptions,
  apply: (r: Result<T>) => void,
  setLoading: (v: boolean) => void,
  onMessage?: (spec: LiveTopic<never, never>, m: PushedMessage<never>) => Verdict,
): () => Promise<void> {
  let current: Source<T> | null = null;
  let controller: AbortController | undefined;
  let busy = false;
  let again: string | true | undefined;

  const run = async (readAfter?: string): Promise<void> => {
    const s = current;
    if (!s) return;
    controller?.abort();
    const c = (controller = new AbortController());
    setLoading(true);
    try {
      const r = await s.load(c.signal, readAfter);
      if (!c.signal.aborted) apply(r);
    } catch (error) {
      if (!c.signal.aborted) throw error;
    } finally {
      if (controller === c) setLoading(false);
    }
  };

  $effect(() => {
    current = source(); // reads the caller's $state: a filter change re-runs this effect
    void run();
    return () => controller?.abort();
  });

  $effect(() => {
    const offs: (() => void)[] = [];
    if (options.revalidateOnChange !== false) offs.push(tarol.client.onChange(() => void run()));
    if (options.revalidateOnFocus !== false) {
      const onFocus = (): void => void run();
      const onVisible = (): void => {
        if (document.visibilityState === 'visible') void run();
      };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisible);
      offs.push(() => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisible);
      });
    }
    const live = options.live;
    const specs = (live === undefined ? [] : Array.isArray(live) ? live : [live]).map((t: string | LiveTopic) =>
      typeof t === 'string' ? { topic: t } : t,
    ) as LiveTopic<never, never>[];
    // a burst of messages: one read in flight, at most one after it (not one per message)
    const coalesced = async (readAfter?: string): Promise<void> => {
      if (busy) {
        again = readAfter ?? true;
        return;
      }
      busy = true;
      try {
        await run(readAfter);
        while (again !== undefined) {
          const next = again;
          again = undefined;
          await run(next === true ? undefined : next);
        }
      } finally {
        busy = false;
      }
    };
    if (tarol.push && specs.length > 0) {
      for (const spec of specs)
        offs.push(
          tarol.push.subscribe<never>(spec.topic, (m) => {
            const subject = spec.subject === undefined ? current?.subject : spec.subject;
            if (subject != null && m.subject !== subject) return;
            const verdict = onMessage ? onMessage(spec, m) : 'read';
            if (verdict === 'read') void coalesced(m.position ?? undefined);
          }),
        );
      offs.push(tarol.push.onReconnect(() => void coalesced()));
    }
    return () => {
      for (const off of offs) off();
    };
  });

  return run;
}

/**
 * A reactive read of a view (or any single resource). Call it during component initialisation. `request` may read
 * `$state`; when it changes, the query reads again. Return `null` to read nothing (e.g. no id selected yet).
 */
export function query<T>(request: () => ReadRequest | null, options: QueryOptions = {}): Query<T> {
  const tarol = options.tarol ?? getTarol();
  let value = $state<T | undefined>();
  let loading = $state(false);
  let violation = $state<Violation | undefined>();
  let requestId = $state<string | undefined>();
  let version = $state<number | undefined>();
  let stale = $state(false);

  const refresh = track<T>(
    tarol,
    () => {
      const r = request();
      return r
        ? {
            subject: r.subject,
            load: (signal, readAfter) =>
              tarol.client.read<T>(r.path, { ...(r.query ? { query: r.query } : {}), signal, ...(readAfter ? { readAfter } : {}) }),
          }
        : null;
    },
    options,
    (r) => {
      if (r.ok) {
        value = r.value;
        version = r.version;
        stale = r.stale;
        violation = undefined;
        requestId = undefined;
      } else {
        violation = r.violation;
        requestId = r.requestId;
      }
    },
    (v) => (loading = v),
    (spec, m) => {
      // BC-23: without the event's revision a message cannot be ordered against the cache: read again
      if (m.revision == null || version === undefined) return 'read';
      if (m.revision <= version) return 'skip'; // the cache already has it (e.g. this client's own change)
      if (m.revision === version + 1 && spec.apply && value !== undefined) {
        value = (spec.apply as unknown as (v: T, m: PushedMessage<never>) => T)(value, m);
        version = m.revision;
        return 'applied';
      }
      return 'read';
    },
  );

  return {
    get value() {
      return value;
    },
    get loading() {
      return loading;
    },
    get violation() {
      return violation;
    },
    get requestId() {
      return requestId;
    },
    get version() {
      return version;
    },
    get stale() {
      return stale;
    },
    refresh,
    patch(update) {
      const before = value;
      if (before === undefined) return () => void refresh();
      const shown = (value = update(before));
      return () => {
        // a read that arrived meanwhile is newer than both: keep it
        if (value === shown) value = before;
        void refresh();
      };
    },
  };
}

/**
 * A reactive keyset-paged list. `request` may read `$state` (filters, sort); a change reads the first page again.
 * `more()` appends the next page.
 */
export function list<T>(request: () => ReadRequest | null, options: QueryOptions = {}): List<T> {
  const tarol = options.tarol ?? getTarol();
  let items = $state.raw<readonly T[]>([]);
  let next = $state<string | null>(null);
  let total = $state<number | undefined>();
  let loading = $state(false);
  let violation = $state<Violation | undefined>();
  let requestId = $state<string | undefined>();
  let stale = $state(false);
  let last: ReadRequest | null = null;

  const read = (r: ReadRequest, signal: AbortSignal, after?: string, readAfter?: string) =>
    tarol.client.read<Page<T>>(r.path, {
      query: after === undefined ? { ...r.query } : { ...r.query, after },
      signal,
      ...(readAfter ? { readAfter } : {}),
    });

  const refresh = track<Page<T>>(
    tarol,
    () => {
      const r = (last = request());
      return r ? { load: (signal, readAfter) => read(r, signal, undefined, readAfter) } : null;
    },
    options,
    (r) => {
      if (r.ok) {
        items = r.value.items;
        next = r.value.next;
        total = r.value.total;
        stale = r.stale;
        violation = undefined;
        requestId = undefined;
      } else {
        violation = r.violation;
        requestId = r.requestId;
      }
    },
    (v) => (loading = v),
  );

  return {
    get items() {
      return items;
    },
    get total() {
      return total;
    },
    get hasMore() {
      return next !== null;
    },
    get loading() {
      return loading;
    },
    get violation() {
      return violation;
    },
    get requestId() {
      return requestId;
    },
    get stale() {
      return stale;
    },
    refresh,
    patch(update) {
      const before = items;
      const shown = (items = update(before));
      return () => {
        if (items === shown) items = before;
        void refresh();
      };
    },
    async more() {
      const r = last;
      const after = next;
      if (!r || after === null || loading) return;
      loading = true;
      try {
        const page = await read(r, new AbortController().signal, after);
        if (r !== last) return; // the filters changed meanwhile
        if (page.ok) {
          items = [...items, ...page.value.items];
          next = page.value.next;
          violation = undefined;
          requestId = undefined;
        } else {
          violation = page.violation;
          requestId = page.requestId;
        }
      } finally {
        loading = false;
      }
    },
  };
}

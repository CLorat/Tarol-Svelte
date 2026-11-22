import {
  comparePositions,
  type Page,
  type QueryValue,
  type Result,
  type TarolClient,
  type Violation,
} from '@clorat/tarol-client';
import type { PushClient } from '@clorat/tarol-client/push';
import { getTarol } from './context.js';

/** A read as the generated client describes it: a path and its query-string parameters. */
export interface ReadRequest {
  /** The path below the client's base URL. */
  readonly path: string;
  /** Filters, `sort`, `limit` and the other query-string parameters. */
  readonly query?: Readonly<Record<string, QueryValue>>;
  /**
   * The id of the stream the read shows (the generated client sets it for a view by id). A live topic then revalidates
   * the query only for messages with this `subject`.
   */
  readonly subject?: string;
  /** The aggregate type of `subject` (e.g. `Auction`), from the id's `x-tarol-id`. */
  readonly stream?: string;
}

/**
 * A live topic with its subject filter, for {@link QueryOptions.live}. A generated `topics.<name>` (`Topic` of
 * `@clorat/tarol-client/push`) is one.
 */
export interface LiveTopic {
  /** The topic, `<system>.<name>`. */
  readonly topic: string;
  /**
   * The aggregate type the topic's messages are about. When it differs from the request's `stream`, the subject filter
   * is off by default: the messages' subject is another stream's id.
   */
  readonly stream?: string;
  /**
   * Revalidate only for messages of this stream id. Default: the request's `subject`, when it has one. `null`: every
   * message of the topic (e.g. a topic published from another stream than the one the query shows).
   */
  readonly subject?: string | null;
}

/** Settings of {@link query} and {@link list}. */
export interface QueryOptions {
  /**
   * Push topics that make this query stale: it revalidates on their messages and after every push reconnect. A query
   * whose request names a `subject` (a view by id) skips messages of other streams; a burst of messages makes one read
   * in flight and at most one after it.
   */
  readonly live?: string | LiveTopic | readonly (string | LiveTopic)[];
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
  readonly stream?: string | undefined;
  /** `true` when the value read already has this stream revision (a pushed message it need not read again for). */
  known?(revision: number): boolean;
}

/** Runs the shared loop: re-read on argument change, focus, own change and push topic; abort the previous read. */
function track<T>(
  tarol: { readonly client: TarolClient; readonly push?: PushClient },
  source: () => Source<T> | null,
  options: QueryOptions,
  apply: (r: Result<T>) => void,
  setLoading: (v: boolean) => void,
): () => Promise<void> {
  let current: Source<T> | null = null;
  let controller: AbortController | undefined;

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

  // pushed messages: one read in flight and at most one queued after it, never one read per message of a burst; the
  // queued read waits for the latest position of the messages it stands for (Tarol-Read-After, BC-23)
  let busy = false;
  let again = false;
  let after: string | undefined;
  // a function, so the check after an await is not narrowed away by the compiler (as push.ts `closed()`)
  const queued = (): boolean => again;
  const coalesced = async (position?: string): Promise<void> => {
    if (position && !(after && comparePositions(position, after) < 0)) after = position;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      do {
        again = false;
        const p = after;
        after = undefined;
        await run(p);
      } while (queued());
    } finally {
      busy = false;
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
    const topics: readonly (string | LiveTopic)[] =
      live === undefined
        ? []
        : typeof live === 'object' && 'topic' in live
          ? [live]
          : typeof live === 'string'
            ? [live]
            : live;
    if (tarol.push && topics.length > 0) {
      for (const t of topics) {
        const spec: LiveTopic = typeof t === 'string' ? { topic: t } : t;
        offs.push(
          tarol.push.subscribe(spec.topic, (m) => {
            const other = spec.stream !== undefined && current?.stream !== undefined && spec.stream !== current.stream;
            const subject = spec.subject === undefined ? (other ? null : current?.subject) : spec.subject;
            if (subject != null && m.subject !== subject) return;
            // the cache already has this revision (e.g. this client's own change): nothing to read (BC-23)
            if (subject != null && m.revision != null && current?.known?.(m.revision)) return;
            void coalesced(m.position ?? undefined);
          }),
        );
      }
      offs.push(tarol.push.onReconnect(() => void coalesced()));
    }
    return () => {
      for (const off of offs) off();
    };
  });

  return () => run();
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
            stream: r.stream,
            known: (revision) => version !== undefined && revision <= version,
            load: (signal, readAfter) =>
              tarol.client.read<T>(r.path, { ...(r.query ? { query: r.query } : {}), signal, readAfter }),
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
      readAfter,
    });

  const refresh = track<Page<T>>(
    tarol,
    () => {
      const r = (last = request());
      return r ? { subject: r.subject, load: (signal, readAfter) => read(r, signal, undefined, readAfter) } : null;
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

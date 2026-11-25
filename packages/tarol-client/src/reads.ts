import type { OfflineRecord, OfflineStore } from './outbox.js';

/** A read kept for offline use. */
interface SavedRead extends OfflineRecord {
  readonly path: string;
  readonly body: string;
  readonly etag: string | null;
  readonly savedAt: string;
}

/** Options of {@link offlineReads}. */
export interface OfflineReadsOptions {
  /** Where the reads are kept: `idbStore()` from `@clorat/tarol-client/idb`, or `memoryStore()`. */
  readonly store: OfflineStore;
  /** `<tenant>/<person>`; without a session nothing is kept or served. */
  readonly scope: () => string | null;
  /** Whether a path (with its query, without the base URL's origin) is kept for offline use: only what is needed. */
  readonly keep: (path: string) => boolean;
  /** The network `fetch`. Default `globalThis.fetch`, taken at call time. */
  readonly fetch?: typeof fetch;
  /** The clock (tests). */
  readonly now?: () => Date;
}

/** Offline reads: a `fetch` for `createClient({ fetch })` that keeps chosen views and answers from them offline. */
export interface OfflineReads {
  /**
   * The `fetch` to pass to `createClient`: a 200 of a kept path is stored; when the network fails, the stored answer is
   * returned (status 200 with its ETag), so the client's `read` gives an `Ok` with the stored value.
   */
  readonly fetch: typeof fetch;
  /** When the answer last served from the store for this path was saved (RFC 3339), or `null` when it came fresh. */
  savedAt(path: string): string | null;
  /** The kept paths of the current scope with their time. */
  saved(): Promise<readonly { readonly path: string; readonly savedAt: string }[]>;
  /** Removes every kept read of the current scope (sign-out, revoke). */
  clear(): Promise<void>;
  /** Called when `savedAt` of a path changes. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

const pathOf = (input: RequestInfo | URL): string => {
  const url = new URL(
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    'http://local',
  );
  return url.pathname + url.search;
};

/**
 * Creates the offline reads (Tatalu FB-F17.3-5): the app chooses the paths (`keep`), e.g. a child's emergency card and
 * today's list; read them ahead with `client.read` while online. Show "as of `savedAt(path)`" next to a stored answer.
 */
export function offlineReads(options: OfflineReadsOptions): OfflineReads {
  const served = new Map<string, string>();
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const l of listeners) l();
  };
  const now = options.now ?? (() => new Date());

  const wrapped: typeof fetch = async (input, init) => {
    const base = options.fetch ?? globalThis.fetch;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const path = pathOf(input);
    const scope = options.scope();
    if (method !== 'GET' || !scope || !options.keep(path)) return base(input, init);
    const key = `${scope} ${path}`;
    let response: Response;
    try {
      response = await base(input, init);
    } catch (error) {
      if (init?.signal?.aborted) throw error;
      const saved = await options.store.get<SavedRead>('reads', key);
      if (!saved) throw error;
      served.set(path, saved.savedAt);
      notify();
      const headers = new Headers({ 'content-type': 'application/json' });
      if (saved.etag) headers.set('etag', saved.etag);
      return new Response(saved.body, { status: 200, headers });
    }
    if (response.status === 200) {
      const record: SavedRead = {
        key,
        scope,
        path,
        body: await response.clone().text(),
        etag: response.headers.get('etag'),
        savedAt: now().toISOString(),
      };
      await options.store.put('reads', record);
    }
    if ((response.status === 200 || response.status === 304) && served.delete(path)) notify();
    return response;
  };

  return {
    fetch: wrapped,
    savedAt: (path) => served.get(path) ?? null,
    async saved() {
      const scope = options.scope();
      if (!scope) return [];
      return (await options.store.list<SavedRead>('reads', scope)).map((r) => ({ path: r.path, savedAt: r.savedAt }));
    },
    async clear() {
      const scope = options.scope();
      if (scope) await options.store.clear('reads', scope);
      served.clear();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

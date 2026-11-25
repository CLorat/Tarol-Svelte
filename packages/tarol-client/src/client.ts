import { comparePositions, isPosition } from './position.js';
import { fallbackCode, toViolation, type Failed, type Ok, type Result } from './result.js';

/**
 * The port through which the client gets credentials (philosophy P5: auth is handled once). `@clorat/tarol-oidc`
 * implements it; tests pass a fixed token.
 */
export interface TokenProvider {
  /** The current access token, or `null` when signed out. Called for every request. */
  token(): Promise<string | null> | string | null;
  /** The tenant the token belongs to; part of every cache key so two tenants never share an entry. */
  tenant(): string | null;
  /** Tries to get a new token after a 401; `true` when the request should be repeated once. */
  refresh?(): Promise<boolean>;
}

/** Settings of {@link createClient}. */
export interface ClientOptions {
  /** The backend's base URL, e.g. `/api` (same origin) or `https://api.example.com`. */
  readonly baseUrl: string;
  /** Supplies the access token and tenant; without it requests are anonymous. */
  readonly tokens?: TokenProvider;
  /** Defaults to `globalThis.fetch`, taken at call time. */
  readonly fetch?: typeof fetch;
  /** Entries kept by the ETag cache (least recently used are dropped). Default 200. */
  readonly cacheSize?: number;
  /** Repeats after a network failure, with the same idempotency key and body bytes. Default 2. */
  readonly retries?: number;
  /** Waits between repeats; tests inject a fake. Defaults to `setTimeout`. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * A change (a write) as the generated client describes it. `T` is the value a successful change returns: the generated
 * request of a creation is a `ChangeRequest<Created<…>>`, so `client.change(…)` and `changeForm(…)` infer it (type only,
 * nothing of it exists at run time).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- T is only carried for inference (TS-11)
export interface ChangeRequest<T = undefined> {
  /** The HTTP method the backend entry declares. */
  readonly method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The path below the base URL, with route values already encoded. */
  readonly path: string;
  /** The JSON body; omitted for a change without one. */
  readonly body?: unknown;
}

/** Per-call settings of a change. */
export interface ChangeOptions {
  /** The idempotency key of this user intent; pass the same key to retry the same intent. Default: a new UUID. */
  readonly key?: string;
  /** Sends `If-Match: "<version>"`; a stale version is answered with 409 `Stream.VersionConflict`. */
  readonly expectedVersion?: number;
  /** Aborts the request; an aborted call throws, as `fetch` does. */
  readonly signal?: AbortSignal;
}

/** A query-string value; `undefined` and `null` are left out. */
export type QueryValue = string | number | boolean | null | undefined;

/** Per-call settings of a read. */
export interface ReadOptions {
  /** Filters, `sort`, `limit`, `after`, `count`: the list's query-string parameters. */
  readonly query?: Readonly<Record<string, QueryValue>>;
  /** Aborts the request; an aborted call throws, as `fetch` does. */
  readonly signal?: AbortSignal;
  /**
   * Read after this `Tarol-Position` too (a pushed message's `position`), not only after this client's own changes: the
   * later of the two is sent as `Tarol-Read-After`. A value that is not a position is ignored.
   */
  readonly readAfter?: string | undefined;
}

/** What a creation returns: the new aggregate's id and version 1. */
export interface Created<I extends string = string> {
  /** The new aggregate's id (a UUIDv7). */
  readonly id: I;
  /** Always 1 for a new aggregate. */
  readonly version: number;
}

/** A keyset page of a list (`{items, next, total?}`); pass `next` as `after` to get the following page. */
export interface Page<T> {
  /** The rows of this page, in the query's sort order. */
  readonly items: readonly T[];
  /** The cursor of the next page, or `null` on the last page. */
  readonly next: string | null;
  /** The number of all matching rows, when the query asked for it (`count: true`). */
  readonly total?: number;
}

/** A change the client committed, as reported to {@link TarolClient.onChange} listeners. */
export interface ChangeEvent {
  /** The change's HTTP method. */
  readonly method: string;
  /** The change's path below the base URL. */
  readonly path: string;
  /** The commit's `Tarol-Position`, when the answer carried one. */
  readonly position?: string;
}

/** The framework-free Tarol client. */
export interface TarolClient {
  /** Runs a change: idempotency key, `If-Match`, problem mapping, retry on network failure. */
  change<T = undefined>(request: ChangeRequest<T>, options?: ChangeOptions): Promise<Result<T>>;
  /** Reads a view or a list: ETag revalidation (304 reuses the cache), `Tarol-Read-After` after own changes. */
  read<T>(path: string, options?: ReadOptions): Promise<Result<T>>;
  /** The full URL of a path and query, as the client sends it. */
  url(path: string, query?: Readonly<Record<string, QueryValue>>): string;
  /** Drops cached reads whose path starts with the prefix (all when omitted). */
  invalidate(prefix?: string): void;
  /** Called after every committed change; the Svelte layer revalidates queries with it. Returns the unsubscribe. */
  onChange(listener: (event: ChangeEvent) => void): () => void;
  /** The latest `Tarol-Position` of this client's own changes, sent as `Tarol-Read-After`. */
  readonly position: string | null;
}

interface Entry {
  readonly etag: string;
  readonly value: unknown;
  readonly version?: number;
}

interface Answer {
  readonly response: Response | null;
  readonly body: unknown;
}

const json = 'application/json';

/** Creates a client. Nothing is touched at import or creation time, so it is safe outside a browser. */
export function createClient(options: ClientOptions): TarolClient {
  const base = options.baseUrl.replace(/\/+$/, '');
  const limit = options.cacheSize ?? 200;
  const retries = options.retries ?? 2;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const cache = new Map<string, Entry>();
  const listeners = new Set<(e: ChangeEvent) => void>();
  let position: string | null = null;

  const url = (path: string, query?: Readonly<Record<string, QueryValue>>): string => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) params.set(k, String(v));
    const qs = params.toString();
    return base + path + (qs ? `?${qs}` : '');
  };

  async function send(target: string, init: RequestInit, headers: Record<string, string>): Promise<Answer> {
    const doFetch = options.fetch ?? globalThis.fetch;
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const token = await options.tokens?.token();
      const h: Record<string, string> = { accept: json, traceparent: traceparent(), ...headers };
      if (token) h['authorization'] = `Bearer ${token}`;
      let response: Response;
      try {
        response = await doFetch(target, { ...init, headers: h });
      } catch (error) {
        if (init.signal?.aborted) throw error;
        if (attempt < retries) {
          await sleep(250 * 2 ** attempt);
          continue;
        }
        return { response: null, body: undefined };
      }
      if (response.status === 401 && !refreshed && options.tokens?.refresh) {
        refreshed = true;
        if (await options.tokens.refresh()) {
          attempt--;
          continue;
        }
      }
      if (response.status === 503 && attempt < 3) {
        const after = Number(response.headers.get('retry-after'));
        const body = await decode(response);
        if (isBuilding(body)) {
          await sleep((Number.isFinite(after) && after > 0 ? after : 1) * 1000);
          continue;
        }
        return { response, body };
      }
      return { response, body: await decode(response) };
    }
  }

  function failed(answer: Answer): Failed {
    const status = answer.response?.status ?? 0;
    const body = answer.body as { traceId?: unknown } | undefined;
    const requestId =
      answer.response?.headers.get('tarol-request-id') ?? (typeof body?.traceId === 'string' ? body.traceId : null);
    return {
      ok: false,
      status,
      violation: status === 0 ? { kind: 'error', code: fallbackCode(0) } : toViolation(status, answer.body),
      ...(requestId ? { requestId } : {}),
    };
  }

  function ok<T>(response: Response, value: unknown, notModified: boolean, version?: number): Ok<T> {
    const p = response.headers.get('tarol-position');
    const requestId = response.headers.get('tarol-request-id');
    return {
      ok: true,
      value: value as T,
      status: response.status,
      replayed: response.headers.get('idempotent-replayed') === 'true',
      stale: response.headers.get('tarol-stale') === 'true',
      notModified,
      ...(version === undefined ? {} : { version }),
      ...(p ? { position: p } : {}),
      ...(requestId ? { requestId } : {}),
    };
  }

  return {
    url,
    get position() {
      return position;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    invalidate(prefix) {
      if (prefix === undefined) cache.clear();
      else
        for (const k of [...cache.keys()]) if (k.slice(k.indexOf(' ') + 1).startsWith(base + prefix)) cache.delete(k);
    },

    async change<T>(request: ChangeRequest<T>, o: ChangeOptions = {}): Promise<Result<T>> {
      const headers: Record<string, string> = { 'idempotency-key': o.key ?? globalThis.crypto.randomUUID() };
      if (o.expectedVersion !== undefined) headers['if-match'] = `"${String(o.expectedVersion)}"`;
      const init: RequestInit = { method: request.method };
      if (request.body !== undefined) {
        headers['content-type'] = json;
        init.body = JSON.stringify(request.body); // serialized once: a retry sends the same bytes (the key's fingerprint)
      }
      if (o.signal) init.signal = o.signal;
      const answer = await send(url(request.path), init, headers);
      const r = answer.response;
      if (!r?.ok) return failed(answer);
      const p = r.headers.get('tarol-position');
      if (p && (position === null || comparePositions(p, position) > 0)) position = p;
      const event: ChangeEvent = { method: request.method, path: request.path, ...(p ? { position: p } : {}) };
      for (const l of listeners) l(event);
      return ok<T>(r, answer.body, false, versionOf(r));
    },

    async read<T>(path: string, o: ReadOptions = {}): Promise<Result<T>> {
      const target = url(path, o.query);
      const key = `${options.tokens?.tenant() ?? '-'} ${target}`;
      const cached = cache.get(key);
      const headers: Record<string, string> = {};
      if (cached) headers['if-none-match'] = cached.etag;
      const after =
        o.readAfter !== undefined &&
        isPosition(o.readAfter) &&
        (position === null || comparePositions(o.readAfter, position) > 0)
          ? o.readAfter
          : position;
      if (after) headers['tarol-read-after'] = after;
      const init: RequestInit = { method: 'GET' };
      if (o.signal) init.signal = o.signal;
      const answer = await send(target, init, headers);
      const r = answer.response;
      if (r?.status === 304 && cached) {
        cache.delete(key);
        cache.set(key, cached);
        return ok<T>(r, cached.value, true, cached.version);
      }
      if (!r?.ok) return failed(answer);
      const etag = r.headers.get('etag');
      const version = versionOf(r);
      if (etag) {
        cache.delete(key);
        cache.set(key, { etag, value: answer.body, ...(version === undefined ? {} : { version }) });
        const oldest = cache.keys().next();
        if (cache.size > limit && !oldest.done) cache.delete(oldest.value);
      }
      return ok<T>(r, answer.body, false, version);
    },
  };
}

async function decode(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 304) return undefined;
  if (!(response.headers.get('content-type') ?? '').includes('json')) return undefined;
  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : undefined;
}

function isBuilding(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { code?: unknown }).code === 'Projection.Building';
}

/** A strong `ETag: "<n>"` is the aggregate's version; weak list tags are not versions. */
function versionOf(r: Response): number | undefined {
  const m = /^"(\d+)"$/.exec(r.headers.get('etag') ?? '');
  return m?.[1] === undefined ? undefined : Number(m[1]);
}

function traceparent(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `00-${hex.slice(0, 32)}-${hex.slice(32)}-01`;
}

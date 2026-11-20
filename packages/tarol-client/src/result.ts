/**
 * The outcome of a call: the value, or the backend's violation. Business failures are values, never exceptions
 * (philosophy P5); only programming errors and aborted requests throw.
 */
export type Result<T, C extends string = string> = Ok<T> | Failed<C>;

/** A successful answer. */
export interface Ok<T> {
  /** Discriminates {@link Ok} from {@link Failed}. */
  readonly ok: true;
  /** The decoded body (`undefined` for a 204). */
  readonly value: T;
  /** The HTTP status (200, 201, 204; 304 answers are reported with the cached value and `notModified: true`). */
  readonly status: number;
  /** The aggregate version from the `ETag` of a change or view, when the answer carries one. */
  readonly version?: number;
  /** The `Tarol-Position` of the commit or read (`<tx>.<pos>`). */
  readonly position?: string;
  /** `true` when a change was answered from its idempotency key (`Idempotent-Replayed: true`). */
  readonly replayed: boolean;
  /** `true` when a list answered before it caught up with `Tarol-Read-After` (`Tarol-Stale: true`). */
  readonly stale: boolean;
  /** `true` when the value came from the client's cache after a 304. */
  readonly notModified: boolean;
  /** The backend's `Tarol-Request-Id`, when the answer carried one (BC-11). */
  readonly requestId?: string;
}

/**
 * A refused or failed call. `C` narrows the backend's codes, e.g. to an operation's `x-tarol-errors` in a generated client;
 * the client's own codes ({@link ClientCode}) can always occur.
 */
export interface Failed<C extends string = string> {
  /** Discriminates {@link Failed} from {@link Ok}. */
  readonly ok: false;
  /** What the backend refused, or `Network` when it could not be reached. */
  readonly violation: Violation<C>;
  /** The HTTP status, or 0 when the network failed. */
  readonly status: number;
  /**
   * The request's id: the `Tarol-Request-Id` header, else the problem's `traceId` (BC-11). Show it with the error so a user
   * can quote it; the backend's traces are found by it.
   */
  readonly requestId?: string;
}

/** What went wrong: invalid fields, or one coded error. */
export type Violation<C extends string = string> = Invalid | Problem<C>;

/** A 400 with field errors: JSON paths as the backend writes them (`lines[1].quantity`) mapped to codes (`Range`). */
export interface Invalid {
  /** Discriminates {@link Invalid} from {@link Problem}. */
  readonly kind: 'invalid';
  /** Field path → codes, e.g. `{ 'lines[1].quantity': ['Range'] }`; `''` is the whole body. */
  readonly errors: Readonly<Record<string, readonly string[]>>;
  /**
   * The same errors with the rule's detail where the backend gave one (`errorDetails`, BC-5), e.g.
   * `{ reserve: [{ code: 'Range', detail: '1..1000000' }] }`. Same paths and codes as {@link Invalid.errors}.
   */
  readonly details: Readonly<Record<string, readonly FieldError[]>>;
}

/** One field error: the backend's code and, for a generated rule, its detail (the bounds, `3..60`). */
export interface FieldError {
  /** The rule's code (`Range`, `Length`, `Unknown` …). */
  readonly code: string;
  /** The rule's detail, e.g. `1..1000000`; for logs and for messages that show the bounds. */
  readonly detail?: string;
}

/** Any other refusal, with the backend's code (`Auction.NotSeller`, `Stream.VersionConflict`, `Network`). */
export interface Problem<C extends string = string> {
  /** Discriminates {@link Problem} from {@link Invalid}. */
  readonly kind: 'error';
  /** The backend's code, or a fallback per status when the answer had no problem body ({@link fallbackCode}). */
  readonly code: C | ClientCode;
  /** The backend's detail text, for logs; user messages come from the code. */
  readonly detail?: string;
  /**
   * The problem's other members (RFC 9457 extensions), e.g. `failed` of `DataProtection.ErasureIncomplete`; absent when
   * there are none.
   */
  readonly extensions?: Readonly<Record<string, unknown>>;
}

/**
 * The codes the client gives itself: `Network` (no answer), and one per status for an answer without a problem body
 * ({@link fallbackCode}); `Http.<status>` for any other status.
 */
export type ClientCode =
  | 'Network'
  | 'Request.Invalid'
  | 'Auth.Required'
  | 'Auth.Forbidden'
  | 'NotFound'
  | 'Conflict'
  | 'Request.TooLarge'
  | 'Request.UnsupportedMediaType'
  | 'Unprocessable'
  | 'TooManyRequests'
  | 'Unavailable'
  | `Http.${number}`;

const fallbackCodes: Readonly<Record<number, ClientCode>> = {
  0: 'Network',
  400: 'Request.Invalid',
  401: 'Auth.Required',
  403: 'Auth.Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  413: 'Request.TooLarge',
  415: 'Request.UnsupportedMediaType',
  422: 'Unprocessable',
  429: 'TooManyRequests',
  503: 'Unavailable',
};

/** The code used when an answer carries no problem body (a 401 never has one). */
export function fallbackCode(status: number): ClientCode {
  return fallbackCodes[status] ?? (`Http.${String(status)}` as `Http.${number}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Turns a problem body (RFC 9457 as Tarol writes it) and its status into a violation. */
export function toViolation(status: number, body: unknown): Violation {
  if (isRecord(body)) {
    const errors = body['errors'];
    if (status === 400 && isRecord(errors)) {
      const out: Record<string, string[]> = {};
      const details: Record<string, FieldError[]> = {};
      const given = isRecord(body['errorDetails']) ? body['errorDetails'] : {};
      for (const [path, codes] of Object.entries(errors)) {
        const list = Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string') : [];
        out[path] = list;
        // the details of a path follow its codes; a detail is taken only for a code the errors list
        const extra = Array.isArray(given[path]) ? (given[path] as unknown[]).filter(isRecord) : [];
        details[path] = list.map((code) => {
          const d = extra.find((e) => e['code'] === code)?.['detail'];
          return typeof d === 'string' ? { code, detail: d } : { code };
        });
      }
      return { kind: 'invalid', errors: out, details };
    }
    const code = typeof body['code'] === 'string' ? body['code'] : undefined;
    const title = typeof body['title'] === 'string' ? body['title'] : undefined;
    const detail = typeof body['detail'] === 'string' ? body['detail'] : undefined;
    const known = new Set([
      'type',
      'status',
      'title',
      'code',
      'detail',
      'traceId',
      'instance',
      'errors',
      'errorDetails',
    ]);
    const extra = Object.entries(body).filter(([k]) => !known.has(k));
    return {
      kind: 'error',
      code: code ?? title ?? fallbackCode(status),
      ...(detail === undefined ? {} : { detail }),
      ...(extra.length > 0 ? { extensions: Object.fromEntries(extra) } : {}),
    };
  }
  return { kind: 'error', code: fallbackCode(status) };
}

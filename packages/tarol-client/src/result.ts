/**
 * The outcome of a call: the value, or the backend's violation. Business failures are values, never exceptions
 * (philosophy P5); only programming errors and aborted requests throw.
 */
export type Result<T> = Ok<T> | Failed;

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
}

/** A refused or failed call. */
export interface Failed {
  /** Discriminates {@link Failed} from {@link Ok}. */
  readonly ok: false;
  /** What the backend refused, or `Network` when it could not be reached. */
  readonly violation: Violation;
  /** The HTTP status, or 0 when the network failed. */
  readonly status: number;
}

/** What went wrong: invalid fields, or one coded error. */
export type Violation = Invalid | Problem;

/** A 400 with field errors: JSON paths as the backend writes them (`lines[1].quantity`) mapped to codes (`Range`). */
export interface Invalid {
  /** Discriminates {@link Invalid} from {@link Problem}. */
  readonly kind: 'invalid';
  /** Field path → codes, e.g. `{ 'lines[1].quantity': ['Range'] }`; `''` is the whole body. */
  readonly errors: Readonly<Record<string, readonly string[]>>;
}

/** Any other refusal, with the backend's code (`Auction.NotSeller`, `Stream.VersionConflict`, `Network`). */
export interface Problem {
  /** Discriminates {@link Problem} from {@link Invalid}. */
  readonly kind: 'error';
  /** The backend's code, or a fallback per status when the answer had no problem body ({@link fallbackCode}). */
  readonly code: string;
  /** The backend's detail text, for logs; user messages come from the code. */
  readonly detail?: string;
}

const fallbackCodes: Readonly<Record<number, string>> = {
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
export function fallbackCode(status: number): string {
  return fallbackCodes[status] ?? `Http.${String(status)}`;
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
      for (const [path, codes] of Object.entries(errors)) {
        out[path] = Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string') : [];
      }
      return { kind: 'invalid', errors: out };
    }
    const code = typeof body['code'] === 'string' ? body['code'] : undefined;
    const title = typeof body['title'] === 'string' ? body['title'] : undefined;
    const detail = typeof body['detail'] === 'string' ? body['detail'] : undefined;
    const problem: Problem = { kind: 'error', code: code ?? title ?? fallbackCode(status) };
    return detail === undefined ? problem : { ...problem, detail };
  }
  return { kind: 'error', code: fallbackCode(status) };
}

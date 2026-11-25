import type { ChangeRequest, Result, TarolClient, Violation } from '@clorat/tarol-client';
import { getTarol } from './context.js';
import { revalidated } from './query.svelte.js';

/** Settings of {@link action}. */
export interface ActionOptions<T> {
  /** The client, when not taken from {@link setTarol}'s context. */
  readonly client?: TarolClient;
  /** Called after a successful run. */
  readonly onSuccess?: (result: Extract<Result<T>, { ok: true }>) => void;
  /** Resolve a successful run only after the queries the change revalidates have read again (as `changeForm`). */
  readonly awaitRevalidation?: boolean;
}

/** Per-run settings of {@link Action.run}. */
export interface RunOptions {
  /** Sends `If-Match: "<version>"`, e.g. the version of the view the button belongs to. */
  readonly expectedVersion?: number | undefined;
}

/** The reactive state of one backend change run from a button (no form): choose, delete, deactivate. */
export interface Action<I, T> {
  /** `true` while the change is being sent. */
  readonly pending: boolean;
  /** The violation of the last run, or `undefined` after a success. */
  readonly violation: Violation | undefined;
  /** The code to show for the last run: the violation's code, or the first code of its first field; `undefined` when it succeeded. */
  readonly code: string | undefined;
  /** The request id of the last failed run (`Tarol-Request-Id`), for "Reference: …" next to the error. */
  readonly requestId: string | undefined;
  /**
   * Sends the change. A run while one is pending does nothing and returns `undefined`. A retry of the same input after a
   * failure reuses the idempotency key.
   */
  run(input: I, options?: RunOptions): Promise<Result<T> | undefined>;
  /** Clears the violation (e.g. when the user closes the message). */
  reset(): void;
}

/**
 * A backend change for a button: `const main = action(requests.chooseMainLocation)`, then `main.run({ location })`,
 * `main.pending`, `main.code`. Call it during component initialisation. `T` comes from the request (`ChangeRequest<Created>`).
 */
export function action<I, T = undefined>(
  change: (input: I) => ChangeRequest<T>,
  options: ActionOptions<T> = {},
): Action<I, T> {
  const client = options.client ?? getTarol().client;
  let pending = $state(false);
  let violation = $state<Violation | undefined>();
  let requestId = $state<string | undefined>();
  let sent: { body: string; key: string } | undefined;
  const code = $derived(
    violation === undefined
      ? undefined
      : violation.kind === 'error'
        ? violation.code
        : (Object.values(violation.errors)[0]?.[0] ?? 'error.generic'),
  );
  return {
    get pending() {
      return pending;
    },
    get violation() {
      return violation;
    },
    get code() {
      return code;
    },
    get requestId() {
      return requestId;
    },
    async run(input, o = {}) {
      if (pending) return undefined;
      // the same intent keeps its key (the backend fingerprints the body), a new input takes a new one
      const body = JSON.stringify(input);
      if (sent?.body !== body) sent = { body, key: globalThis.crypto.randomUUID() };
      pending = true;
      try {
        const r = await client.change<T>(
          change(input),
          o.expectedVersion === undefined ? { key: sent.key } : { key: sent.key, expectedVersion: o.expectedVersion },
        );
        if (r.ok) {
          sent = undefined;
          violation = undefined;
          requestId = undefined;
          if (options.awaitRevalidation === true) await revalidated(client);
          options.onSuccess?.(r);
        } else {
          violation = r.violation;
          requestId = r.requestId;
        }
        return r;
      } finally {
        pending = false;
      }
    },
    reset() {
      violation = undefined;
      requestId = undefined;
    },
  };
}

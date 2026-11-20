import type { ChangeRequest, Result, TarolClient, Violation } from '@clorat/tarol-client';
import { getTarol } from './context.js';
import { check, rulePath, type Rules } from './rules.js';

/** Settings of {@link changeForm}. */
export interface FormOptions<T, I = unknown> {
  /** Client rules per field path, generated from the backend's validation metadata (SV-5). */
  readonly rules?: Rules;
  /** Extra settings of the change, e.g. the expected version of the aggregate being edited. */
  readonly expectedVersion?: () => number | undefined;
  /** Called after a successful submit. */
  readonly onSuccess?: (result: Extract<Result<T>, { ok: true }>) => void;
  /** The client, when not taken from {@link setTarol}'s context. */
  readonly client?: TarolClient;
  /**
   * An optimistic change (opt-in, SV-6): called with the input right before it is sent, it shows the expected result,
   * usually `(input) => view.patch((v) => ({ ...v, … }))`, and returns the rollback. The rollback runs when the change
   * fails (a 409 `Stream.VersionConflict` included) or throws; on success the own-change revalidation replaces the patch.
   */
  readonly optimistic?: (input: I) => (() => void) | undefined;
}

/** The reactive state of a form bound to one backend change. */
export interface Form<I, T> {
  /** The input, deeply reactive: bind fields to it (`bind:value={form.values.amount}`). */
  readonly values: I;
  /** Codes per field path, from the client rules and from the server's 400 (`{ 'lines[1].quantity': ['Range'] }`). */
  readonly errors: Readonly<Record<string, readonly string[]>>;
  /** A violation that belongs to no field: a coded error (403, 409 …) or server field paths no field shows. */
  readonly formError: Violation | undefined;
  /** `true` while the change is being sent. */
  readonly pending: boolean;
  /** The first error code of a field, or `undefined`. */
  error(path: string): string | undefined;
  /** Marks a field as touched and checks it against its rules (call it on blur). */
  touch(path: string): void;
  /** Checks every field with rules; `true` when none fails. */
  validate(): boolean;
  /** Checks, then sends the change. The idempotency key is kept while the input is unchanged, so a retry is safe. */
  submit(): Promise<Result<T> | undefined>;
  /** Puts the values back and clears errors. */
  reset(values?: I): void;
}

/** Reads a value at a JSON path such as `lines[1].quantity` (the backend's camel-cased field paths). */
export function at(root: unknown, path: string): unknown {
  let v: unknown = root;
  for (const part of path.match(/[^.[\]]+/g) ?? []) {
    if (v === null || typeof v !== 'object') return undefined;
    v = (v as Record<string, unknown>)[part];
  }
  return v;
}

function without<V>(record: Readonly<Record<string, V>>, key: string): Record<string, V> {
  const copy = { ...record };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- error maps are keyed by runtime field paths
  delete copy[key];
  return copy;
}

/** Every concrete path in `values` that has rules, e.g. `lines[0].quantity` and `lines[1].quantity` for `lines[].quantity`. */
function rulePaths(values: unknown, rules: Rules): string[] {
  const out: string[] = [];
  for (const key of Object.keys(rules)) {
    const parts = key.split('[]');
    let paths = [''];
    parts.forEach((part, i) => {
      paths = paths.map((p) => p + part);
      if (i < parts.length - 1)
        paths = paths.flatMap((p) => {
          const arr = at(values, p);
          return Array.isArray(arr) ? arr.map((_, j) => `${p}[${String(j)}]`) : [];
        });
    });
    out.push(...paths);
  }
  return out;
}

/**
 * A form bound to a backend change. `change` builds the request from the input (the generated client's functions do
 * that). Server field errors land on the field with the same path, with no glue code; client rules use the same codes.
 */
export function changeForm<I extends object, T = undefined>(
  change: (input: I) => ChangeRequest,
  initial: I,
  options: FormOptions<T, I> = {},
): Form<I, T> {
  const client = options.client ?? getTarol().client;
  const rules = options.rules ?? {};
  let values = $state(structuredClone(initial));
  let clientErrors = $state<Record<string, readonly string[]>>({});
  let serverErrors = $state<Record<string, readonly string[]>>({});
  let formError = $state<Violation | undefined>();
  let pending = $state(false);
  let sent: { body: string; key: string } | undefined;

  const checkPath = (path: string): void => {
    const code = check(at(values, path), rules[rulePath(path)] ?? []);
    const rest = without(clientErrors, path);
    clientErrors = code === null ? rest : { ...rest, [path]: [code] };
    // the user edited the field: the server's verdict on the old value is gone
    if (path in serverErrors) serverErrors = without(serverErrors, path);
  };

  const errors = $derived({ ...serverErrors, ...clientErrors });

  return {
    get values() {
      return values;
    },
    get errors() {
      return errors;
    },
    get formError() {
      return formError;
    },
    get pending() {
      return pending;
    },
    error: (path) => errors[path]?.[0],
    touch: checkPath,
    validate() {
      for (const p of rulePaths(values, rules)) checkPath(p);
      return Object.keys(clientErrors).length === 0;
    },
    async submit() {
      if (pending) return undefined;
      if (!this.validate()) return undefined;
      // the input as JSON is what the backend gets and fingerprints with the key, so compare and send exactly that
      const body = JSON.stringify(values);
      const input = JSON.parse(body) as I;
      if (sent?.body !== body) sent = { body, key: globalThis.crypto.randomUUID() };
      pending = true;
      formError = undefined;
      let rollback = options.optimistic?.(input);
      try {
        const version = options.expectedVersion?.();
        const r = await client.change<T>(
          change(input),
          version === undefined ? { key: sent.key } : { key: sent.key, expectedVersion: version },
        );
        if (!r.ok) rollback?.();
        rollback = undefined;
        if (r.ok) {
          sent = undefined;
          serverErrors = {};
          options.onSuccess?.(r);
        } else if (r.violation.kind === 'invalid') {
          serverErrors = r.violation.errors;
          // paths no field of this input can show ('' is the whole body, e.g. malformed JSON) go to formError
          const orphans = Object.entries(r.violation.errors).filter(
            ([p]) => p === '' || (at(input, p) === undefined && !(rulePath(p) in rules)),
          );
          const details = r.violation.details;
          formError =
            orphans.length > 0
              ? {
                  kind: 'invalid',
                  errors: Object.fromEntries(orphans),
                  details: Object.fromEntries(orphans.map(([p]) => [p, details[p] ?? []])),
                }
              : undefined;
        } else formError = r.violation;
        return r;
      } finally {
        rollback?.(); // the change threw (aborted): nothing was confirmed
        pending = false;
      }
    },
    reset(next) {
      values = structuredClone(next ?? initial);
      clientErrors = {};
      serverErrors = {};
      formError = undefined;
      sent = undefined;
    },
  };
}

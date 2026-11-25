import type { ChangeRequest, FieldError, Result, TarolClient, Violation } from '@clorat/tarol-client';
import { getTarol } from './context.js';
import { revalidated } from './query.svelte.js';
import { check, rulePath, type Rules } from './rules.js';

/** Settings of {@link changeForm}. */
export interface FormOptions<T, I = unknown> {
  /** Client rules per field path, generated from the backend's validation metadata (SV-5). */
  readonly rules?: Rules;
  /** Extra settings of the change, e.g. the expected version of the aggregate being edited. */
  readonly expectedVersion?: () => number | undefined;
  /**
   * Resolve a successful submit (and call `onSuccess`) only after the queries this change revalidates have read again, so
   * the screen shows the saved state before "Saved" and a next submit starts from it (TS-14). Default `false`.
   */
  readonly awaitRevalidation?: boolean;
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
  /**
   * The server's current values of an edit form, usually the live view (`from: () => view.value`); only the input's own
   * top-level fields are read. Fields the user has not changed follow them; a field the user changed keeps the input and
   * reports {@link Form.conflict} when the server's value changes too. The submit sends the `expectedVersion` the edit
   * started from (a 409 rather than a silent overwrite) until the user changes nothing or resolves every conflict (SV-26).
   */
  readonly from?: () => Partial<I> | undefined;
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
  /** The server's detail of the field's first error (`errorDetails`, e.g. the bounds `3..60`), or `undefined`. */
  detail(path: string): string | undefined;
  /** The request id of the last failed submit (`Tarol-Request-Id`), for "Reference: …" next to the error. */
  readonly requestId: string | undefined;
  /**
   * Declares that a field shows this path (`FormField` calls it); returns the undo. A client rule's error on a path no
   * field shows and the input has no value for (an id the change builder adds) goes to {@link Form.formError} on submit.
   */
  register(path: string): () => void;
  /** Marks a field as touched and checks it against its rules (call it on blur). */
  touch(path: string): void;
  /** Checks every field with rules; `true` when none fails. */
  validate(): boolean;
  /** Checks, then sends the change. The idempotency key is kept while the input is unchanged, so a retry is safe. */
  submit(): Promise<Result<T> | undefined>;
  /** The server's newer value of a top-level field the user changed (option `from`), or `undefined`. */
  conflict(path: string): { readonly theirs: unknown } | undefined;
  /** Ends a conflict: keep the user's input (`mine`) or take the server's value (`theirs`). */
  resolve(path: string, choice: 'mine' | 'theirs'): void;
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

/**
 * Every concrete path in `values` that has rules, e.g. `lines[0].quantity` and `lines[1].quantity` for `lines[].quantity`;
 * not the members of a record that is `null`.
 */
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
    // a member of a record that is null (`Option<Record>`, `T?`) has no value to check: null is valid (TS-9)
    out.push(...paths.filter((p) => !nullParent(values, p)));
  }
  return out;
}

function nullParent(values: unknown, path: string): boolean {
  const parts = path.match(/[^.[\]]+/g) ?? [];
  for (let i = 1; i < parts.length; i++) if (at(values, parts.slice(0, i).join('.')) === null) return true;
  return false;
}

/**
 * A form bound to a backend change. `change` builds the request from the input (the generated client's functions do
 * that). Server field errors land on the field with the same path, with no glue code; client rules use the same codes.
 */
export function changeForm<I extends object, T = undefined>(
  change: (input: I) => ChangeRequest<T>,
  initial: I,
  options: FormOptions<T, I> = {},
): Form<I, T> {
  const client = options.client ?? getTarol().client;
  const rules = options.rules ?? {};
  let values = $state(structuredClone(initial));
  let clientErrors = $state<Record<string, readonly string[]>>({});
  let serverErrors = $state<Record<string, readonly string[]>>({});
  let serverDetails = $state<Readonly<Record<string, readonly FieldError[]>>>({});
  let requestId = $state<string | undefined>();
  let formError = $state<Violation | undefined>();
  let pending = $state(false);
  let sent: { body: string; key: string } | undefined;
  // how many fields show each path (not reactive: read on submit only)
  const shown: Record<string, number> = {};
  // option `from` (SV-26): the server values the input is based on, and the version they had
  const from = options.from;
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  let base: unknown;
  let baseVersion: number | undefined;
  let conflicts = $state<Readonly<Record<string, { readonly theirs: unknown }>>>({});
  if (from) {
    $effect.pre(() => {
      const next = from();
      const version = options.expectedVersion?.();
      if (next === undefined) return;
      const old = base;
      const input = values as Record<string, unknown>;
      let dirty = false;
      let found = conflicts;
      for (const k of Object.keys(input)) {
        if (!(k in next)) continue;
        const theirs = $state.snapshot(at(next, k));
        if (same(input[k], theirs)) {
          if (k in found) found = without(found, k); // the server has the user's value now (e.g. after the save)
        } else if (old === undefined || same(input[k], at(old, k)))
          input[k] = theirs; // untouched: follow
        else {
          dirty = true;
          if (!same(theirs, at(old, k))) found = { ...found, [k]: { theirs } };
        }
      }
      conflicts = found;
      base = $state.snapshot(next);
      if (!dirty) baseVersion = version;
    });
  }

  const checkPath = (path: string): void => {
    const code = check(at(values, path), rules[rulePath(path)] ?? []);
    const rest = without(clientErrors, path);
    clientErrors = code === null ? rest : { ...rest, [path]: [code] };
    // the user edited the field: the server's verdict on the old value is gone
    if (path in serverErrors) serverErrors = without(serverErrors, path);
    if (path in serverDetails) serverDetails = without(serverDetails, path);
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
    detail(path) {
      // only for the code the field shows: a client rule's error has no server detail
      const code = errors[path]?.[0];
      return serverDetails[path]?.find((d) => d.code === code)?.detail;
    },
    get requestId() {
      return requestId;
    },
    register(path) {
      shown[path] = (shown[path] ?? 0) + 1;
      return () => {
        shown[path] = (shown[path] ?? 1) - 1;
      };
    },
    touch: checkPath,
    validate() {
      for (const p of rulePaths(values, rules)) checkPath(p);
      return Object.keys(clientErrors).length === 0;
    },
    async submit() {
      if (pending) return undefined;
      if (!this.validate()) {
        // no field shows these paths (TS-12): say so instead of blocking the submit silently
        const orphans = Object.entries(clientErrors).filter(([p]) => !shown[p] && at(values, p) === undefined);
        formError =
          orphans.length > 0
            ? {
                kind: 'invalid',
                errors: Object.fromEntries(orphans),
                details: Object.fromEntries(orphans.map(([p, codes]) => [p, codes.map((code) => ({ code }))])),
              }
            : undefined;
        return undefined;
      }
      // the input as JSON is what the backend gets and fingerprints with the key, so compare and send exactly that
      const body = JSON.stringify(values);
      const input = JSON.parse(body) as I;
      if (sent?.body !== body) sent = { body, key: globalThis.crypto.randomUUID() };
      pending = true;
      formError = undefined;
      let rollback = options.optimistic?.(input);
      try {
        const version = from ? baseVersion : options.expectedVersion?.();
        const r = await client.change<T>(
          change(input),
          version === undefined ? { key: sent.key } : { key: sent.key, expectedVersion: version },
        );
        if (!r.ok) rollback?.();
        rollback = undefined;
        requestId = r.ok ? undefined : r.requestId;
        if (r.ok) {
          sent = undefined;
          serverErrors = {};
          serverDetails = {};
          if (options.awaitRevalidation === true) await revalidated(client);
          options.onSuccess?.(r);
        } else if (r.violation.kind === 'invalid') {
          serverErrors = r.violation.errors;
          serverDetails = r.violation.details;
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
    conflict: (path) => conflicts[path],
    resolve(path, choice) {
      const c = conflicts[path];
      if (!c) return;
      if (choice === 'theirs') (values as Record<string, unknown>)[path] = c.theirs;
      conflicts = without(conflicts, path);
      // the user decided with the server's newer state in view: submit against it
      if (Object.keys(conflicts).length === 0) baseVersion = options.expectedVersion?.();
    },
    reset(next) {
      values = structuredClone(next ?? initial);
      conflicts = {};
      base = undefined; // the next `from` value is taken as it is
      clientErrors = {};
      serverErrors = {};
      serverDetails = {};
      requestId = undefined;
      formError = undefined;
      sent = undefined;
    },
  };
}

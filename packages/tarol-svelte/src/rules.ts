/**
 * A validation rule as the backend declares it on a value object (Tarol.Validations), carried to the client by the
 * generator (SV-5). The `code` is the backend's, so client and server errors read the same.
 */
export interface Rule {
  /** The rule kind. */
  readonly rule: 'Required' | 'NotEmpty' | 'Range' | 'Length' | 'Pattern' | 'Email' | 'Count';
  /** The backend's error code for it (`Range`, `Length`, `Pattern`, `Email`, `Count`, `Required`). */
  readonly code: string;
  /** Lower bound: the value (`Range`), the length (`Length`) or the item count (`Count`). */
  readonly min?: number;
  /** Upper bound, as `min`. */
  readonly max?: number;
  /** An ECMAScript pattern (`Pattern`); matched with the `u` flag. */
  readonly pattern?: string;
  /** Extra regular-expression flags, e.g. `i`. */
  readonly flags?: string;
}

/** Rules per field path (`reserve`, `lines[1].quantity` uses the rules of `lines[].quantity`). */
export type Rules = Readonly<Record<string, readonly Rule[]>>;

const empty = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * Checks one value against its rules and returns the code of the first failing rule, as the backend does (one error per
 * value), or `null`. An empty optional value passes every rule except `Required`/`NotEmpty`.
 */
export function check(value: unknown, rules: readonly Rule[]): string | null {
  for (const r of rules) {
    if (r.rule === 'Required' || r.rule === 'NotEmpty') {
      if (empty(value)) return r.code;
      continue;
    }
    if (empty(value)) continue;
    if (!passes(r, value)) return r.code;
  }
  return null;
}

function within(n: number, r: Rule): boolean {
  return (r.min === undefined || n >= r.min) && (r.max === undefined || n <= r.max);
}

function passes(r: Rule, v: unknown): boolean {
  switch (r.rule) {
    case 'Range':
      return typeof v === 'number' && within(v, r);
    case 'Length':
      return typeof v === 'string' && within(v.length, r); // UTF-16 units, as .NET's string.Length
    case 'Count':
      return Array.isArray(v) && within(v.length, r);
    case 'Pattern':
      return typeof v === 'string' && new RegExp(r.pattern ?? '', `u${r.flags ?? ''}`).test(v);
    case 'Email':
      return typeof v === 'string' && isEmail(v);
    default:
      return true;
  }
}

/** The backend's email rule (`Tarol.Validations/Rules.cs:42-65`): not a full RFC parser, the same check on both sides. */
export function isEmail(v: string): boolean {
  const at = v.indexOf('@');
  if (v.length > 254 || /\s/.test(v) || at < 1 || at > 64 || at !== v.lastIndexOf('@')) return false;
  const domain = v.slice(at + 1);
  return (
    domain.length <= 253 &&
    domain.includes('.') &&
    !domain.startsWith('.') &&
    !domain.endsWith('.') &&
    !domain.includes('..')
  );
}

/** The rules key of a concrete path: indexes become `[]` (`lines[1].quantity` → `lines[].quantity`). */
export function rulePath(path: string): string {
  return path.replace(/\[\d+\]/g, '[]');
}

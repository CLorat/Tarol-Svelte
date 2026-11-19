import { at } from '@clorat/tarol-svelte';

/** Writes a value at a backend field path such as `lines[1].quantity` (creating nothing: the parents must exist). */
export function setAt(root: object, path: string, value: unknown): void {
  const parts = path.match(/[^.[\]]+/g) ?? [];
  const last = parts.pop();
  if (last === undefined) return;
  const parent = parts.length === 0 ? root : at(root, parts.join('.'));
  if (parent !== null && typeof parent === 'object') (parent as Record<string, unknown>)[last] = value;
}

import { getContext, setContext } from 'svelte';

/** One notification. */
export interface Toast {
  /** A stable id, for keyed rendering and `dismiss`. */
  readonly id: number;
  /** The text, already translated. */
  readonly text: string;
  /** `error` toasts are announced assertively and stay until dismissed. */
  readonly kind: 'info' | 'success' | 'error';
}

/** The notification queue of one ThemeRoot. */
export interface Toasts {
  /** The visible toasts, oldest first. */
  readonly items: readonly Toast[];
  /** Shows a toast; `info` and `success` disappear after `timeout` ms (default 5000; 0 keeps it). Returns its id. */
  show(text: string, options?: { readonly kind?: Toast['kind']; readonly timeout?: number }): number;
  /** Removes a toast. */
  dismiss(id: number): void;
}

/** Creates a queue (ThemeRoot creates one and renders it). */
export function createToasts(): Toasts {
  let items = $state.raw<readonly Toast[]>([]);
  let next = 0;
  const dismiss = (id: number): void => {
    items = items.filter((t) => t.id !== id);
  };
  return {
    get items() {
      return items;
    },
    show(text, options = {}) {
      const kind = options.kind ?? 'info';
      const id = ++next;
      items = [...items, { id, text, kind }];
      const timeout = options.timeout ?? (kind === 'error' ? 0 : 5000);
      if (timeout > 0)
        setTimeout(() => {
          dismiss(id);
        }, timeout);
      return id;
    },
    dismiss,
  };
}

const key = Symbol('tarol-toasts');

/** Puts a queue into the component context. */
export function setToasts(toasts: Toasts): Toasts {
  return setContext(key, toasts);
}

/** The queue of the nearest ThemeRoot; throws when there is none. */
export function getToasts(): Toasts {
  const t = getContext<Toasts | undefined>(key);
  if (!t) throw new Error('tarol-design: getToasts() needs a ThemeRoot above the component');
  return t;
}

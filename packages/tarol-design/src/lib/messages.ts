import { getContext, setContext } from 'svelte';
import { uiEn } from './ui-en.js';

/**
 * A message catalogue: stable ids → text with `{name}` placeholders. Backend codes (`Range`, `Auction.NotSeller`) are ids
 * too, so a code from the server or from a client rule becomes the same text (philosophy P7).
 */
export type Catalogue = Readonly<Record<string, string>>;

/** Parameters of a message (`{min}`, `{max}` …). */
export type MessageParams = Readonly<Record<string, string | number | undefined>>;

/** Turns a message id (or backend code) and its parameters into text. */
export type Translate = (id: string, params?: MessageParams) => string;

/** Builds a translator over catalogues tried in order; an unknown id falls back to `error.generic`, then to the id. */
export function translator(...catalogues: Catalogue[]): Translate {
  return (id, params = {}) => {
    let key = id;
    // a bound that is missing selects the one-sided message ('Range' without max → 'Range.min')
    const min = params['min'] !== undefined;
    const max = params['max'] !== undefined;
    if (!min && max) key = `${id}.max`;
    else if (min && !max) key = `${id}.min`;
    else if (!min && !max) key = `${id}.any`; // no bounds known: a text without placeholders, when the catalogue has one
    const text = find(catalogues, key) ?? find(catalogues, id) ?? find(catalogues, 'error.generic') ?? id;
    return text.replace(/\{(\w+)\}/g, (m, name: string) => {
      const v = params[name];
      return v === undefined ? m : String(v);
    });
  };
}

function find(catalogues: Catalogue[], id: string): string | undefined {
  for (const c of catalogues) if (id in c) return c[id];
  return undefined;
}

const key = Symbol('tarol-messages');
const fallback = translator(uiEn);

/** Puts the translator into the component context (ThemeRoot does it from its `locale` and `messages` props). */
export function setMessages(t: Translate): Translate {
  return setContext(key, t);
}

/** The translator of the nearest ThemeRoot, or the primitives' English texts when there is none. */
export function getMessages(): Translate {
  return getContext<Translate | undefined>(key) ?? fallback;
}

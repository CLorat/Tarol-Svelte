/** A hash router: `#/auctions`, `#/auctions/<id>`, `#/subjects/<id>?tenant=<guid>`. */
export interface Route {
  readonly parts: readonly string[];
  readonly query: URLSearchParams;
}

const parse = (): Route => {
  const [path = '', search = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(search) };
};

let route = $state(parse());
window.addEventListener('hashchange', () => (route = parse()));

/** The current route (reactive). */
export const router = {
  get route(): Route {
    return route;
  },
  /** Reads the location again: after `history.replaceState` (the login callback restores its path), which fires no event. */
  sync(): void {
    route = parse();
  },
  go(hash: string): void {
    location.hash = hash;
  },
};

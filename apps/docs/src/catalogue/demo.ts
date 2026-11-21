import type { ChangeRequest, Page, ReadOptions, Result, TarolClient } from '@clorat/tarol-client';

/** A row of the demo auction list (the sample's `AuctionRow` shape). */
export interface DemoAuction {
  id: string;
  title: string;
  seller: string;
  reserve: number;
  highestBid: number;
  bids: number;
}

const titles = [
  'Irises',
  'Water Lilies',
  'The Cradle',
  'Olympia',
  'The Child’s Bath',
  'Poppies',
  'Haystacks',
  'Le Déjeuner',
];

/** 240 auctions: enough to page and to switch the table to virtual rows (above 200). */
const auctions: DemoAuction[] = Array.from({ length: 240 }, (_, i) => ({
  id: `0000000${String(i).padStart(3, '0')}-demo`,
  title: `${titles[i % titles.length] ?? ''} ${String(Math.floor(i / titles.length) + 1)}`,
  seller: ['alice', 'claude', 'berthe'][i % 3] ?? '',
  reserve: 100 + ((i * 37) % 900),
  highestBid: (i * 53) % 1200,
  bids: (i * 7) % 11,
}));

const ok = <T>(value: T, version?: number): Result<T> => ({
  ok: true,
  value,
  status: 200,
  replayed: false,
  stale: false,
  notModified: false,
  ...(version === undefined ? {} : { version }),
});

/**
 * An in-memory TarolClient for the catalogue (no backend): `GET /auctions` (keyset pages, `sort`), `GET /auctions/{id}`,
 * `GET /search?q=`, and changes that succeed after 300 ms, except a bid below the reserve (400 `amount: Range`).
 */
export function demoClient(): TarolClient {
  const listeners = new Set<(e: { method: string; path: string }) => void>();
  const delay = <T>(v: T, ms = 150): Promise<T> =>
    new Promise((r) => {
      setTimeout(() => {
        r(v);
      }, ms);
    });
  return {
    read<T>(path: string, o?: ReadOptions): Promise<Result<T>> {
      const q = o?.query ?? {};
      if (path === '/auctions') {
        const sorted = [...auctions].sort((a, b) =>
          q['sort'] === 'Title' ? a.title.localeCompare(b.title) : b.highestBid - a.highestBid,
        );
        const limit = Number(q['limit'] ?? 20);
        const start = typeof q['after'] === 'string' ? Number(q['after']) : 0;
        const items = sorted.slice(start, start + limit);
        const page: Page<DemoAuction> = {
          items,
          next: start + limit < sorted.length ? String(start + limit) : null,
          ...(q['count'] === true ? { total: sorted.length } : {}),
        };
        return delay(ok(page) as Result<T>);
      }
      if (path === '/search') {
        const text = String(q['q'] ?? '').toLowerCase();
        const items = auctions
          .filter((a) => a.title.toLowerCase().includes(text))
          .slice(0, Number(q['limit'] ?? 8))
          .map((a) => {
            // as the backend answers with snippets=true: plain text and the matched range in UTF-16 code units
            const snippet = `${a.title}, reserve ${String(a.reserve)} EUR`;
            const at = snippet.toLowerCase().indexOf(text);
            const highlights = q['snippets'] === true && at >= 0 && text ? [{ start: at, length: text.length }] : [];
            return { type: 'Auction', id: a.id, aggregate: a.id, title: a.title, score: 1, snippet, highlights };
          });
        return delay(ok({ items, next: null }) as Result<T>);
      }
      const found = auctions.find((a) => path === `/auctions/${a.id}`);
      return delay(
        (found
          ? ok(found, 1)
          : { ok: false, status: 404, violation: { kind: 'error', code: 'Auction.NotFound' } }) as Result<T>,
      );
    },
    change<T>(r: ChangeRequest): Promise<Result<T>> {
      const body = (r.body ?? {}) as Record<string, unknown>;
      if (typeof body['amount'] === 'number' && body['amount'] < 100)
        return delay({ ok: false, status: 400, violation: { kind: 'invalid', errors: { amount: ['Range'] }, details: { amount: [{ code: 'Range' }] } } }, 300);
      for (const l of listeners) l({ method: r.method, path: r.path });
      return delay(ok(undefined as T), 300);
    },
    url: (p) => p,
    invalidate: () => undefined,
    onChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    position: null,
  };
}

/** The first demo auction's id, for the detail examples. */
export const firstAuction = auctions[0]?.id ?? '';

import type { ChangeRequest, Page, Result, TarolClient } from '@clorat/tarol-client';

export interface Row {
  id: string;
  title: string;
  bids: number;
}

export const rows = (n: number, from = 0): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${String(from + i)}`,
    title: `Auction ${String(from + i)}`,
    bids: (from + i) % 7,
  }));

const ok = <T>(value: T): Result<T> => ({
  ok: true,
  value,
  status: 200,
  replayed: false,
  stale: false,
  notModified: false,
});

/** A client double over an in-memory list of `total` rows, paged by `limit` with cursors `c<offset>`. */
export function fakeClient(total = 5, onChange: (r: ChangeRequest) => Result<unknown> = () => ok(undefined)) {
  const reads: { path: string; query: Record<string, unknown> }[] = [];
  const client: TarolClient = {
    read<T>(path: string, o?: { query?: Record<string, unknown> }) {
      const q = o?.query ?? {};
      reads.push({ path, query: q });
      const limit = Number(q['limit'] ?? 50);
      const start = typeof q['after'] === 'string' ? Number(q['after'].slice(1)) : 0;
      const end = Math.min(total, start + limit);
      const page: Page<Row> = { items: rows(end - start, start), next: end < total ? `c${String(end)}` : null };
      return Promise.resolve(ok(page) as Result<T>);
    },
    change<T>(r: ChangeRequest) {
      return Promise.resolve(onChange(r) as Result<T>);
    },
    url: (p) => p,
    invalidate: () => undefined,
    onChange: () => () => undefined,
    position: null,
  };
  return { client, reads };
}

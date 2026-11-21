import type { ChangeRequest, Result, TarolClient } from '@clorat/tarol-client';

/** A recorded request of the fake admin backend. */
export interface Call {
  readonly method: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, unknown>>;
}

type Answer = (call: Call) => Result<unknown> | undefined;

const ok = (value: unknown, status = 200): Result<unknown> => ({
  ok: true,
  value,
  status,
  replayed: false,
  stale: false,
  notModified: false,
});

/** A client double over an admin entry at `/tarol/admin` with two kinds and two reaction dead letters. */
export function fakeAdmin(answer: Answer = () => undefined) {
  const calls: Call[] = [];
  const letters = [1, 2].map((id) => ({
    id,
    kind: 'reactions',
    name: `Reactions.Step${String(id)}`,
    tenant: null,
    subject: `s-${String(id)}`,
    attempts: 5,
    error: 'boom',
    deadAt: '2026-11-20T10:00:00Z',
  }));
  const standard = (c: Call): Result<unknown> => {
    const p = c.path.replace(/^\/ops/, '/tarol/admin'); // a test mounts the entry at /ops
    if (p === '/tarol/admin/dead') return ok(['jobs', 'reactions']);
    if (p === '/tarol/admin/dead/reactions' && c.method === 'GET') return ok({ items: letters, next: null });
    if (p === '/tarol/admin/dead/jobs') return ok({ items: [], next: null });
    if (p === '/tarol/admin/projections')
      return ok([
        { name: 'auction-list', version: 1, state: 'retired', rows: 3, bytes: 8192, superseded: true },
        { name: 'auction-list', version: 2, state: 'current', rows: 3, bytes: 8192, superseded: false },
      ]);
    if (p.startsWith('/tarol/admin/subjects/') && p.endsWith('/export'))
      return ok({ tenant: c.query?.['tenant'], subject: 's', events: [{ type: 'bidder_profile' }], states: [] });
    if (p.includes('/redrive') && !/\/\d+\/redrive/.test(p)) return ok({ redriven: 2 });
    if (p.includes('/erase')) return ok({ tenant: '0', subject: 's', alreadyErased: false, streams: 1 });
    return ok(undefined, 204);
  };
  const client: TarolClient = {
    read<T>(path: string, o?: { query?: Readonly<Record<string, unknown>> }) {
      const call: Call = { method: 'GET', path, ...(o?.query ? { query: o.query } : {}) };
      calls.push(call);
      return Promise.resolve((answer(call) ?? standard(call)) as Result<T>);
    },
    change<T>(r: ChangeRequest) {
      const [path = '', qs = ''] = r.path.split('?');
      const call: Call = { method: r.method, path, query: Object.fromEntries(new URLSearchParams(qs)) };
      calls.push(call);
      return Promise.resolve((answer(call) ?? standard(call)) as Result<T>);
    },
    url: (p) => p,
    invalidate: () => undefined,
    onChange: () => () => undefined,
    position: null,
  };
  return { client, calls };
}

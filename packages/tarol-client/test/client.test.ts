import { describe, expect, it, vi } from 'vitest';
import { asId, comparePositions, createClient, isId, toViolation, type TokenProvider } from '../src/index.js';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

type Reply = Response | Error;

/** A fake backend: answers the queued replies in order and records every request. */
function backend(...replies: Reply[]) {
  const calls: Call[] = [];
  const fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
      method: init?.method ?? 'GET',
      headers: { ...(init?.headers as Record<string, string>) },
      body: init?.body as string | undefined,
    });
    const r = replies.shift();
    if (!r) throw new Error('no reply queued');
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  });
  return { calls, fetch: fetch as unknown as typeof globalThis.fetch };
}

const problem = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/problem+json', ...headers } });
const ok = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
  });

const tokens = (tenant = 't1', token = 'tok'): TokenProvider => ({ token: () => token, tenant: () => tenant });
const noSleep = vi.fn(() => Promise.resolve());

function client(b: ReturnType<typeof backend>, extra: Partial<Parameters<typeof createClient>[0]> = {}) {
  return createClient({ baseUrl: 'http://api/', fetch: b.fetch, tokens: tokens(), sleep: noSleep, ...extra });
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id = '01a1f52a-ea03-7f82-b768-389f780fed06';

describe('changes', () => {
  it('maps a creation (201) with id, version and position, and sends key, JSON and traceparent', async () => {
    const b = backend(
      ok(201, { id, version: 1 }, { etag: '"1"', location: `/auctions/${id}`, 'tarol-position': '1798.2' }),
    );
    const r = await client(b).change<{ id: string; version: number }>({
      method: 'POST',
      path: '/auctions',
      body: { reserve: 100 },
    });
    expect(r).toMatchObject({
      ok: true,
      status: 201,
      value: { id, version: 1 },
      version: 1,
      position: '1798.2',
      replayed: false,
    });
    const c = b.calls[0];
    expect(c?.url).toBe('http://api/auctions');
    expect(c?.headers['idempotency-key']).toMatch(uuid);
    expect(c?.headers['content-type']).toBe('application/json');
    expect(c?.headers['authorization']).toBe('Bearer tok');
    expect(c?.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(c?.body).toBe('{"reserve":100}');
  });

  it('reports a replayed key (200 + Idempotent-Replayed) as ok and replayed', async () => {
    const b = backend(ok(200, { id, version: 1 }, { etag: '"1"', 'idempotent-replayed': 'true' }));
    const r = await client(b).change({ method: 'POST', path: '/auctions', body: {} }, { key: 'k-1' });
    expect(r).toMatchObject({ ok: true, status: 200, replayed: true });
    expect(b.calls[0]?.headers['idempotency-key']).toBe('k-1');
  });

  it('maps a 204 change with the new version from the ETag and no body', async () => {
    const b = backend(ok(204, undefined, { etag: '"2"', 'tarol-position': '1800.1' }));
    const r = await client(b).change(
      { method: 'POST', path: `/auctions/${id}/bids`, body: { amount: 150 } },
      { expectedVersion: 1 },
    );
    expect(r).toMatchObject({ ok: true, status: 204, value: undefined, version: 2 });
    expect(b.calls[0]?.headers['if-match']).toBe('"1"');
  });

  it('sends no body and no content type for a body-less change', async () => {
    const b = backend(ok(204, undefined, { etag: '"3"' }));
    await client(b).change({ method: 'POST', path: `/auctions/${id}/settle` });
    expect(b.calls[0]?.body).toBeUndefined();
    expect(b.calls[0]?.headers['content-type']).toBeUndefined();
  });

  it('maps 400 field errors with the backend paths', async () => {
    const b = backend(
      problem(400, {
        status: 400,
        title: 'One or more fields are invalid.',
        errors: { 'lines[1].quantity': ['Range'], '': ['Json'] },
      }),
    );
    const r = await client(b).change({ method: 'POST', path: '/orders', body: {} });
    expect(r).toEqual({
      ok: false,
      status: 400,
      violation: {
        kind: 'invalid',
        errors: { 'lines[1].quantity': ['Range'], '': ['Json'] },
        details: { 'lines[1].quantity': [{ code: 'Range' }], '': [{ code: 'Json' }] },
      },
    });
  });

  it('carries the error details, the request id and the trace id of a 400', async () => {
    const b = backend(
      problem(
        400,
        {
          title: 'One or more fields are invalid.',
          errors: { reserve: ['Range'] },
          errorDetails: { reserve: [{ code: 'Range', detail: '1..1000000' }] },
          traceId: '1ab7b7af266c4111b857fa99a936bc1b',
        },
        { 'tarol-request-id': '1ab7b7af266c4111b857fa99a936bc1b' },
      ),
    );
    const r = await client(b).change({ method: 'POST', path: '/auctions', body: { reserve: 0 } });
    expect(r).toEqual({
      ok: false,
      status: 400,
      requestId: '1ab7b7af266c4111b857fa99a936bc1b',
      violation: {
        kind: 'invalid',
        errors: { reserve: ['Range'] },
        details: { reserve: [{ code: 'Range', detail: '1..1000000' }] },
      },
    });
  });

  it('keeps a problem’s extension members, e.g. the failed participants of an erasure', async () => {
    const b = backend(
      problem(409, {
        type: 'https://tools.ietf.org/html/rfc9110#section-15.5.10',
        status: 409,
        title: 'DataProtection.ErasureIncomplete',
        code: 'DataProtection.ErasureIncomplete',
        detail: 'search',
        tenant: '00000000-0000-0000-0000-000000000000',
        subject: id,
        failed: ['search'],
        traceId: 't-1',
      }),
    );
    const r = await client(b).change({ method: 'POST', path: `/tarol/admin/subjects/${id}/erase` });
    expect(r).toEqual({
      ok: false,
      status: 409,
      requestId: 't-1',
      violation: {
        kind: 'error',
        code: 'DataProtection.ErasureIncomplete',
        detail: 'search',
        extensions: { tenant: '00000000-0000-0000-0000-000000000000', subject: id, failed: ['search'] },
      },
    });
  });

  it('reads the reasons of a refusal (Tarol-Net TN-36) as codes, not as an extension (TS-33)', async () => {
    const b = backend(
      problem(409, {
        code: 'Contract.CannotStart',
        reasons: ['Contract.NoLicense', 'Contract.NoMeasles'],
        hint: 1,
      }),
      problem(409, { code: 'X.Y', reasons: 'not a list' }),
    );
    const r = await client(b).change({ method: 'POST', path: '/contracts', body: {} });
    expect(!r.ok && r.violation).toEqual({
      kind: 'error',
      code: 'Contract.CannotStart',
      reasons: ['Contract.NoLicense', 'Contract.NoMeasles'],
      extensions: { hint: 1 },
    });
    const odd = await client(b).change({ method: 'POST', path: '/contracts', body: {} });
    expect(!odd.ok && odd.violation).toEqual({ kind: 'error', code: 'X.Y', extensions: { reasons: 'not a list' } });
  });

  it('reads a warning to confirm (Tarol-Net TN-37) as confirm, with its arguments (TS-33)', async () => {
    const b = backend(
      problem(409, {
        code: 'Recipe.LargeFeast',
        confirm: { code: 'Recipe.LargeFeast', args: { servings: '20', limit: '12' } },
      }),
      problem(409, { code: 'X.Y', confirm: { code: 'X.Y', args: { n: 1 } } }),
    );
    const r = await client(b).change({ method: 'PUT', path: '/recipes/r/feast', body: { servings: 20 } });
    expect(!r.ok && r.violation).toEqual({
      kind: 'error',
      code: 'Recipe.LargeFeast',
      confirm: { code: 'Recipe.LargeFeast', args: { servings: '20', limit: '12' } },
    });
    // anything but string arguments is not a confirmable warning: it stays an extension
    const odd = await client(b).change({ method: 'PUT', path: '/recipes/r/feast', body: {} });
    expect(!odd.ok && odd.violation).toEqual({
      kind: 'error',
      code: 'X.Y',
      extensions: { confirm: { code: 'X.Y', args: { n: 1 } } },
    });
  });

  it('takes the request id from the problem when the header is not readable', async () => {
    const b = backend(problem(404, { code: 'Auction.NotFound', traceId: 'abc' }));
    const r = await client(b).change({ method: 'POST', path: '/x', body: {} });
    expect(r).toMatchObject({ ok: false, requestId: 'abc', violation: { code: 'Auction.NotFound' } });
  });

  it('maps a 415 without a body and reports the request id of a success', async () => {
    const b = backend(
      new Response(null, { status: 415, headers: { 'tarol-request-id': 'r-1' } }),
      ok(204, undefined, { etag: '"2"', 'tarol-request-id': 'r-2' }),
    );
    const c = client(b);
    expect(await c.change({ method: 'POST', path: '/x', body: {} })).toEqual({
      ok: false,
      status: 415,
      requestId: 'r-1',
      violation: { kind: 'error', code: 'Request.UnsupportedMediaType' },
    });
    expect(await c.change({ method: 'POST', path: '/x', body: {} })).toMatchObject({ ok: true, requestId: 'r-2' });
  });

  it('maps a coded problem with its detail (409 version conflict)', async () => {
    const b = backend(
      problem(409, {
        title: 'Stream.VersionConflict',
        code: 'Stream.VersionConflict',
        detail: 'expected version 1, found 2',
      }),
    );
    const r = await client(b).change({ method: 'POST', path: '/x', body: {} }, { expectedVersion: 1 });
    expect(r).toEqual({
      ok: false,
      status: 409,
      violation: { kind: 'error', code: 'Stream.VersionConflict', detail: 'expected version 1, found 2' },
    });
  });

  it('refreshes once on 401 and repeats the request with the same key and bytes', async () => {
    const b = backend(
      new Response(null, { status: 401, headers: { 'www-authenticate': 'Bearer' } }),
      ok(204, undefined),
    );
    let token = 'old';
    const refresh = vi.fn(() => {
      token = 'new';
      return Promise.resolve(true);
    });
    const c = client(b, { tokens: { token: () => token, tenant: () => 't1', refresh } });
    const r = await c.change({ method: 'POST', path: '/x', body: { a: 1 } });
    expect(r.ok).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(b.calls.map((x) => x.headers['authorization'])).toEqual(['Bearer old', 'Bearer new']);
    expect(b.calls[1]?.headers['idempotency-key']).toBe(b.calls[0]?.headers['idempotency-key']);
    expect(b.calls[1]?.body).toBe(b.calls[0]?.body);
  });

  it('returns Auth.Required for a 401 without a body when refreshing does not help', async () => {
    const b = backend(new Response(null, { status: 401 }), new Response(null, { status: 401 }));
    const r = await client(b, { tokens: { ...tokens(), refresh: () => Promise.resolve(true) } }).change({
      method: 'POST',
      path: '/x',
    });
    expect(r).toEqual({ ok: false, status: 401, violation: { kind: 'error', code: 'Auth.Required' } });
    expect(b.calls).toHaveLength(2);
  });

  it('repeats a network failure with the same key and body, then succeeds', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const b = backend(new TypeError('fetch failed'), new TypeError('fetch failed'), ok(204, undefined));
    const r = await client(b, { sleep }).change({ method: 'POST', path: '/x', body: { a: [1, 2] } });
    expect(r.ok).toBe(true);
    expect(new Set(b.calls.map((c) => c.headers['idempotency-key'])).size).toBe(1);
    expect(new Set(b.calls.map((c) => c.body)).size).toBe(1);
    expect(sleep.mock.calls).toEqual([[250], [500]]);
  });

  it('reports a lasting network failure as code Network with status 0', async () => {
    const b = backend(new TypeError('x'), new TypeError('x'), new TypeError('x'));
    expect(await client(b).change({ method: 'POST', path: '/x' })).toEqual({
      ok: false,
      status: 0,
      violation: { kind: 'error', code: 'Network' },
    });
  });

  it('throws when the caller aborts (an abort is not a business outcome)', async () => {
    const controller = new AbortController();
    controller.abort();
    const b = backend(new DOMException('aborted', 'AbortError'));
    await expect(client(b).change({ method: 'POST', path: '/x' }, { signal: controller.signal })).rejects.toThrow(
      'aborted',
    );
    expect(b.calls).toHaveLength(1);
  });

  it('notifies change listeners and stops after unsubscribe', async () => {
    const b = backend(ok(204, undefined, { 'tarol-position': '5.1' }), ok(204, undefined));
    const c = client(b);
    const seen: unknown[] = [];
    const off = c.onChange((e) => seen.push(e));
    await c.change({ method: 'POST', path: '/a' });
    off();
    await c.change({ method: 'POST', path: '/b' });
    expect(seen).toEqual([{ method: 'POST', path: '/a', position: '5.1' }]);
  });
});

describe('reads', () => {
  const page = { items: [{ id }], next: 'c1' };

  it('revalidates with If-None-Match and reuses the cached value on 304', async () => {
    const b = backend(
      ok(200, page, { etag: 'W/"cbf29ce484222325"', 'cache-control': 'private, no-cache' }),
      new Response(null, { status: 304, headers: { etag: 'W/"cbf29ce484222325"' } }),
    );
    const c = client(b);
    const first = await c.read('/auctions', { query: { limit: 2, settled: false, seller: undefined, sort: null } });
    const second = await c.read('/auctions', { query: { limit: 2, settled: false } });
    expect(b.calls[0]?.url).toBe('http://api/auctions?limit=2&settled=false');
    expect(b.calls[0]?.headers['if-none-match']).toBeUndefined();
    expect(b.calls[1]?.headers['if-none-match']).toBe('W/"cbf29ce484222325"');
    expect(first).toMatchObject({ ok: true, notModified: false, value: page });
    expect(second).toMatchObject({ ok: true, notModified: true, status: 304, value: page });
  });

  it('reads the version of a view from its strong ETag', async () => {
    const b = backend(ok(200, { id }, { etag: '"4"' }), new Response(null, { status: 304 }));
    const c = client(b);
    expect(await c.read(`/auctions/${id}`)).toMatchObject({ version: 4 });
    expect(await c.read(`/auctions/${id}`)).toMatchObject({ version: 4, notModified: true });
  });

  it('never shares a cache entry between tenants', async () => {
    let tenant = 'a';
    const b = backend(ok(200, page, { etag: 'W/"1"' }), ok(200, page, { etag: 'W/"2"' }));
    const c = client(b, { tokens: { token: () => 't', tenant: () => tenant } });
    await c.read('/auctions');
    tenant = 'b';
    await c.read('/auctions');
    expect(b.calls[1]?.headers['if-none-match']).toBeUndefined();
  });

  it('sends the newest own position as Tarol-Read-After and reports Tarol-Stale', async () => {
    const b = backend(
      ok(204, undefined, { 'tarol-position': '10.2' }),
      ok(204, undefined, { 'tarol-position': '9.9' }),
      ok(200, page, { 'tarol-stale': 'true' }),
    );
    const c = client(b);
    await c.change({ method: 'POST', path: '/a' });
    await c.change({ method: 'POST', path: '/b' });
    expect(c.position).toBe('10.2');
    const r = await c.read('/auctions');
    expect(b.calls[2]?.headers['tarol-read-after']).toBe('10.2');
    expect(r).toMatchObject({ ok: true, stale: true });
  });

  it('reads after a given position (a pushed message), the later of it and the own one, and ignores a non-position', async () => {
    const b = backend(
      ok(200, page),
      ok(204, undefined, { 'tarol-position': '10.2' }),
      ok(200, page),
      ok(200, page),
      ok(200, page),
    );
    const c = client(b);
    await c.read('/auctions', { readAfter: '7.1' });
    expect(b.calls[0]?.headers['tarol-read-after']).toBe('7.1');
    await c.change({ method: 'POST', path: '/a' });
    await c.read('/auctions', { readAfter: '9.9' }); // older than the own change
    expect(b.calls[2]?.headers['tarol-read-after']).toBe('10.2');
    await c.read('/auctions', { readAfter: '11.1' });
    expect(b.calls[3]?.headers['tarol-read-after']).toBe('11.1');
    await c.read('/auctions', { readAfter: '11.1\r\nx-evil: 1' });
    expect(b.calls[4]?.headers['tarol-read-after']).toBe('10.2');
  });

  it('waits for Retry-After while a projection is building, then answers', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const b = backend(
      problem(503, { code: 'Projection.Building', title: 'Projection.Building' }, { 'retry-after': '5' }),
      ok(200, page),
    );
    const r = await client(b, { sleep }).read('/auctions');
    expect(sleep).toHaveBeenCalledWith(5000);
    expect(r.ok).toBe(true);
  });

  it('returns other 503 problems without waiting', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const b = backend(problem(503, { code: 'Search.Building' }));
    expect(await client(b, { sleep }).read('/search')).toMatchObject({
      ok: false,
      violation: { code: 'Search.Building' },
    });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('drops the least recently used entry beyond cacheSize', async () => {
    const b = backend(
      ok(200, 1, { etag: '"1"' }),
      ok(200, 2, { etag: '"1"' }),
      new Response(null, { status: 304 }),
      ok(200, 3, { etag: '"1"' }),
      ok(200, 2, { etag: '"1"' }),
    );
    const c = client(b, { cacheSize: 2 });
    await c.read('/a');
    await c.read('/b');
    await c.read('/a'); // /a is now the most recently used
    await c.read('/c'); // evicts /b
    await c.read('/b');
    expect(b.calls[4]?.headers['if-none-match']).toBeUndefined();
  });

  it('invalidates by path prefix', async () => {
    const b = backend(
      ok(200, 1, { etag: '"1"' }),
      ok(200, 1, { etag: '"1"' }),
      ok(200, 1, { etag: '"1"' }),
      ok(200, 1),
    );
    const c = client(b);
    await c.read('/auctions');
    await c.read('/bids');
    c.invalidate('/auctions');
    await c.read('/bids');
    await c.read('/auctions');
    expect(b.calls[2]?.headers['if-none-match']).toBe('"1"');
    expect(b.calls[3]?.headers['if-none-match']).toBeUndefined();
  });

  it('maps a 400 on list parameters', async () => {
    const b = backend(problem(400, { errors: { limit: ['Range'] } }));
    expect(await client(b).read('/auctions', { query: { limit: 500 } })).toEqual({
      ok: false,
      status: 400,
      violation: { kind: 'invalid', errors: { limit: ['Range'] }, details: { limit: [{ code: 'Range' }] } },
    });
  });

  it('maps an unknown list key as a field error Unknown', async () => {
    const b = backend(
      problem(400, {
        errors: { selller: ['Unknown'] },
        errorDetails: { selller: [{ code: 'Unknown', detail: 'not a filter, sort or paging key of this list' }] },
      }),
    );
    const r = await client(b).read('/auctions', { query: { selller: 'x' } });
    expect(r).toMatchObject({
      ok: false,
      violation: { kind: 'invalid', errors: { selller: ['Unknown'] }, details: { selller: [{ code: 'Unknown' }] } },
    });
  });
});

describe('helpers', () => {
  it('compares positions by transaction, then position', () => {
    expect(comparePositions('10.2', '9.9')).toBeGreaterThan(0);
    expect(comparePositions('10.2', '10.10')).toBeLessThan(0);
    expect(comparePositions('18446744073709551615.1', '18446744073709551615.1')).toBe(0);
    expect(comparePositions('x', '1.1')).toBeLessThan(0);
  });

  it('falls back to a status code for bodies that are not problems', () => {
    expect(toViolation(403, null)).toEqual({ kind: 'error', code: 'Auth.Forbidden' });
    expect(toViolation(418, 'teapot')).toEqual({ kind: 'error', code: 'Http.418' });
    expect(toViolation(400, { errors: { a: ['X', 1] } })).toEqual({
      kind: 'invalid',
      errors: { a: ['X'] },
      details: { a: [{ code: 'X' }] },
    });
    // a detail for a code the errors do not list is dropped; a malformed detail is ignored
    expect(
      toViolation(400, {
        errors: { a: ['X'] },
        errorDetails: {
          a: [
            { code: 'Y', detail: '1' },
            { code: 'X', detail: 2 },
          ],
        },
      }),
    ).toEqual({ kind: 'invalid', errors: { a: ['X'] }, details: { a: [{ code: 'X' }] } });
  });

  it('accepts only D-format UUIDs as ids', () => {
    expect(isId(id)).toBe(true);
    expect(isId(`{${id}}`)).toBe(false);
    expect(asId<'Auction'>(id)).toBe(id);
    expect(() => asId('nope')).toThrow(TypeError);
  });
});

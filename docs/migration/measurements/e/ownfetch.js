export async function send(method, path, body, headers = {}) {
  const r = await fetch(path, { method, headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.ok) return { ok: true, value: r.status === 204 ? undefined : await r.json(), etag: r.headers.get('etag') };
  const p = r.headers.get('content-type')?.includes('problem') ? await r.json() : {};
  return r.status === 400 && p.errors ? { ok: false, kind: 'invalid', errors: p.errors } : { ok: false, kind: 'error', status: r.status, code: p.code, detail: p.detail };
}
send('POST', '/orders', { a: 1 }).then(console.log);

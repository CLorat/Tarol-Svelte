// Measures what a UI client sees when it re-reads right after a push (docs/review/frontend-ease.md §B). Needs the sample
// (`ARTFLOW_STAY_UP=1 samples/Sagas/apphost.sh`) and a built tarol-client (`pnpm build`).
// usage: node docs/migration/measurements/review-push-race.mjs <list|view|list-after> [count=20] [delay ms before the read=0]
// list-after sends `Tarol-Read-After: <the message's position>` (BC-23, Tarol-Net #115)
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectPush } from '../../../packages/tarol-client/dist/push.js';

const [what = 'list', count = '20', delay = '0'] = process.argv.slice(2);
const api = process.env['TAROL_E2E_URL'] ?? 'http://localhost:5080';
const issuer = process.env['TAROL_E2E_ISSUER'] ?? 'http://localhost:8080';
const z = process.env['TAROL_E2E_ZITADEL'] ?? join(tmpdir(), 'artflow-zitadel');
const project = readFileSync(join(z, 'project.txt'), 'utf8').trim();

async function token(user) {
  const line = readFileSync(join(z, 'clients.txt'), 'utf8').split('\n').find((l) => l.startsWith(`client ${user} `)) ?? '';
  const [, , id, secret] = line.split(' ');
  const scope = `openid urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner urn:zitadel:iam:org:project:id:${project}:aud`;
  const r = await fetch(`${issuer}/oauth/v2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  });
  return (await r.json()).access_token;
}
const call = async (t, method, path, body, readAfter) => {
  const r = await fetch(api + path, {
    method,
    headers: {
      authorization: `Bearer ${t}`,
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
      ...(readAfter ? { 'tarol-read-after': readAfter } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r.status === 204 ? null : r.json();
};

const alice = await token('alice');
const bob = await token('bob');
const waiting = new Map();
let fresh = 0;
let stale = 0;
let sample;
const push = connectPush({ url: `${api}/tarol/messages`, tokens: { token: () => bob, tenant: () => '-' } });
push.subscribe('artflow.bid-placed', async (m) => {
  sample ??= m;
  await new Promise((r) => setTimeout(r, Number(delay)));
  const row =
    what === 'view'
      ? await call(bob, 'GET', `/auctions/${m.subject}`)
      : (
          await call(bob, 'GET', '/auctions?sort=OpenedAt&limit=50', undefined, what === 'list-after' ? m.position : undefined)
        ).items.find((r) => r.id === m.subject);
  if (row && row.bids >= 1) fresh++;
  else stale++;
  waiting.get(m.subject)?.();
});
await new Promise((r) => setTimeout(r, 1500)); // connected and subscribed
for (let i = 0; i < Number(count); i++) {
  const a = await call(alice, 'POST', '/auctions', { reserve: 10 });
  await new Promise((r) => setTimeout(r, 300)); // the creation has reached the list
  await new Promise((done) => {
    waiting.set(a.id, done);
    void call(bob, 'POST', `/auctions/${a.id}/bids`, { amount: 20 });
  });
}
console.log(JSON.stringify({ what, count: Number(count), delay: Number(delay), fresh, stale, message: sample }));
push.close();

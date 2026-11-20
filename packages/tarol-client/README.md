# @clorat/tarol-client

Framework-free TypeScript client for [Tarol](https://github.com/CLorat/Tarol-Net) backends. Changes and reads return a
`Result` (the value, or the backend's violation), never an exception for a business failure. Every change carries an
idempotency key, reads revalidate with ETags, and your own writes are visible to your next list read. The UI push client
reconnects forever.

```ts
import { createClient, type Page } from '@clorat/tarol-client';

const tarol = createClient({ baseUrl: '/api', tokens }); // tokens: a TokenProvider, e.g. from @clorat/tarol-oidc

const created = await tarol.change<{ id: string; version: number }>({ method: 'POST', path: '/auctions', body: { reserve: 100 } });
if (!created.ok && created.violation.kind === 'invalid') console.log(created.violation.errors['reserve']); // ['Range']

const page = await tarol.read<Page<AuctionRow>>('/auctions', { query: { limit: 20 } }); // 304 → cached value
```

```ts
import { connectPush } from '@clorat/tarol-client/push';

const push = connectPush({ url: '/api/tarol/messages', tokens });
const off = push.subscribe('artflow.bid-placed', (m) => console.log(m.data));
push.onReconnect(() => tarol.invalidate('/auctions')); // the hub has no replay: refetch after a reconnect
```

| What | Behaviour |
|---|---|
| Changes | `Idempotency-Key` (new UUID, or yours to retry one intent); `If-Match` from `expectedVersion`; network failures retried with the same key and bytes |
| Results | `Ok` (`value`, `version`, `position`, `replayed`, `stale`, `notModified`, `requestId`) or `Failed` (`violation`: `invalid` with field paths and their `details`, or `error` with the code; `requestId` from `Tarol-Request-Id` or the problem's `traceId`) |
| Reads | ETag cache per tenant and URL, `Tarol-Read-After` after your own changes, waits out `Projection.Building` |
| Auth | a `TokenProvider` port; a 401 triggers one `refresh()` and one repeat |
| Push | SignalR JSON protocol over WebSocket, the token in `?access_token=`; re-subscribes after every reconnect (also when the hub closes an expired token's connection); never stops reconnecting until `close()`; refusals as `HubRefusal` codes (`Hub.Forbidden`, `Hub.Topic`, `Auth.Tenant`) |

Size (gzip): core 2.09 KB, `/push` 1.51 KB. No dependencies. ESM only.

Licence: AGPL-3.0-only, or a commercial licence from the copyright holder.

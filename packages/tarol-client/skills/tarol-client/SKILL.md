---
name: tarol-client
description: >-
  Use when calling a Tarol backend from TypeScript without Svelte: changes (POST/PUT/PATCH/DELETE), views and keyset
  lists, field errors, version conflicts, idempotent retries, or the UI push hub /tarol/messages. Covers createClient,
  change, read, Result/Violation, Id, Page, TokenProvider and connectPush from @clorat/tarol-client. Do not hand-write
  fetch calls, parse problem JSON yourself, or install @microsoft/signalr.
---

# Tarol client (`@clorat/tarol-client`)

## Rules

1. Create one client per app: `createClient({ baseUrl, tokens })`. `tokens` is a `TokenProvider`
   (`token()`, `tenant()`, optional `refresh()`); the tenant is part of every cache key.
2. Every call returns `Result<T>`: check `r.ok`. Business failures are values: `r.violation.kind === 'invalid'`
   (`errors` maps backend field paths such as `lines[1].quantity` to codes such as `Range`) or `'error'` (`code` such as
   `Auction.NotSeller`, `Stream.VersionConflict`, `Idempotency.KeyReused`, `Auth.Required`, `Network`). Only an aborted
   request throws.
3. Changes get an idempotency key automatically. To retry **the same user intent**, pass the same `key`; a replay
   answers `ok` with `replayed: true`. Never reuse a key for a different body (422 `Idempotency.KeyReused`).
4. Optimistic concurrency: pass `expectedVersion` (sends `If-Match`); the new version is `r.version`. A stale version is
   409 `Stream.VersionConflict`: reload, then let the user decide.
5. Lists are keyset-paged: pass `next` from the previous `Page` as `after`. There is no offset paging in this client.
6. Reads revalidate by ETag automatically (`notModified: true` on a 304). After your own change the next read sends
   `Tarol-Read-After`; do not sleep or poll to see your write.
7. Push: `connectPush({ url, tokens })` from `@clorat/tarol-client/push`. Subscriptions survive reconnects. The hub has no
   replay, so refetch in `onReconnect`. Topics are `<system>.<name>`.

## Example

```ts
import { createClient, type Created, type Page } from '@clorat/tarol-client';

const tarol = createClient({ baseUrl: '/api', tokens });

const r = await tarol.change<Created>({ method: 'POST', path: '/auctions', body: { reserve: 100 } });
if (r.ok) {
  const bid = await tarol.change(
    { method: 'POST', path: `/auctions/${r.value.id}/bids`, body: { amount: 150 } },
    { expectedVersion: r.value.version },
  );
  if (!bid.ok && bid.violation.kind === 'error' && bid.violation.code === 'Stream.VersionConflict') {
    // reload the auction and show the new state
  }
} else if (r.violation.kind === 'invalid') {
  showFieldErrors(r.violation.errors); // { reserve: ['Range'] }
}

const first = await tarol.read<Page<AuctionRow>>('/auctions', { query: { sort: 'HighestBid', limit: 20 } });
if (first.ok && first.value.next) await tarol.read<Page<AuctionRow>>('/auctions', { query: { sort: 'HighestBid', limit: 20, after: first.value.next } });
```

## Common mistakes

| Mistake | What happens |
|---|---|
| `try { … } catch` around a change to catch a 400/409 | nothing is thrown; the failure is in `r.violation` |
| a new `key` per retry of the same submit | the backend may apply the intent twice |
| `query: { offset: 40 }` | works on the backend, but breaks keyset paging and is capped at 1000; use `after` |
| `limit: 500` | `{ kind: 'invalid', errors: { limit: ['Range'] } }` (1–200) |
| a topic without a dot (`bids`) | `TypeError: not a topic` before anything is sent |
| `{@html}` of server text | never do it; render text |

## Notes

* No dependencies; ESM only; nothing runs at import, so it is safe outside a browser.
* Ids are `Id<'Auction'>` (branded UUID strings): `asId<'Auction'>(s)` throws a `TypeError` for anything else.
* `Option<T>` members arrive as `T | null`.

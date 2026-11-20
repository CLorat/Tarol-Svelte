# Step 2: `@clorat/tarol-client` (framework-free client core)

> **Since step 12** ([backend-fixes.md](backend-fixes.md), 2026-11-20): Tarol-Net #91 closed BC-1 … BC-17 and the client
> removed every limitation this note records as waiting for one (push against the real hub, hub codes, request ids, field details: A1, B2). The text below is the state of its step.

## 1. Inventory: what the core must speak

Taken from [overview.md](../architecture/overview.md), which cites the Tarol-Net files:

* **Writes**: creation → 201 `{id, version}` (+ `Location`, `ETag`, `Tarol-Position`), replay 200 + `Idempotent-Replayed`;
  change → 204 + `ETag` + `Tarol-Position`; headers `Idempotency-Key` (1–255 chars), `If-Match: "<n>"`.
* **Reads**: view → 200 + strong `ETag` (304 on `If-None-Match`); list → `{items, next, total?}` + weak `ETag`,
  `Tarol-Position`, `Tarol-Stale`; `Tarol-Read-After: <tx>.<pos>` on the request; 503 `Projection.Building` + `Retry-After`.
* **Problems**: 400 `{errors: {path: [code]}}`; others `{title, code, detail?}`; 401 has no body.
* **Push**: hub `/tarol/messages`, SignalR JSON protocol, `Subscribe`/`Unsubscribe`/`Publish`, callback `message`; no replay;
  re-subscribe after every reconnect; never stop reconnecting (#71).

All of it was checked against the running sample on 2026-11-19 [verified]:

```
POST /auctions (Idempotency-Key k-1)             → 201, ETag "1", Location, Tarol-Position 1798.2, {"id":"01a1…","version":1}
same again                                       → 200, Idempotent-Replayed: true (no Tarol-Position)
same key, other body                             → 422 {"title":"Idempotency.KeyReused","code":"Idempotency.KeyReused",…}
{"reserve":"x"}                                  → 400 {"errors":{"reserve":["Json"]}}
no token                                         → 401, Content-Length 0, WWW-Authenticate: Bearer
GET /auctions?limit=500                          → 400 {"errors":{"limit":["Range"]}}
GET /auctions?limit=2&count=true                 → 200, Cache-Control: private, no-cache, ETag W/"cbf29ce484222325", Vary: Authorization
```

## 2. Candidates, with measurements

Minimum of 1 build (sizes are deterministic); esbuild minify through Vite 7.3.8, gzip level 9 and brotli quality 11 via
Node's zlib ([measurements/README.md](measurements/README.md)):

| Candidate | What it covers | gzip | brotli |
|---|---|---|---|
| hand-written transport (prototype `ownfetch.js`) | fetch, JSON, idempotency key, problem → violation | 0.41 KB | 0.35 KB |
| `openapi-fetch` 0.17.0 | typed fetch only; no idempotency, ETag or problems | 3.62 KB | 3.12 KB |
| own SignalR JSON client (prototype `ownhub.js`) | negotiate, handshake, invoke, ping, reconnect, re-subscribe | 0.89 KB | 0.78 KB |
| `@microsoft/signalr` 11.0.0 | all transports, automatic reconnect (gives up by default) | 19.88 KB | 17.11 KB |

Decided: own transport (SV-4) and own push client (SV-8). Budget: core ≤ 3 KB, `/push` ≤ 2 KB (SV-15).

## 3. Design

```ts
import { createClient, type Id } from '@clorat/tarol-client';

const tarol = createClient({ baseUrl: '/api', tokens });         // tokens: TokenProvider (port; tarol-oidc implements it)

const created = await tarol.change({ method: 'POST', path: '/auctions', body: { reserve: 100 } });
if (created.ok) created.value.id;                                // Ok<Created> | Failed
else if (created.violation.kind === 'invalid') created.violation.errors['reserve'];

const page = await tarol.read<Page<AuctionRow>>('/auctions', { query: { settled: false, limit: 20 } });
```

* **Result, never an exception, for business outcomes**: `Result<T> = Ok<T> | Failed`, with
  `Failed = { ok: false; violation: Violation; status: number }` and `Violation = Invalid | Problem` (overview.md).
  A network failure is `Problem` with `code: 'Network'`; an aborted request (`AbortSignal`) throws, as `fetch` does.
* **Idempotency**: every change gets a key (`crypto.randomUUID()`) unless the caller passes one. The transport retries a
  network failure up to 2 times **with the same key and the same body bytes** (the backend fingerprints the raw body), so a
  retry can never double-apply. A replay (200 + `Idempotent-Replayed`) is reported as `Ok` with `replayed: true`.
* **Versions**: `expectedVersion: n` sends `If-Match: "n"`; the new version comes back from the `ETag`.
* **Read after write**: the client keeps the highest `Tarol-Position` of its own writes (compared as `tx` then `pos`) and
  sends it as `Tarol-Read-After` on list reads; `Tarol-Stale: true` is exposed as `stale` on the result.
* **ETag cache**: an LRU `Map` (default 200 entries) keyed by `tenant + ' ' + url`; a read sends `If-None-Match` when cached;
  a 304 returns the cached value, with `fresh: false` never shown to the caller as an error. The tenant comes from
  `tokens.tenant()` so two tenants never share an entry. `invalidate(prefix)` drops entries (used by push and changes).
* **Auth**: `TokenProvider = { token(): Promise<string | null>; tenant(): string | null; refresh?(): Promise<boolean> }`.
  On a 401 the client calls `refresh()` once and repeats the request (same idempotency key); a second 401 is returned.
* **Projection building**: a 503 `Projection.Building` is retried after `Retry-After` (at most 3 times, through an
  injectable `sleep` so tests use fake timers).
* **traceparent**: a W3C `traceparent` per request (random trace and span ids) so backend traces can be joined.
* **Push (`/push`)**: `connectPush({ url, tokens })` → `{ subscribe(topic, handler) → unsubscribe, publish(topic, data),
  state, close() }`. Rules from Tarol-Net's `MessagePushClient.cs`: subscriptions made before connect are queued; all are
  replayed after every (re)connect; a refused `Subscribe` drops its handlers; the last handler gone → `Unsubscribe`; handlers
  are isolated; delays 0, 1, 2, 5, 10 s with ±20 % jitter, **forever** until `close()` (#71); the token is fetched again
  on every attempt; `onReconnect` callbacks let the data layer revalidate (no replay on the server). Topics are validated
  (`<system>.<name>`, ≤ 200 characters, no `/` or whitespace) before sending.
* **SSR-safe**: no browser global is touched at import; `fetch`, `WebSocket` and `crypto` are taken at call time or
  injected.

## 4. Decisions asked of the owner

SV-4 (own runtime), SV-6 (data layer), SV-8 (own push client), SV-15 (budgets). All answered; see
[decisions.md](decisions.md).

## 5. What the PR must do

* `packages/tarol-client`: `src/index.ts` (client, results, ids, cache), `src/push.ts`; README; skill
  `skills/tarol-client/SKILL.md`; API Extractor report.
* Tests: problem mapping for every status in the inventory; idempotent retry keeps key and bytes; If-Match/ETag; 304 reuse;
  tenant isolation of the cache; Read-After ordering; 401 refresh once; 503 retry with fake timers; push against a fake hub
  (WebSocket double) for handshake, subscribe replay after reconnect, the #71 timeout case, refusal, ping; type tests.
* Contract test against the running sample when `TAROL_E2E=1` (create, replay, conflict, list, 304).
* Budgets: core ≤ 3 KB, `/push` ≤ 2 KB.

## 6. Skill evaluation checklist

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "Create an auction and show the field errors" | `tarol.change(...)`, `violation.kind === 'invalid'`, `errors['reserve']` | `try/catch` around a business failure; reading `response.status` by hand |
| "Retry a change safely" | pass the same `key` | a new key per retry (double apply) |
| "Read a list after my own change" | nothing: Read-After is automatic | sleeping or polling |
| "Listen to bids" | `connectPush(...).subscribe('artflow.bid-placed', h)` | `@microsoft/signalr`; resubscribing by hand after reconnect |

## 7. Public API (new)

Everything is new in this step; the generated reports are `packages/tarol-client/api/tarol-client.api.md` and
`tarol-client-push.api.md`.

* `createClient(options)` → `TarolClient` (`change`, `read`, `url`, `invalidate`, `onChange`, `position`);
  `ClientOptions`, `TokenProvider`, `ChangeRequest`, `ChangeOptions`, `ReadOptions`, `QueryValue`, `Created`, `Page`,
  `ChangeEvent`.
* `Result`, `Ok`, `Failed`, `Violation`, `Invalid`, `Problem`; `toViolation(status, body)`, `fallbackCode(status)`.
* `Id<Of>`, `isId`, `asId`; `comparePositions`.
* `/push`: `connectPush(options)` → `PushClient` (`subscribe`, `publish`, `onReconnect`, `onState`, `state`, `close`);
  `PushOptions` (incl. `onRefused` and `onError`: a throwing handler is reported there, default the browser's
  `reportError`, and the other handlers still run), `PushedMessage`, `PushState`, `isTopic`.

Behaviour decided while building (not in §3): the fallback codes for answers without a problem body are `Auth.Required`
(401), `Auth.Forbidden` (403), `NotFound` (404), `Conflict` (409), `Request.TooLarge` (413), `Request.UnsupportedMediaType`
(415), `Unprocessable` (422), `TooManyRequests` (429), `Unavailable` (503), else `Http.<status>`; `Network` for status 0.

## 8. Verification

* `pnpm verify` green: format, lint (0 warnings), build, typecheck, tests, size, publint + attw + check-deps, API reports,
  eng tests [verified].
* Unit tests: **36** (client 24, push 12), run 5 times in a row, all green; the push tests run on Vitest's fake clock.
  Found while writing them: the fake clock fires a 0 ms timer scheduled inside a tick only after 1 ms, so the #71 test
  steps 1 ms for zero delays (a test detail, not a client behaviour).
* Contract tests against the running sample (`TAROL_E2E=1`, `samples/Sagas` at Tarol-Net `73b35ff`): **6 passed**
  (create 201 / replay 200 `replayed` / 422 `Idempotency.KeyReused`; bid 204 version 2 / stale 409
  `Stream.VersionConflict`; 400 `{reserve:["Json"]}`; 403 on settle by the bidder; view 200 version 1 then 304; list 200
  then 304; 400 `limit:["Range"]`; 401 `Auth.Required`) [verified].
* Size (size-limit 14.3.0, esbuild/rolldown, minified): core **1.96 KB gzip / 1.79 KB brotli** (budget 3 KB); `/push`
  **1.35 KB gzip / 1.23 KB brotli** (budget 2 KB) [verified].
* Checks proven with a deliberate violation (foundation.md): a 1-byte budget → `Package size limit has exceeded by
  1.96 kB`, exit 1; an `exports` target that does not exist → publint `does not exist`, exit 1; a changed public signature
  without `api:update` → API Extractor `You have changed the API signature`, exit 1 [verified].
* API Extractor's `ae-undocumented` is an error (eng/api-extractor.base.json), so every public member is documented.
* Push against a real hub: **not possible yet** (BC-2: the hub ignores `access_token`; BC-9: the sample maps no hub).
* Tarball: 27 files, 19.1 KB, includes `README.md` and `skills/tarol-client/SKILL.md` (3.8 KB) [verified, `npm pack
  --dry-run`].

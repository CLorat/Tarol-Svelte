# Backend fixes: taking up BC-1 … BC-17

Tarol-Net fixed every finding of [../backend/changes.md](../backend/changes.md) in one pull request, #91, merged to `main`
at `fe0a2bd` (CI green; [../backend/tarol-net-reply.md](../backend/tarol-net-reply.md), Tarol-Net
`docs/migration/client-contract.md` with the owner's decisions CC-1 … CC-8). The client still works around the gaps. This
note says, per BC, what the client does today, what changes and which PR does it; then the decisions asked of the owner
(SV-16 …) and the verification of each PR.

Work order for every item: verify the backend behaviour against `fe0a2bd` (code, tests, the running sample), then change
the client, then test it. Every removed limitation gets a test that failed (or was `fixme`) before and passes after.

## 1. What the backend answers now [verified]

Against the sample started with `ARTFLOW_STAY_UP=1 samples/Sagas/apphost.sh samples/Sagas/AppHost/bin/Debug/net11.0`
(Tarol-Net `fe0a2bd`, SDK 11.0.100, Zitadel v4.20.3, 2026-11-20; tokens by client credentials as the script does):

| BC | Request | Answer |
|---|---|---|
| 1 | `OPTIONS /auctions` from `http://localhost:5173`, `POST` with `authorization,content-type,idempotency-key,traceparent` | 204, `Access-Control-Allow-Origin: http://localhost:5173`, `Allow-Headers: Authorization,Content-Type,Idempotency-Key,If-Match,If-None-Match,Tarol-Read-After,traceparent` |
| 1 | `POST /auctions` from that origin | 201, `Access-Control-Expose-Headers: ETag,Location,Tarol-Position,Tarol-Stale,Idempotent-Replayed,Tarol-Request-Id,Retry-After,WWW-Authenticate` |
| 1, 2 | `OPTIONS /tarol/messages/negotiate` from that origin | 204 with the same allowed headers (the push client's negotiate is a cross-origin `POST` with `Authorization`) |
| 2, 9, 12 | the shipped `/push` client (`dist/push.js`) from Node with alice's token: `Subscribe` `billing.secret`, `nosuch.topic`, `artflow.bid-placed`, then a bid by bob | connected; both refusals arrive as `An unexpected error occurred invoking 'Subscribe' on the server. HubException: Hub.Forbidden: Subscribe billing.secret` (the code inside SignalR's wrapper text); the bid pushes `{"auction":…,"amount":500,"at":…}` on `artflow.bid-placed` |
| 3 | `GET /openapi/v1.json` | OpenAPI 3.2.0, 15 operations; `x-tarol-kind` on all (`creation` 1, `change` 2, `view` 1, `list` 2, `search` 1, `admin` 9); `x-tarol-errors` on all; `TarolProblem` on every 4xx except 401; `x-tarol-id: "Auction"` on the 3 `{auction}` path parameters; numbers are plain `number`; search and the admin operations (`TarolAdmin…`) are in the document |
| 4 | the same document | `CreateAuction.reserve`: `minimum 1, maximum 1000000, x-tarol-rules: [{rule: Range, code: Range, min: 1, max: 1000000}]` |
| 5, 9 | `POST /auctions {"reserve":0}` | 400 `errors: {reserve: [Range]}`, `errorDetails: {reserve: [{code: Range, detail: "1..1000000"}]}`, `traceId` = the `Tarol-Request-Id` header |
| 8 | `GET /search?q=<seller>&snippets=true` | hit `{…, "snippet": "400479595473666052", "highlights": [{"start": 0, "length": 18}]}` |
| 10 | admin entry as alice (`tarol-admin`) | `GET dead` 200 `["jobs","reactions"]`; unknown kind 404 `Admin.Kind`; redrive / discard of a missing id 404 `Admin.NotFound`; drop of the current projection 409 `Projection.Drop`; export without `?tenant=` 400 `Admin.Tenant`; all `application/problem+json` with `code` and `traceId`; bob 403 |
| 11 | every answer above | `Tarol-Request-Id`; problems carry the same value as `traceId` |
| 14 | `GET /auctions?selller=x` | 400 `errors: {selller: [Unknown]}`, `errorDetails` detail `not a filter, sort or paging key of this list` |
| 16 | `POST /auctions` with a JSON body and no `Content-Type` (and with `text/plain`) | 415, **no body** (the client's fallback code `Request.UnsupportedMediaType` applies) |

Not on the wire as the reply suggests, or new gaps (recorded in changes.md as BC-18 … BC-20):

* **BC-18, browser login**: the PKCE authorize request of `artflow-web` ends on `/ui/v2/login/login` → **404**: Zitadel v4
  requires login v2 (`loginV2.required: true`) and the AppHost runs no login v2 container. Tarol-Net's run checked only the
  302. With the instance feature off, login v1 works: Playwright signs ada in on `/ui/login/login` (name, password, then a
  one-time "2-Factor Setup" with Skip) and Zitadel redirects to `http://localhost:5173/?code=…` [verified, an experiment on
  the running sample, not committed].
* **BC-19**: the creation's 201 `id` has no `x-tarol-id` (hand-written schema in `OpenApiEmitter.cs:438`), so the
  generated `createAuction` keeps `Created<string>`.
* **BC-20**: the subject export documents a 200 without content.
* The rows and the view of the sample use `Guid Id` (`Api/Http.cs:38`, `Worker/AuctionList.cs:10`), so their `id` has no
  `x-tarol-id` by design; only the route value is `Id<Auction>`.

## 2. Per BC: today, the change, the PR

PRs are stacked in this order (each on the one before; retargeted to `main` before its base is merged). The branch of each
is `ccr-b40caadf-18fp3u-<id>`; PR 0 is `ccr-b40caadf-18fp3u` itself.

| PR | Branch suffix | Content |
|---|---|---|
| 0 | — | this note, the reply, BCs closed, BC-18 … BC-20, SV-16 … SV-18 |
| A1 | `a1-client` | `@clorat/tarol-client`: hub refusals by code, request id, `traceId`, `errorDetails`; 415 and `Unknown` covered |
| A2 | `a2-search` | `SearchBox`: snippets as escaped text with the highlight ranges marked |
| B1 | `b1-cors` | the docs app calls `http://localhost:5080` directly; the Vite proxy is gone |
| B2 | `b2-push` | the e2e push scenario; the push guide |
| B3 | `b3-login` | browser login through `@clorat/tarol-oidc` against the PKCE app; the e2e signs in as ada, ben, cleo (needs BC-18) |
| B4 | `b4-expiry` | a real expiry (`ARTFLOW_TOKEN_LIFETIME=30s`): 401, refresh, repeat; the hub's close and the reconnect |
| B5 | `b5-codegen` | `@clorat/tarol-codegen` reads `x-tarol-kind`, `x-tarol-errors`, `x-tarol-id`, `TarolProblem`, `x-tarol-rules`, `x-tarol-email` |
| B6 | `b6-messages` | the server's `errorDetails` on the right field; the 400 on `reserve` from the real API |
| C | `c-admin` | step 10: `@clorat/tarol-admin` |

| BC | The client today | What changes | PR |
|---|---|---|---|
| BC-1 CORS | `apps/docs` calls `/api` on its own origin; `vite.config.ts` proxies it to `:5080` in dev and preview | `baseUrl` `http://localhost:5080` (`VITE_TAROL_API`); no proxy; the e2e proves the preflight and reads `ETag` (`version`) and `Tarol-Position` (`position`) from a cross-origin answer | B1 |
| BC-2 hub token | `/push` already puts `access_token` in the WebSocket URL (`push.ts`, since step 2) [verified by reading]; never run against a real hub from a browser | the e2e push scenario in Chromium; the push guide drops its "waits for BC-2" | B2 |
| BC-3 OpenAPI | `tarol-codegen` guesses the kind from the shape, ignores `x-tarol-errors` and `TarolProblem`, fails on `x-tarol-kind: admin` | kinds from `x-tarol-kind` only (an operation without one is an error); error-code unions per operation; `TarolProblem` mapped to the client's `Violation`; admin operations generated | B5 |
| BC-4 rules | `x-tarol-rules` preferred over keywords already; `check()` builds `new RegExp(p, 'u' + flags)`: `flags: "u"` gives `uu`, a `SyntaxError` | flags merged without duplicates; `x-tarol-email` read; keyword fallback dropped when `x-tarol-rules` exists on the field | B5 |
| BC-5 details | `toViolation` drops `errorDetails`; `FormField` fills `{min}`/`{max}` from the client rule only | `Invalid.details`; the form exposes the server detail; `FormField` shows it ("1..1000000") on the field | A1 (client), B6 (form, field) |
| BC-6 list ETag | nothing to change: the cache now gets a 200 when `next` or `total` changed | — (no client limitation; Tarol-Net's `QueryEndpointTests` pin it) | — |
| BC-7 weak match | nothing to change (the client sends the stored tag verbatim) | — | — |
| BC-8 snippets | `SearchBox` shows titles only and never requests snippets | `snippets=true`; the snippet rendered as text nodes, `<mark>` around each range; never `{@html}`; a test with `<script>` in title and snippet | A2 |
| BC-9 sample | e2e: machine tokens through a test-only `TokenProvider`; push `fixme`; the 400 only by `page.route`; a rejected token stands in for an expired one | human users, real push, real `Range` 400, real expiry | B2, B3, B4, B6 |
| BC-10 admin | step 10 blocked; the e2e subject screen annotates a 500 | step 10 built; erase 200 asserted, 409 `DataProtection.ErasureIncomplete` shown with `failed` and retryable | C |
| BC-11 request id | not read | `Ok.requestId`, `Failed.requestId` (header, else the problem's `traceId`); `ChangeForm` and `QueryState` show "Reference: …" with an error | A1 (client), B6 (components) |
| BC-12 hub codes | `onRefused(topic, reason)` with SignalR's whole text; docs say `Forbidden: Subscribe …` | `onRefused(topic, refusal)` with `{code, detail}` found by `<code>: ` inside the text (`hubRefusal()`); `Hub.Forbidden`, `Hub.Topic`, `Auth.Tenant`, else `Hub.Error` | A1 |
| BC-13 `/me` | the Zitadel preset decodes roles from the token | nothing: no step needs `/me` (SV-17) | — |
| BC-14 unknown keys | a typo in a hand-written read returned unfiltered rows | the 400 `Unknown` is an `Invalid` like any other; a message for `Unknown` in both catalogues; a contract test | A1 |
| BC-15 close on expiry | the push client reconnects after any close and asks the `TokenProvider` again [verified by reading] | an e2e check with 30 s tokens: the hub closes, the client reconnects with a fresh token, a later push arrives | B4 |
| BC-16 415 | the client sends `Content-Type: application/json` with every body [verified by reading `client.ts`] | a unit test for the 415 without body; a contract test that a body without the header is 415 | A1 |
| BC-17 key detail | the detail is never shown (codes are) | — | — |

## 3. Decisions asked of the owner (SV-16 …)

| # | Question | Answer (2026-11-20) |
|---|---|---|
| SV-16 | BC-18: the sample's browser login ends on a 404 (login v2 not running). (a) open a small Tarol-Net PR from this session (login v1 for the sample, no MFA-setup prompt) and run the e2e against that branch until it is merged; (b) the e2e switches the feature off through the setup's admin PAT; (c) wait for Tarol-Net | **(a) a Tarol-Net PR now** (recommended) |
| SV-17 | BC-19 (201 `id` without `x-tarol-id`), BC-20 (export without schema), `/me` not mapped: (a) record as BCs only; the client types what the document says; the admin UI shows the 403 as a message, so no `/me`; (b) fix them in the Tarol-Net PR too; (c) record, and use `/me` | **(a) record only** (recommended) |
| SV-18 | Size budget of `@clorat/tarol-admin` (gzip, without Svelte and the other `@clorat` packages): (a) ≤ 6 KB; (b) ≤ 4 KB; (c) none yet | **(a) ≤ 6 KB gzip** (recommended); gzip and brotli recorded |

Defaults taken without a question (pre-release, nothing published; the owner may revise them in review):
* `PushOptions.onRefused(topic, refusal: HubRefusal)` replaces `onRefused(topic, reason: string)` (breaking); the raw text
  stays in `refusal.message`.
* The request id is `requestId` on `Ok` and `Failed`, from `Tarol-Request-Id`, else the problem's `traceId`.
* An admin operation's kind follows its method in the generated client (GET reads, others are changes without an
  idempotency key requirement; the client still sends one, which the admin entry ignores). An answer without a schema
  (the export, BC-20) is typed `unknown`: the only place the generator emits it, documented in the README.

## 4. Verification and changes per PR

### A1: `@clorat/tarol-client` adopts the new contract

**Public API and behaviour changes** (generated reports `tarol-client.api.md`, `tarol-client-push.api.md`):
* `Invalid.details: Record<path, FieldError[]>` (new, required): the same paths and codes as `errors`, with the backend's
  `errorDetails` detail where given; `FieldError` exported. A detail for a code that `errors` does not list is dropped.
  **Breaking for code that builds an `Invalid` by hand** (tests, fakes): add `details`.
* `Ok.requestId`, `Failed.requestId` (new): `Tarol-Request-Id`, else the problem's `traceId` (BC-11).
* `/push`: `HubRefusal { code, detail, message }` and `hubRefusal(message)` (new); `PushOptions.onRefused(topic,
  refusal: HubRefusal)` and `PushClient.publish(…): Promise<HubRefusal | null>` (**breaking**: were the raw text and
  `'Disconnected'`). The code is the first `Hub.Forbidden: `, `Hub.Topic: ` or `Auth.Tenant: ` inside the text (SignalR
  wraps it, [verified] §1), else `Hub.Error`; not connected is `Hub.Disconnected`.
* `@clorat/tarol-design` catalogues `en`/`de`: `Unknown`, `Request.UnsupportedMediaType`, `Auth.Tenant`, `Hub.Forbidden`,
  `Hub.Topic`, `Hub.Disconnected`, `Hub.Error`.
* `@clorat/tarol-svelte`: a form's `formError` for orphan paths carries their `details` too.

**Found**: the `detail` is free text, not always bounds: the generated rules write `1..1000000`, the paging check writes
`between 1 and 200` (`GET /auctions?limit=500` [verified]). The client passes it through; B6 shows bounds only when the
detail has the `<min>..<max>` form.

**Tests** (failing before, passing after [verified]: 10 of 41 unit tests failed before the change):
`carries the error details, the request id and the trace id of a 400 (BC-5, BC-11)`, `takes the request id from the problem
when the header is not readable`, `maps a 415 without a body (BC-16) and reports the request id of a success`, `maps an
unknown list key as a field error Unknown (BC-14)`, the helper test (details, a detail for another code dropped), and push:
`drops the handlers of a refused subscription and reports the reason` (SignalR's wrapped text), `publishes and resolves
with the hub refusal, or null`, `finds the hub codes inside any text, and falls back to Hub.Error` (the pre-BC-12
`Forbidden:` prefix is no code). Contract tests against the sample (`TAROL_E2E=1`): **8 passed** (new: the `Range` 400 on
`reserve` with detail `1..1000000`, `Unknown` on `selller`, the request id equal to the problem's `traceId`, 415 for a body
without `Content-Type` while the client's own request is 201).

**Verification**: `pnpm verify` green (format, build, lint 0 warnings, typecheck, **154 passed / 13 skipped** tests, size,
package checks, API reports, eng tests). Size: core **2.09 KB gzip / 1.93 KB brotli** (was 1.96 / 1.79; budget 3 KB),
`/push` **1.51 KB / 1.37 KB** (was 1.35 / 1.23; budget 2 KB).

### A2: `SearchBox` shows snippets as text with the matches marked (BC-8)

**Public API and behaviour changes** (generated reports):
* `@clorat/tarol-components`: `SearchBox` asks for `snippets=true` (new prop `snippets`, default `true`) and shows the
  snippet under the title, each highlight range in `<mark>` (**behaviour change**: was the title only); `SearchHit` gets
  `snippet?` and `highlights?`; `highlight(text, highlights)` → `Segment[]` (`{ text, mark }`) and the types `Highlight`,
  `Segment` (new) for apps that render hits themselves. Ranges are UTF-16 code units (a JavaScript string's indexes, as
  the backend writes them); ranges outside the text are cut, overlapping ones merged, empty ones dropped.
* `@clorat/tarol-design`: `Combobox` takes an optional `item(option)` snippet for an option's content (default: the label
  as text).
* Every server text is a text node: no `{@html}` anywhere (the snippet's `<b>` is the document's own text).

**Budget raise (SV-15: a note entry with the measurement)**: `Combobox (with Field)` measured **3.07 KB gzip / 2.70 KB
brotli** with the `item` snippet (2.99 KB before), 68 B over its 3 KB budget; folding the two arrow-key branches into one made it 3 B larger, so the budget is **3.1 KB**. `SearchBox` is **1.69 KB gzip / 1.49 KB brotli** (0.87 /
0.77 KB before; budget 2 KB): the snippet line, the highlight splitting and its CSS.

**Tests** (failing before [verified]: the new test failed on `snippets` not being requested): `shows the snippet as text with
the highlights marked, never as markup (BC-8)`: title and snippet with `<script>`, `<b>` and `<img onerror>` stay text, no
`script`/`b`/`img` element appears, the marks are `<script>` and `Irises` after a 2-unit emoji, an out-of-range range is
ignored, axe 0; `highlight` unit tests (UTF-16 offsets, sorting, merging, cutting, empty). The docs catalogue's demo
client answers snippets as the backend does; the catalogue suite passes (58, axe and CLS in both themes).

**Verification**: `pnpm verify` green (**158 passed / 13 skipped**).

### B1: the docs app calls the API across origins (BC-1)

**Changes**: `apps/docs` (private, not published): `vite.config.ts` has no proxy; `main.ts` takes the API's URL from
`VITE_TAROL_API` (default `http://localhost:5080`, the sample); Playwright's web server builds with `VITE_TAROL_API` =
`TAROL_E2E_URL`. The e2e filters requests by the API's origin instead of `/api`. CI's e2e job checks out Tarol-Net at
`fe0a2bd`. No package changes.

**Tests**: new scenario `the app calls the API on its origin (no proxy), and reads ETag and Tarol-Position across origins
(BC-1)`: alice's create goes to `http://localhost:5080/auctions` and answers 201 with `Access-Control-Allow-Origin:
http://localhost:5173` and the exposed headers; a page script's preflighted `GET` (with `Authorization`) reads `ETag`,
`Tarol-Position` and `Tarol-Request-Id`. Failed before [verified]: the app posted to `/api/auctions` (timeout waiting for
the cross-origin response). After: the artflow project **10 passed, 1 skipped** (push still `fixme`, B2) against the
sample in stay-up mode.

### B2: push in the browser against the real hub (BC-2, BC-9)

**Changes** (`apps/docs` only): signed in, `main.ts` connects `connectPush({ url: <api>/tarol/messages, tokens })` and
passes it to `setTarol`; the auction page's view query is `live: 'artflow.bid-placed'`. The push guide drops "waits for
BC-2/BC-9" and says how the token travels and what happens at expiry. `@clorat/tarol-client/push` needed no change: it
has sent `?access_token=` since step 2 [verified by reading `push.ts`, and against the hub, §1].

**Tests**: the `fixme` scenario is now `a push update: a bid by bob updates alice's open auction (BC-2, BC-9)`: alice's
page opens a WebSocket to `ws://localhost:5080/tarol/messages?…access_token=ey…`, waits for the hub's completion frame of
`Subscribe`, bob bids through the API outside the page, the frame with `artflow.bid-placed` and the auction's id arrives
and the page shows "1 bid" without a reload (events only, no wall clock). Failed before [verified]: no WebSocket was opened
(the app had no push connection; timeout). **Found**: the first version waited for the completion frame after the socket
event and failed twice in a row in the full suite (the frame came first); the test now records every frame from the start
and polls the record. After: the artflow project **11 passed** in three runs in a row, no `fixme` left.

### B3: browser login against the sample's PKCE app (BC-9, BC-18)

Needs Tarol-Net #109 (BC-18): runs against the sample built from its branch (`08d3c66`); CI's e2e job pins that commit
until #109 is merged.

**Changes** (`apps/docs`, tests; no package change):
* `src/auth.ts`: the test-only `TokenProvider` (`window.__tarolE2E`, machine tokens) is **removed**. The app signs in with
  `@clorat/tarol-oidc/zitadel` from `VITE_ZITADEL_*` at build time or `oidc.json` next to the app at run time (one build
  serves every sample run; the PKCE client id is made per run); a "Sign in" / "Sign out" button and the user's subject in
  the header; push connects only when signed in.
* **Found and fixed**: the docs app's hash router read `location` at import, before the login callback restored the
  return path with `history.replaceState` (no event), so after every login and every silent re-login the app showed the
  home page. `router.sync()` runs once after `signIn()`. The e2e of step 8 never logged in through a callback, so it did
  not see it.
* `e2e/fixtures.ts`: `signIn(page, 'ada' | 'ben' | 'cleo', path)` serves `oidc.json` from the sample's setup output, clicks
  "Sign in", fills Zitadel's login page with the run's password from `users.txt` and waits for the user's subject and the
  path. Machine users stay only for test setup through the API.
* `packages/tarol-oidc/test/contract.test.ts`: `not-registered-until-BC-9` is gone; the tests use the real client id.

**Tests**:
* contract (`TAROL_E2E=1`, 5 passed): `signs a human user in with code + PKCE, calls the backend with the token and
  refreshes it (BC-9)` (ada: roles `seller`, `tarol-admin`, `/auctions` 200, admin 200, a refresh-token grant gives a new
  token that works); `gives a bidder no admin rights` (ben: roles `bidder`, admin 403); the authorization request now ends
  on a 200 login page at `/ui/login/login`. Failed before [verified]: against `fe0a2bd` the request ended on a 404 (§1);
  the old test only checked "< 500".
* e2e (12 passed): every scenario signs in in the browser; new `a reload signs in again without the login page
  (prompt=none)`: failed first on the router bug above (signed in, but the home page), passes after the fix; `a rejected
  token` replaces the test-only rejected first token by a token spoiled in transit (`page.route`), and checks that the
  refresh is one real refresh-token grant at Zitadel.

### B4: a real token expiry, and the hub's close at expiry (BC-9, BC-15)

**Changes** (tests and CI only; no package change): CI starts the sample with `ARTFLOW_TOKEN_LIFETIME=30s`, so every
scenario runs with 30-second tokens (the oidc client refreshes at 80 %), and the new scenario sees a real expiry.

**Test** `an expired token: 401, one refresh, the read repeated; the hub closes and reconnects (BC-9, BC-15)`:
* ada signs in on a page whose clock Playwright controls (`page.clock.install()`); after the sign-in the page's time
  stops (`pauseAt`), as in a throttled background tab, so `@clorat/tarol-oidc`'s early refresh does not run and the
  client still trusts a token the server will reject;
* the test polls the API with that token until the **server** answers 401 (`invalid_token`; an event, not a fixed wait)
  and until the hub has **closed** the page's WebSocket (BC-15);
* the page reads an auction: **401 with the expired token, one refresh-token grant at Zitadel, the read repeated, 200**;
* the clock runs again: the push client's reconnect takes the refreshed token (a new `access_token` in the WebSocket URL)
  and bob's bid arrives over the new connection.

It skips itself with a reason when the sample's tokens live longer than 120 s. Before, the scenario used a token the API
rejects as a stand-in (still there as `a rejected token`, which works with any lifetime). Runs [verified]: 31.6 s alone;
the artflow project **13 passed** twice in a row against the sample started with `ARTFLOW_TOKEN_LIFETIME=30s` (`access token
lifetime: 30 s`), all scenarios with 30-second tokens; the client and oidc contract tests pass with them too (the codegen
contract test fails on the drift of the live document, which B5 regenerates).

### B5: the generator reads Tarol's extensions (BC-3, BC-4)

**Public API and behaviour changes**:
* `@clorat/tarol-codegen` (generated reports): `x-tarol-kind` is **required** (no guessing from the responses; an
  operation without it is a `GenerateError`); kinds `admin` (GET → read, others → change with the 200 type) and `me`;
  `x-tarol-errors` → `<Op>Code` unions in the results and `errors.<op>` lists; `x-tarol-id` also on **path parameters**
  (where Tarol puts it; the sample's `{auction}` becomes `AuctionId`); `TarolProblem` is not generated (the client's
  `Violation`); required query values are required; a change's query values (`tenant`) are part of its input and sent by
  a `qs()` helper; query types are type aliases (assignable to the client's query record without a cast); `Required` is
  kept next to `x-tarol-rules` (before, a field with `x-tarol-rules` lost it: `reserve` would have lost `Required`); an
  unknown rule kind is a `GenerateError`; `x-tarol-email` must be the check `isEmail` implements (`emailRule`, exported),
  else a `GenerateError`; an admin answer without a schema (the export, BC-20) is `unknown`, the only one. New exports:
  `emailRule`; `Operation['x-tarol-errors']`, `Schema['x-tarol-email']`, `Parameter['x-tarol-id']`.
* `@clorat/tarol-client`: `Result<T, C>`, `Failed<C>`, `Violation<C>`, `Problem<C>` take the backend's codes as an optional
  type parameter (default `string`, so nothing changes for existing code); `ClientCode` (exported) types the client's own
  codes, `fallbackCode` returns it. `TarolClient` is unchanged (a first version made `change`/`read` generic in `C`, which
  broke every hand-written client double, e.g. the docs app's demo client; the generated calls narrow by an assertion
  instead).
* `@clorat/tarol-svelte`: `check()` merges a rule's `flags` with its own `u` once (**fix**: `flags: "u"`, which the backend
  emits for `\p{…}`, made `new RegExp(…, 'uu')` throw a `SyntaxError`).
* `apps/docs`: regenerated client (16 operations: admin and search included); the auction page takes an `AuctionId`,
  branded once from the route (`isId`/`asId`), "Not found" for anything else.

**Lint configuration**: `@typescript-eslint/consistent-type-definitions` off for generated files (`apps/*/src/**/api.ts`,
`packages/*/src/**/api.ts`, the codegen snapshot): the query types must be type aliases (an interface needs an index
signature to be assignable to the client's query record, and an index signature would accept a misspelt key, BC-14).

**Snapshot**: the fixture is the live document of the sample at `fe0a2bd` (+ #109, which changes no API), the snapshot
regenerated from it and reviewed (`__snapshots__/artflow.ts`).

**Tests** (failing before [verified]): the codegen contract test `the live document generates exactly the committed
snapshot (no drift)` failed against `fe0a2bd`; the new suite `Tarol extensions (BC-3, BC-4)` failed to load (`unknown kind
me`); `takes the flags of x-tarol-rules` failed with `Invalid flags supplied to RegExp constructor 'uu'`. After: codegen
**17 passed** (5 new: error unions and lists, admin and `me` operations with required query values and the `unknown`
export, `Required` with `x-tarol-rules`, flags, the e-mail check, no `TarolProblem`, `x-tarol-kind` required, and the
compile check), the sample's usage compiles with `@ts-expect-error` on a foreign code and on a plain string id; contract
**2 passed** against the sample.

**Measured** (Vite 8 library build, minified, `@clorat/*` external, gzip 9 / brotli 11): the generated module for the
sample is **5,297 B, 1,340 B gzip, 1,171 B brotli** for 16 operations (the step 5 document's 6 operations: 1,452 B, 540 B
gzip, 476 B brotli with the same build); ≈ 84 B gzip per operation; `errors` is a separate export (tree-shaken when
unused).


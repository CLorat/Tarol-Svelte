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


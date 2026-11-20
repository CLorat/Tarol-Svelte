# Tarol-Net's answer to the backend changes (2026-11-20)

Tarol-Net worked through [changes.md](changes.md) (BC-1 … BC-17) in **one pull request,
[#91](https://github.com/CLorat/Tarol-Net/pull/91)**, on top of `main` at `73b35ff` (it combines the per-item PRs #92 … #108,
now closed; the commits stay one per item).
Its evaluation note is Tarol-Net `docs/migration/client-contract.md`: the check of each finding, the fix, the owner's decisions
CC-1 … CC-8 and the verification of each PR. **Merged** to `main` at `fe0a2bd` (CI green), so every BC below is closed (changes.md); each client
step that waited for one removes its limitation ([../migration/backend-fixes.md](../migration/backend-fixes.md)). The "item PR" column names the closed per-item PR, whose description
still explains that item.

| BC | Item PR (in #91) | What the client gets (wire and API) | Owner decision |
|---|---|---|---|
| BC-1 CORS | [#98](https://github.com/CLorat/Tarol-Net/pull/98) | `TarolHeaders.Allowed` / `Exposed` and `CorsPolicyBuilder.WithTarolHeaders()`; the sample allows `http://localhost:5173` | — |
| BC-2 hub token in the query | [#99](https://github.com/CLorat/Tarol-Net/pull/99) | `?access_token=<JWT>` on `/tarol/messages` (only there; `ZitadelOptions.HubPath`) | CC-2: `AddZitadel` option |
| BC-3 OpenAPI | [#100](https://github.com/CLorat/Tarol-Net/pull/100) | `TarolProblem` component on every problem; `x-tarol-kind` (`creation`, `change`, `view`, `list`, `search`, `admin`, `me`); `x-tarol-errors` (Tarol's codes and the domain's literal `Error.*` codes); `x-tarol-id`; `Tarol-Position`, `Idempotent-Replayed`, `Tarol-Stale` headers; `number` instead of `["number","string"]`; `Option<T>` as `T \| null`; search and admin in the document | — |
| BC-4 validation metadata | [#108](https://github.com/CLorat/Tarol-Net/pull/108) | `x-tarol-rules: [{rule, code, min?, max?, pattern?, flags?}]` on value objects, members of multi-field value objects and `IValidatable` inputs, `Count`; `flags: "i"` (`IgnoreCase`), `"u"` (`\p{…}`); `x-tarol-email` (the exact `[Email]` check); TVAL010 warns on patterns `RegExp` reads differently. `\d`/`\w` stay Unicode in .NET, ASCII in JS (documented, not reported) | CC-4 |
| BC-5 field error details | [#102](https://github.com/CLorat/Tarol-Net/pull/102) | `errorDetails: {path: [{code, detail?}]}` next to `errors`; the detail of the generated rules is the bounds (`"3..60"`) | CC-4 |
| BC-6 list ETag | [#92](https://github.com/CLorat/Tarol-Net/pull/92) | the tag covers `next` and `total`: a grown last page answers 200 | CC-3: `next` and `total` |
| BC-7 weak `If-None-Match` | [#93](https://github.com/CLorat/Tarol-Net/pull/93) | views, lists and search: weak comparison, lists of tags, `*` | — |
| BC-8 search snippets | [#94](https://github.com/CLorat/Tarol-Net/pull/94) | **breaking**: `snippet` is plain text; `highlights: [{start, length}]` in UTF-16 code units. Render the text escaped, never `{@html}` | CC-1: text + offsets |
| BC-9 sample for e2e | [#101](https://github.com/CLorat/Tarol-Net/pull/101) | `ARTFLOW_STAY_UP=1 samples/Sagas/apphost.sh <AppHost dir>`; PKCE app `artflow-web` (`$TMPDIR/artflow-zitadel/web.txt`), human users ada (seller, tarol-admin), ben, cleo (bidder) with per-run passwords (`users.txt`); hub topic `artflow.bid-placed`; `POST /auctions {"reserve":0}` → 400 `errors.reserve: ["Range"]`; `ARTFLOW_TOKEN_LIFETIME=30s` → 401 `invalid_token` after expiry and the hub closes; an erasure through the admin entry completes (#97 fixed its search participant). Ports: API 5080, Zitadel 8080, dashboard 18888 | — |
| BC-10 admin problems | [#95](https://github.com/CLorat/Tarol-Net/pull/95) | **breaking**: admin errors are problems with `code` (`Admin.Query`, `Admin.Tenant`, `Admin.Kind`, `Admin.NotFound`, `Projection.Drop`, `DataProtection.ErasureIncomplete` = 409 with `failed`); `GET {admin}/dead` lists the kinds; admin operations in OpenAPI (#100) | — |
| BC-11 request id | [#104](https://github.com/CLorat/Tarol-Net/pull/104) | `Tarol-Request-Id` on every answer (exposed by CORS) and `traceId` in every problem, the same value | CC-6 |
| BC-12 hub error codes | [#105](https://github.com/CLorat/Tarol-Net/pull/105) | **breaking**: `Hub.Forbidden: …`, `Hub.Topic: …`, `Auth.Tenant: …` (`<code>: <detail>`); the code may sit inside SignalR's wrapper text, so search for `<code>: ` | CC-7 |
| BC-13 `GET /me` | [#106](https://github.com/CLorat/Tarol-Net/pull/106) | opt-in `MapTarolMe()`: `{subject, actor: {kind, id}, tenant, roles}` (not mapped in the sample yet) | CC-8: opt-in |
| BC-14 unknown list keys | [#103](https://github.com/CLorat/Tarol-Net/pull/103) | **behaviour**: 400 `errors.<key>: ["Unknown"]` instead of an unfiltered page; keys compare without case | CC-4 |
| BC-15 close on expiry | [#99](https://github.com/CLorat/Tarol-Net/pull/99) | the hub closes a connection when its token expires (`UiPushOptions.CloseOnAuthenticationExpiration`, default on): reconnect with a fresh token | — |
| BC-16 415 | [#96](https://github.com/CLorat/Tarol-Net/pull/96) | routing already gave 415 for another type; now also a JSON body **without** `Content-Type`. Always send `Content-Type: application/json` with a body | — |
| BC-17 key detail | [#96](https://github.com/CLorat/Tarol-Net/pull/96) | `Idempotency.KeyReused` (and `DuplicateKey`) `detail` is the key only | — |

Also in the stack, of interest to the client:
* [#91](https://github.com/CLorat/Tarol-Net/pull/91): the evaluation note, and a fix for `main` (the Changes integration tests did not compile).
* [#97](https://github.com/CLorat/Tarol-Net/pull/97): the erasure's search participant failed in the API process (found while
  running the sample; the sample's erase answered 409 before it).
* [#107](https://github.com/CLorat/Tarol-Net/pull/107): TWEB007, an `Option<T>` member with a default (the OpenAPI document
  threw on it; CC-5).
* `ZitadelOptions.ClockSkew` (#101): JwtBearer accepted an expired token for 5 minutes; the sample sets 0 with short tokens.

Not changed (the client keeps its handling): `If-Match` stays strong-only (400 `If-Match: Format` for `W/"2"`); `GET /me` is
not in the sample's API (add `app.MapTarolMe()` there when a client step needs it).

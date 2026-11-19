# Overview: packages, the backend interfaces, and how they map

tarol-svelte is the browser side of [Tarol](https://github.com/CLorat/Tarol-Net). The backend in this document is
`CLorat/Tarol-Net@main` = `73b35ff` (2026-11-19; step 18 merged, release `v0.1.0-preview.1` published on 2026-11-18).
Every row of the inventory names the backend file it was read in. Labels as in [philosophy.md](philosophy.md).

## Packages

All of them live under the owner's scope on GitHub Packages (SV-2, SV-14). The arrows are the only allowed dependencies,
enforced by `eng/check-deps.mjs`.

| Package | Role | Depends on | Budget (gzip, SV-15) |
|---|---|---|---|
| `@clorat/tarol-client` | framework-free TS: transport, problem → `Violation`, `Id<T>`, `Option`, ETag cache, idempotency, `TokenProvider` port, keyset pages, read-after-write; `/push`: SignalR JSON client (SV-8) | none | core ≤ 3 KB, `/push` ≤ 2 KB |
| `@clorat/tarol-oidc` | OIDC code + PKCE, tokens in memory, refresh, logout (SV-7); `/zitadel`: scopes, role claim, tenant id | `tarol-client` (the port), `oauth4webapi` | ≤ 9 KB |
| `@clorat/tarol-svelte` | Svelte 5 runes: `query`, `change`, `form`, `live`, client context | `tarol-client`, peer `svelte` | ≤ 3 KB |
| `@clorat/tarol-codegen` | CLI + library (dev only): `/openapi/v1.json` (+ `x-tarol-*`) → typed `changes`, `queries`, ids, rules (SV-4, SV-5) | none at runtime | not shipped to browsers |
| `@clorat/tarol-design` | tokens (CSS custom properties), themes (light, dark, density), accessible primitives on native elements (SV-9, SV-10), message catalogue de/en | peer `svelte` | CSS ≤ 6 KB, each primitive ≤ 2 KB |
| `@clorat/tarol-components` | data-bound defaults: `DataTable` (keyset paging, sort, virtualized above 200 rows), `ChangeForm` and fields, `Toaster`, `QueryState` (loading, empty, error), `AppShell` | `tarol-svelte`, `tarol-design` | `DataTable` ≤ 6 KB |
| `@clorat/tarol-admin` (later) | dead letters, re-drive, discard, projection versions, export/erase | `tarol-components` | to be set |

```
tarol-client ◄── tarol-oidc
     ▲
tarol-svelte ◄── tarol-components ──► tarol-design
                        ▲
                   tarol-admin
tarol-codegen (dev only; its output imports tarol-client)
```

## Interface inventory

Columns: interface | route or message | request | response | errors | auth | caching | how to test against a running
backend | client package and API. Paths are relative to Tarol-Net. `CE` = `src/Changes/Tarol.Changes.AspNetCore/ChangeEndpoints.cs`,
`QE` = `…/QueryEndpoints.cs`, `AE` = `src/Operations/Tarol.Operations/AdminEndpoints.cs`. All rows are **[verified by
reading]** unless marked. The e2e column refers to `samples/Sagas` (API on `:5080`, Zitadel on `:8080`).

### Changes and reads (`Tarol.Changes.AspNetCore`)

| Interface | Route | Request | Response | Errors | Auth | Caching | Test | Client |
|---|---|---|---|---|---|---|---|---|
| Creation (`ICreation<T>`, `[Endpoint("POST /x")]`) | app-declared `VERB /pattern`; name = C# type name (`Generators/Emitter.cs:68`) | JSON (app naming policy, camelCase in the sample); route members excluded; ≤ 64 KiB; headers `Idempotency-Key` (1–255 chars), `If-Match: "0"` optional | **201** `{"id":"<uuid>","version":1}`, `Location`, `ETag: "1"`, `Tarol-Position: <tx>.<pos>` (`CE:257-277`); replay **200** + `Idempotent-Replayed: true` | 400 Invalid, 401 (no body), 403, 409 `<T>.AlreadyExists`, 413, 422 `Idempotency.KeyReused` | default or named policy; role map + row rules | none | `POST /auctions {"reserve":100}` as alice | `changes.createAuction(input)` → `ChangeResult<Created<AuctionId>>` |
| Change (`IChange<T>`) | e.g. `POST /auctions/{auction}/bids` | JSON or no body; `Idempotency-Key`; `If-Match: "<version>"` (quoted integer only, `W/` or `*` → 400) | **204**, `ETag: "<new version>"`, `Tarol-Position` | 400, 401, 403 (before the version check), 404 `<T>.NotFound` (also another tenant), 409 guard code or `Stream.VersionConflict`, 422 | as above | none | `POST /auctions/{id}/bids {"amount":150}` as bob | `changes.placeBid({ auction, amount }, { expectedVersion })` |
| View (`IView<TAgg,TSelf>`) | `GET /…/{id}` | `If-None-Match` | **200** view JSON, strong `ETag: "<version>"`, `Cache-Control: private, no-cache`, `Vary: Authorization` (`CE:391-398`) | 304, 400, 401, 403, 404 | `Read<T>` | ETag (exact match or `*` only, BC-7) | `GET /auctions/{id}` twice → 304 | `queries.auction.get(id)` / rune `query(...)` |
| List (`IQuery<TRow>`) | e.g. `GET /auctions`, `GET /my/auctions` | filters by JSON name; `sort` = enum member name (direction fixed per member by `[Descending]`); `limit` 1–200 (default 50); `after` (cursor); `count`; header `Tarol-Read-After`; `[FromClaim]` members come from claims, never the request | **200** `{"items":[…],"next":"<cursor>"|null,"total"?:n}`, weak `ETag: W/"<16 hex>"`, `Tarol-Position`, optional `Tarol-Stale: true` (`QE:248-275`) | 400 `limit:["Range"]`, `after:["Query.Cursor"]`, `sort:["Format"]`, `*:["Multiple"]`; 403 `Auth.Claim`; 503 `Projection.Building` + `Retry-After: 5` | `Read<T>` + optional policy | weak ETag → 304 | `GET /auctions?limit=3&count=true`, follow `next` | `queries.auctions.list({ settled, sort, limit })` → `Page<T>`; `DataTable` |
| Search (`MapTarolSearch`) | `GET /search` | `q` (1–256), `types`, `prefix`, `counts`, `snippets`, `limit` ≤ 50 (default 20), `after`, `lang` | `{"items":[{type,id,aggregate,title,score,snippet?}],"counts"?,"countsCapped"?,"next"}`, `ETag W/"<24 hex>"` (`SearchEndpoints.cs:40-47`) | 400 `Search.*`, 401, 403 `Auth.Forbidden`, 503 `Search.Building` | authenticated, per-type `CheckList` | ETag | `GET /search?q=iris` | `search({ q, types })` in `tarol-client`; no OpenAPI yet (BC-3) |
| OpenAPI | `/openapi/v1.json` when the app calls `AddOpenApi(o => o.AddTarolEndpoints())` + `MapOpenApi()` (sample: `samples/Sagas/Api/Program.cs:54,64`) | — | OpenAPI 3.1 document; problem responses have an empty schema | — | app's choice | — | `curl :5080/openapi/v1.json` | input of `tarol-codegen` |
| Webhooks | `POST /webhooks/{sender}` (HMAC) | server to server | — | — | signature | — | — | **not a client interface** |

**Problems (RFC 9457, `application/problem+json`)**, written directly by `CE:288-359`:

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","status":400,"title":"One or more fields are invalid.","errors":{"title":["Length"],"lines[1].quantity":["Range"]}}
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.4","status":403,"title":"Auction.NotSeller","code":"Auction.NotSeller","detail":"…"}
```

* Field keys are camel-cased per segment with indexes kept (`Lines[1].Sku` → `lines[1].sku`); header errors keep the header
  name (`If-Match`); a malformed body is `{"":["Json"]}`. Values are arrays of codes; the detail text is dropped (BC-5).
* Status per `ErrorType` (`src/Results/Tarol.Results/ErrorType.cs:54-66`): NotFound 404, Conflict 409, Forbidden 403,
  Unauthorized 401, Gone 410, UnprocessableEntity 422, TooManyRequests 429, Unavailable 503, Timeout 504, else 500.
* **401 never has a body**, and an ASP.NET policy 403 has none either (`CE:294-295`); the client branches on the status there.
* The client turns every answer into one union (`tarol-client`):

```ts
type Violation =
  | { kind: 'invalid'; errors: Record<string, string[]> }                  // 400 with errors
  | { kind: 'error'; status: number; code: string; detail?: string }       // any other problem
// a 401 without a body → { kind:'error', status:401, code:'Auth.Required' }; fetch failure → code 'Network'; abort → throws
```

**JSON shapes** (`src/StronglyTypedId/.../IdJsonConverter.cs:15-29`, `src/Options/.../OptionJsonConverter.cs:30-56`):
`Id<T>` is a "D"-format UUID string (new ids are UUIDv7) → `Id<'Auction'>` (a branded `string`); `Option<T>` is the value or
`null` → `T | null`; value objects are bare primitives; enums are member names when the app sets `UseStringEnumConverter`
(the sample and the tests do) and numbers otherwise, so the generator reads the OpenAPI schema; dates are ISO 8601 strings.
The `Result` JSON envelope (`{"success":true}` | `{"value":…}` | `{"failure":…}`) and `OperationContext` never appear on
HTTP; they are stored and messaged shapes (`src/Results/.../ResultJsonConverter.cs:129-131`), so the client has no codec
for them.

**Correlation**: the backend makes a new correlation id per request and neither reads nor writes a correlation header; it
leaves `traceparent` to ASP.NET (`CE:100`). The client sends a W3C `traceparent` per call (cheap, 55 bytes) so that the
backend's activity joins the browser's trace once ASP.NET picks it up; showing a request id to users needs BC-11.

### Auth (`Tarol.Security`, `Tarol.Security.Zitadel`)

| Interface | Detail | Client |
|---|---|---|
| Token | JWT bearer only (`ZitadelTarolBuilderExtensions.cs:36-43`): audience = project id, `sub` = user, `role` claims | `TokenProvider` port in `tarol-client`; `tarol-oidc` implements it |
| Browser flow | authorization code + PKCE against Zitadel; scopes `openid urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner urn:zitadel:iam:org:project:id:<projectId>:aud`; without `:aud` every call is 401 (`tests/Security/…Zitadel.IntegrationTests/ZitadelOidcTests.cs:94-96`) | `zitadel({ issuer, clientId, projectId })` preset in `tarol-oidc/zitadel` |
| Roles | only `urn:zitadel:iam:org:project:<projectId>:roles` (object `{"seller":{"<orgId>":"<domain>"}}`), only roles granted in the user's org (`ZitadelClaims.cs:31-59`) | `session.roles` (for UI hints only; the server decides) |
| Tenant | `urn:zitadel:iam:user:resourceowner:id` → `tenant` = Guid from SHA-256 of `"zitadel-organisation:" + org` with version and variant bits set (`ZitadelClaims.cs:87-94`) | `zitadelTenant(orgId)` (WebCrypto), part of the cache key |
| 401 / 403 | 401 empty body (+ `WWW-Authenticate: Bearer`, framework default [unverified]); 403 problem with `code` | 401 → one refresh, then `session.expired`; 403 → `Violation` |

### UI push (`Tarol.Messaging.SignalR`)

| Interface | Detail | Client |
|---|---|---|
| Hub | `/tarol/messages`, `[Authorize]`, JSON protocol only (`MessageHub.cs:20`, `UiPush.cs:29,223`) | `connectPush(client)` in `tarol-client/push` |
| Methods | `Subscribe(topic)`, `Unsubscribe(topic)`, `Publish(topic, data)`; refusals are `HubException` text `Forbidden: …`, `Topic: …`, `Auth.Tenant: …` (BC-12) | `push.subscribe(topic, handler)`, `push.publish(topic, data)` |
| Callback | `message` with `{topic, id, version, subject, time, sender, data}` (`PushedMessage.cs:14`) | `PushedMessage<T>` |
| Topics | `<system>.<name>`, ≤ 200 chars, exact names; groups per tenant `<tenant>/<topic>` | validated before sending |
| Reconnect | no replay, no position: after every (re)connect the client re-subscribes each topic and refetches state over HTTP; **#71**: the restart loop must never end on a timeout (`MessagePushClient.cs:166-210`; delays 0/1/2/5/10 s ± 20 %) | built into `/push`; queries marked `live(topic)` revalidate on reconnect |
| Gaps | the query-string `access_token` is not read, so a browser WebSocket gets 401 (BC-2); no CORS (BC-1); the sample maps no hub (BC-9) | blocked until BC-2 |

### Operations, data protection, jobs (`Tarol.Operations`, `Tarol.DataProtection`, `Tarol.Jobs`)

| Interface | Route | Response | Errors | Auth | Client |
|---|---|---|---|---|---|
| Liveness / readiness | `GET /health/live`, `/health/ready` | text `Healthy` / `Unhealthy` (503) | — | anonymous | e2e wait condition only |
| Backlogs | `GET /health/tarol` | `{"status","durationMs","checks":{…}}` | 503 when Unhealthy | anonymous | `tarol-admin` status panel |
| Dead letters | `GET {admin}/dead/{kind}?after=&limit=&tenant=&name=` (kind: `reactions`, `jobs`, `messages`; limit ≤ 200, default 50) | `{"items":[{id,kind,name,tenant,subject,attempts,error,deadAt}],"next":long|null}` | 400/404 `{"error":"…"}` (not problem+json, BC-10) | one policy for the group (sample: role `tarol-admin`) | `tarol-admin` |
| Re-drive | `POST {admin}/dead/{kind}/{id}/redrive` → 204; `POST {admin}/dead/{kind}/redrive?max=` → `{"redriven":n}` | | 404, 400 | same | `tarol-admin` |
| Discard | `DELETE {admin}/dead/{kind}/{id}` → 204 | | 404 | same | `tarol-admin` |
| Projection versions | `GET {admin}/projections` → `[{name,version,state,rows,bytes,superseded}]`; `DELETE {admin}/projections/{name}/{version}` → 204 | | 409 newest or in use | same | `tarol-admin` |
| Export | `GET {admin}/subjects/{id}/export?tenant=<guid>` (required) → JSON download | | 400 | same | `tarol-admin` |
| Erase | `POST {admin}/subjects/{id}/erase?tenant=<guid>` → `{tenant,subject,alreadyErased,streams}`; afterwards `[PersonalData]` fields read `null` and new personal data is 409 `DataProtection.SubjectErased` | | 400; 500 when a participant fails (BC-10) | same | `tarol-admin`; components render `null` personal fields as "erased" |
| Jobs | **no HTTP endpoints**; visible only as `dead/jobs` and the `tarol-jobs` health check | | | | nothing to build until the backend adds endpoints |

## Where the inventory is incomplete

Every gap that the client would otherwise work around is a proposed backend change in
[docs/backend/changes.md](../backend/changes.md). The client does not paper over them: a blocked feature waits for its
BC-* PR, and the plan step says so.

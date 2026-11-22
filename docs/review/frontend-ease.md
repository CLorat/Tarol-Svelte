# Design review: is tarol-svelte easy from the frontend?

From an app developer's seat, at `main` = `d62b5e8` (tarol-svelte) and `fb18bb2` (Tarol-Net), 2026-11-21. For each task an
app does: **how many lines, how many concepts, how many places to get it wrong**, and above all how a **push message**
reaches components, fields and the cache.

Labels as in [philosophy.md](../architecture/philosophy.md): **[verified]** = reproduced by the command given;
**[verified by reading]** = read in the named code; **[unverified]** = not tried.

How it was measured:

* The examples of Part A are real files in [`apps/docs/src/review/`](../../apps/docs/src/review/). The docs app's
  `typecheck` and `lint` cover them, so they compile against today's packages. `node docs/migration/measurements/review-count.mjs` counts code
  lines (not blank, not comments), import statements and the names imported from `@clorat/*` and the generated client.
* The candidates of Part B are prototypes on the branch
  [`ccr-14553301-iwps8j-proto`](https://github.com/CLorat/Tarol-Svelte/tree/ccr-14553301-iwps8j-proto) (not for merging),
  with tests that count the requests per message. Bytes come from each package's `pnpm size`: the production Vite build
  of the entry, the way an app's bundler sees it (SV-15).
* The wire facts come from the running sample (`samples/Sagas` under the AppHost, Tarol-Net `fb18bb2`) and from
  [`review-push-race.mjs`](../migration/measurements/review-push-race.mjs), which uses the real `/push` client.

## Summary

| Area | Today | Verdict |
|---|---|---|
| First screen, detail, create form, search, admin | 4 to 29 lines, one rune or one component each | **easy**: little to write, mistakes give clear errors |
| Optimistic change | 20 lines; one option (`optimistic`) and one rule (return the rollback) | easy, with one trap (no `expectedVersion`) |
| Regenerating the client | 2 commands; `--check` in CI | easy |
| **Live data, one aggregate** | 7 lines, but it **re-reads on every message of the topic** (every bid on every auction); correct filtering by hand takes 13 lines and has 3 traps | **not yet**: correct is not the short way |
| **Live data, a list** | 1 option, but the re-read after a push returns the **old rows** in 19 of 20 cases [verified] | **wrong today** (BC-23) |
| **Edit form under live data** | the expected version is read at submit, so an edit made on old values **overwrites silently** [verified] | **wrong today** |
| **DataTable under a live re-sort** | keyboard focus is **lost to `<body>`** [verified] | **wrong today** (P6) |
| Topics | hand-typed strings, payload `unknown` | not yet: needs BC-25 |

The rest of this document gives the numbers behind each row. The recommendations and the questions to the owner are in
[Part C](#part-c-proposal).

## Part A: inventory as it is today

`node docs/migration/measurements/review-count.mjs` [verified]:

| # | Task | File | Code lines | Imports | Names to know (from `@clorat/*` and the generated client) |
|---|---|---|---|---|---|
| 1 | First screen: login, client, push, `setTarol`, a list | `first-main.ts` + `FirstApp.svelte` | 25 + 29 = **54** | 7 + 7 | `createOidc`, `zitadel`, `createClient`, `connectPush`, `setTarol`, `list`, `ThemeRoot`, `AppShell`, `QueryState`, `DataTable`, `Column`, `requests`, `AuctionRow` (13) |
| 2 | Detail page | `Detail.svelte` | **10** | 3 | `query`, `DetailLayout`, `requests`, `AuctionId`, `AuctionView` (5) |
| 3 | Create form with server rules | `CreateForm.svelte` | **15** | 4 | `changeForm`, `ChangeForm`, `FormField`, `requests`, `rules`, `Created` (6) |
| 4 | Optimistic change | `Optimistic.svelte` | **20** | 3 | + `expectedVersion`, `optimistic`, `patch` (3 options on top of task 3) |
| 5 | Search box | `Search.svelte` | **5** | 1 | `SearchBox` (1) |
| 6a | Live data, the short way | `LiveToday.svelte` | **7** | 2 | `query` + `live: 'artflow.bid-placed'` (a hand-typed string) |
| 6b | Live data, filtered to this auction | `LiveFiltered.svelte` | **13** | 2 | + `live()`, `getTarol().push`, `onReconnect`, `subject`, two `$effect`s |
| 7 | Admin UI | `Admin.svelte` | **4** | 1 | `AdminApp` (1) |
| 8 | Regenerate after a backend change | `package.json` scripts | **2 commands** | — | `curl …/openapi/v1.json > openapi.json`, `tarol-codegen openapi.json -o src/api.ts` (`--check` in CI) |

### What can go wrong, and what the developer sees

| Task | Mistake | What happens | Label |
|---|---|---|---|
| 1 | no `setTarol` above a component | `Error: tarol-svelte: call setTarol(client) in a parent component first` (`context.ts:23`) | verified by reading |
| 1 | `createOidc` without the `zitadel` preset | every backend call is 401 (the audience scope is missing; tarol-oidc skill rule 2) | verified by reading |
| 1 | `restore()` after a `signed-out` result | a redirect loop (tarol-oidc skill rule 4); the example calls it only for `kind === 'none'` | verified by reading |
| 1 | the props read without `untrack` | `svelte-check`: "This reference only captures the initial value of `props`" (`state_referenced_locally`), which fails the build with `--fail-on-warnings` | verified |
| 2, 3 | `query({ path })`, an object instead of a function | a TypeScript error | verified by reading |
| 2, 3 | a rune called in an event handler | `lifecycle_outside_component` | verified by reading |
| 3 | `rules` given to `changeForm` but not to `FormField` | the error shows as the generic code text without the bounds ("between 1 and 1000000") | verified by reading (`FormField.svelte:31-41`) |
| 4 | `optimistic` without `expectedVersion` | no 409 on a concurrent change; the patch may show a value that never existed | verified by reading (skill) |
| 5 | none found: one prop, one callback; server text is never markup | — | — |
| 6a | a topic name with a typo (`'artflow.bid-placd'`) | no type error; the hub refuses it with `Hub.Forbidden` (it is not in `Rules`), which reaches only `connectPush({ onRefused })`. That option is optional and the docs app does not set it, so by default the page **silently** never updates | verified (`Hub.Forbidden` from the sample) |
| 6a | every bid on every auction re-reads this page | 1 GET (a 304) per message per open live query: 10 messages for other auctions = **10 reads** | verified (prototype branch, `today` scenario: 10 of 10) |
| 6b | compare `subject` with an id in another form (upper case, or `N` format without hyphens) | **silent**: no update; the hub sends the stream id lower-case with hyphens (`Message.cs:179`, `"D"` format) | verified on the wire |
| 6b | two messages in one tick | `live()` keeps only the **last** message, so an `$effect` on it runs once: when the last one is for another auction, this auction's update is **missed** | verified by reading (`live.svelte.ts:22-26`; `live.svelte.test.ts` sees the last of two) |
| 6b | forget `onReconnect` | after a reconnect the page shows what it had before the outage (the hub has no replay) | verified by reading |
| 6 (lists) | `list(…, { live })` | the re-read after a push returns the **old row**: see B.0 | verified |
| 7 | user without the admin role | the 403 shown as a message, without a reference (BC-21) | verified (step 10) |
| 8 | the client not regenerated | old types compile and the server answers 400 `Unknown` for a removed filter; `tarol-codegen … --check` fails in CI | verified by reading (`check:package`) |

The docs disagree with the code in one place. [philosophy.md](../architecture/philosophy.md) P2 promises
`live('artflow.bid-placed', auction.id)`, but `live()` takes `() => string | null` and has no subject argument
[verified by reading, `live.svelte.ts:16`].

## Part B: messages to components

### B.0 What the backend sends [verified on the wire]

`node docs/migration/measurements/review-push-race.mjs view 10` against the sample. One `artflow.bid-placed` message:

```json
{ "topic": "artflow.bid-placed", "id": "01a1ffc8-…", "version": 1, "subject": "01a1ffc8-3e52-7423-95cb-04c486ddc18b",
  "time": "2026-11-21T20:24:35.97+00:00", "sender": "artflow",
  "data": { "auction": "01a1ffc8-3e52-7423-95cb-04c486ddc18b", "amount": 20, "at": "2026-11-21T20:24:35.97+00:00" } }
```

* **`subject` is the stream id** (`Message.Of`, `Message.cs:179`: `recorded.StreamId.ToString("D")`). In ArtFlow a bid
  is an entity of the auction's stream (`Bid : Entity<Auction, Bid>`, `Worker/Domain.cs:68`), so the subject is the
  auction id, the same string as the view's `id` and the `auction` path parameter. For a contract published from another
  stream (a saga, a payout), the subject is *that* stream's id. So a filter by subject is right only when the topic's
  stream is the view's aggregate.
* **`version` is the contract version (1), not the stream revision.** The two bids above were revisions 2 and 3 (`ETag:
  "2"`, `"3"`). The message carries **neither the revision nor the commit's `Tarol-Position`**, although the publisher
  has both: `RecordedEvent.Event.Version` and the feed position (`RecordedEvents.Raw.Position`). So the client cannot
  tell whether a message is older or newer than its cache.
* **Groups are `<tenant>/<topic>`** (`MessageHub.Group`, `UiPush.cs:131`). Every subscriber of a tenant gets every bid
  of every auction; there is no group per subject.
* **The race, measured**. A client re-reads as soon as the message arrives, without `Tarol-Read-After` because the message
  has no position:

  | Read after the push | `GET /auctions/{id}` (the view) | `GET /auctions` (the projection list) |
  |---|---|---|
  | at once (16–48 ms) | 20 of 20 fresh | **1 of 20 fresh**, then 0 of 15 |
  | 300 ms later | — | 5 of 15 fresh |
  | 1 s later | — | 15 of 15 fresh |

  `node docs/migration/measurements/review-push-race.mjs list 20 0` / `list 15 300` / `list 15 1000` / `view 20 0` [verified, three runs]. The
  view reads the aggregate, so it is current. The list is a projection that the worker updates after the outbox has
  already published. So today `list(…, { live })` usually re-reads before the projection has caught up, gets a 304 with
  the old row, and shows the change only on the next message, focus or own change. **This is a P5 (correct) bug, and the
  client cannot fix it**: it needs the position in the message (BC-23).

### B.1 The candidates, measured

Bytes are the compiled `@clorat/tarol-svelte` bundle (`pnpm size`: today 2.89 KB gzip / 2.54 KB brotli, budget 3 KB,
SV-15). The client core is 2.18 / 2.00 KB (budget 3 KB). Requests are counted by the prototype tests in
`packages/tarol-svelte/test/proto.svelte.test.ts` [verified].

| # | Candidate | App code | svelte bytes (gzip / brotli) | Reads per message | Needs |
|---|---|---|---|---|---|
| 1 | **Today**: `live: 'topic'` re-reads the query | 7 lines (6a) | 2.89 / 2.54 | 1 per message per live query, **any** subject; a burst of 10 starts 10 reads (9 aborted) | — |
| 2 | **Filtered by subject**: the generated view request carries `subject: auction` (from the `x-tarol-id` path parameter the document already has); a live query skips messages of other streams. Explicit `live: { topic, subject }` too, `subject: null` = every message | **7 lines, unchanged** (6a becomes correct) | **+0.13 / +0.10** (with read-after) | 0 for other auctions; 1 for this one | codegen: 1 line per view (done in the prototype); a topic from another stream needs BC-25 to know when *not* to filter |
| 2+ | **Coalescing**: one read in flight, at most one queued (instead of abort and restart) | — | **+0.08 / +0.08** | a burst of 10: **2** reads | — |
| 3 | **Apply the payload**: `live: { topic, apply: (view, msg) => view' }` changes the cached value without a request when `msg.revision === version + 1`; `revision <= version` is skipped (e.g. this client's own change, which the own-change read already got); a gap re-reads | +1 line per topic, and that line **repeats the server's logic** (`bids + 1`) | **+0.08 / +0.07** | 0 for the next revision; 0 for a duplicate or own change; 1 on a gap | **BC-23**: without the revision it falls back to a read (prototype test), so today it saves nothing |
| 3′ | **Read after the message's position** (`Tarol-Read-After: msg.position`) for lists | 0 lines | included in 2 (client core +0.03 / +0.02) | 1 per message, and it **sees the change** | **BC-23** |
| 4 | **Typed topics from codegen**: `topics.bidPlaced: Topic<BidPlacedV1, 'Auction'>` from an `x-tarol-topics` extension; `live: topics.bidPlaced`, a typed `msg.data`, and the topic's `stream` tells candidate 2 when to filter | 7 lines; the string is replaced by a checked name | 0 in the runtime package; about 45 bytes per topic in the app (the name and the stream) [verified by reading the generated literal] | as 2 | **BC-25** (the document has no topics today; the prototype reads a fixture with the extension) |
| 5a | **Edit form under live data**: `changeForm(…, { from: () => view.value, expectedVersion })`. Untouched fields follow the server; an edited field keeps the user's input and reports `form.conflict(path)`; the submit sends the version the edit **started from** (a 409 instead of a lost update) until the user resolves | +1 option | **+0.27 / +0.23** | — | — |
| 5b | **FormField notice**: a polite `role="status"` region under the field: "Changed meanwhile to "…"." with "Use the new value" / "Keep mine" | 0 (FormField reads `form.conflict`) | `ChangeForm + FormField` 1.59 → **1.84 KB** gzip (budget 2 KB) | — | 3 messages in `ui-en`/`de` |
| 5c | **DataTable under a live re-sort**: keep keyboard focus on the same row (by `rowKey`) when rows move | 0 | not prototyped (a fix, est. < 0.1 KB) | — | — |

Everything in candidates 2, 2+, 3 and 5a together makes `@clorat/tarol-svelte` 3.45 KB gzip / 3.02 KB brotli. Without
apply (candidate 3) it is 3.37 KB gzip. **Any of them needs an SV-15 budget raise** from 3 KB.

### B.2 Failure modes per candidate

| # | What goes wrong | Effect | Guard |
|---|---|---|---|
| 1 | every message re-reads every live query | N open pages × M messages/s of GETs (304s) on the API; the list shows old rows (B.0) | — |
| 2 | a topic whose subject is another stream (a saga's event about an auction) filtered against the auction's id | **missed update**, silent | filter by default only when the topic's stream equals the request's aggregate (BC-25); until then the default is: filter when the request names a subject, and `subject: null` opts out; documented in the skill |
| 2 | the id written in another format | missed update | the generated request passes the id exactly as the route takes it; the hub writes `"D"` format (verified the same string) |
| 3 | `apply` does not do what the server does (`bids + 1` but the server counts differently) | the page shows a value the server never had, until the next read | the next ETag read corrects it; `apply` is opt-in; with BC-23 a revision gap always re-reads |
| 3 | at-least-once delivery sends a message twice | without the revision it would be applied twice (`bids + 2`) | the revision guard (prototype test: a duplicate is skipped) |
| 3′ | the projection is slower than the read-after timeout | `Tarol-Stale: true`, `list.stale` shows "Updating…" | already handled (`QueryState`) |
| 4 | the backend drops or renames a topic | a TypeScript error after regeneration (`--check` in CI) | — |
| 5a | the user edits, the server changes another field | that field follows the server (no conflict); the submit still uses the old version, so the backend's 409 makes the user reload: conservative | `resolve()` moves the base version on |
| 5b | the notice moves the content below it | CLS **0.0078** per notice in the component test (the budget is 0.01 per page) | reserve the line, or show the notice in the hint's place (P1 check) |
| 5c | a re-sort while a row has focus | **focus lost to `<body>`**; a screen-reader user loses their place | test `live.test.ts` (fails today, `it.fails`); keep focus by key |

### B.3 Against the principles

| | P1 size | P2 little to write | P5 correct | P6 accessible |
|---|---|---|---|---|
| 1 today | ✓ | ✓ (7 lines) | ✗ lists show old rows; every message re-reads | ✓ |
| 2 subject | +0.13 KB, over the budget | ✓ (0 more lines) | ✓ for views; lists need BC-23 | ✓ |
| 2+ coalesce | +0.08 KB | ✓ | ✓ (fewer reads, the last one always runs) | ✓ |
| 3 apply | +0.08 KB | ✗ +1 line that duplicates server logic | ✓ only with BC-23 | ✓ |
| 4 typed topics | ~0 runtime | ✓ (checked names, typed data) | ✓ (no silent typo) | — |
| 5a/b edit form | +0.27 KB svelte, +0.25 KB FormField | ✓ (+1 option) | ✓ fixes a lost update | ✓ polite status, no focus move, axe 0, CLS 0.0078 |
| 5c table focus | ≈ 0 | ✓ | — | ✓ fixes a lost focus |

The prototype tests show that the conflict notice keeps focus on the input, keeps the user's text and passes axe
(`packages/tarol-components/test/conflict.svelte.test.ts`, three runs, CLS 0.0078 each) [verified].

## Part C: proposal

### C.1 Recommendations, with the questions to the owner

1. **Filter live queries by subject by default, and coalesce bursts** (candidates 2 and 2+). The short way becomes the
   correct way (0 more lines). Requests for other auctions drop from 1 to 0, and a burst of 10 makes 2 reads instead of 10.
   Cost: +0.21 KB gzip / +0.18 KB brotli, so the `@clorat/tarol-svelte` budget goes from 3 KB to **3.2 KB**.
   Alternatives: only the explicit `live: { topic, subject }` (the same bytes, +1 option per query, and the default stays
   wasteful), or keep today.
2. **BC-23 in Tarol-Net**: the event's revision and the commit's position in `PushedMessage`. It fixes the stale list (B.0)
   with read-after, and lets a view skip a message it already has. Recommended as a Tarol-Net PR from this session.
3. **Do not build "apply the payload" now** (candidate 3). After BC-23 it saves one 304 per message for a view. It costs a
   line of app code that repeats the server's logic and can drift from it. Revisit when a screen needs it (a ticker, a chat).
4. **Typed topics** (candidate 4): BC-25 (`x-tarol-topics` in `/openapi/v1.json`), then codegen. Recommended as a BC, and
   as a Tarol-Net PR when the owner wants it in this session.
5. **Edit forms under live data** (candidates 5a and 5b): `from` with the version from when the edit started, and the
   FormField notice. It fixes a silent lost update. Cost: +0.27 KB on the svelte package (inside a 3.5 KB budget together
   with item 1) and +0.25 KB on `ChangeForm + FormField` (1.84 of 2 KB).
6. **DataTable keeps focus by row key** (candidate 5c): a bug fix (P6), no decision needed. It ships in its own PR.
7. **BC-24 (a group per subject)**: record only (P2). It saves bandwidth per client, but filtering in the client
   (candidate 2) already saves the requests, and it is the requests that load the server.

The owner's answers (2026-11-21), in [decisions.md](../migration/decisions.md): **SV-24** subject filter by default
with coalescing (budget 3.2 KB); **SV-25** BC-23 and BC-25 as Tarol-Net PRs, BC-24 recorded only; **SV-26** `from` with
the FormField notice (budget 3.5 KB together with SV-24); **SV-27** no apply for now. Item 6 (DataTable focus) is a fix
without a decision.

### C.2 Backend changes (recorded in [changes.md](../backend/changes.md))

* **BC-23** (P1): the revision and the position in the pushed message.
* **BC-24** (P2): subscribe to one subject.
* **BC-25** (P1): UI topics in the OpenAPI document.
* **BC-26** (P2): a change in the sample that edits a field, for an e2e of SV-26.

### C.3 What was built (2026-11-22)

| Item | Decision | Pull request | Status |
|---|---|---|---|
| Subject filter + coalescing | SV-24 | tarol-svelte [#35](https://github.com/CLorat/Tarol-Svelte/pull/35) | `pnpm verify` and e2e green |
| DataTable keeps focus by key | (fix) | tarol-svelte [#36](https://github.com/CLorat/Tarol-Svelte/pull/36) | `pnpm verify` green |
| Edit forms with `from` + FormField notice | SV-26, SV-28 | tarol-svelte [#37](https://github.com/CLorat/Tarol-Svelte/pull/37) | `pnpm verify` green; e2e waits for BC-26 |
| BC-23 revision and position | SV-25 | Tarol-Net [#115](https://github.com/CLorat/Tarol-Net/pull/115) | **merged**; on the wire (the sample built from its branch): messages carry `revision` (2 for the first bid, the view's ETag) and `position`; a list read with `Tarol-Read-After: <position>` right after the push is fresh **20 of 20** in two runs, without it 1 of 20 (`review-push-race.mjs list-after 20` / `list 20`) [verified] |
| BC-25 `x-tarol-topics` | SV-25 | Tarol-Net [#116](https://github.com/CLorat/Tarol-Net/pull/116) | **merged** |
| Read-after for lists, skip known revisions; typed topics in codegen | SV-24, SV-25 | — | **built** on Tarol-Net `0.1.0-preview.5` (svelte.md §11); the list e2e is fresh after a push and fails without the position |

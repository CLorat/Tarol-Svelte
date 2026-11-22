# Step 3: `@clorat/tarol-svelte` (runes bindings)

## 1. Inventory

What an app screen needs from the backend, from [overview.md](../architecture/overview.md): views and lists with ETag
revalidation, keyset paging (`next` → `after`), changes with `Invalid` field paths, push topics that make data stale, and
the tenant in every cache key. The bindings add no wire behaviour of their own: everything goes through `tarol-client`.

## 2. Candidates

| Candidate | Size | Notes |
|---|---|---|
| Svelte 5 runes in `.svelte.ts` modules (`$state`, `$derived`, `$effect`) | budget ≤ 3 KB excluding Svelte | fine-grained updates, no store subscription boilerplate; SV-3 requires runes only |
| Svelte stores (`writable`) | similar | legacy API in Svelte 5; excluded by SV-3 |
| TanStack Query for Svelte | ≈ 13 KB gzip [unverified, not measured here] | generic; duplicates the ETag cache, Read-After and idempotency logic the core already has; excluded by SV-6 |

Svelte baseline measured: a component with one `$state` counter mounted with `mount()` is 15.79 KB gzip / 14.02 KB brotli
(Svelte 5.58.0, production build [verified]). Every budget in this repository is measured on top of it.

## 3. Design

```ts
// app setup, once
setTarol(createClient({ baseUrl: '/api', tokens }), connectPush({ url: '/api/tarol/messages', tokens }));

// a list screen (as built: a function returning the generated ReadRequest)
const auctions = list(() => queries.auctions.list({ settled, sort: 'HighestBid' }), { live: 'artflow.bid-placed' });
//   auctions.items, .total, .hasMore, .more(), .loading, .violation, .stale, .refresh()

// a form
const form = changeForm(changes.placeBid, { auction: id, amount: 0 }, { rules: rules.PlaceBid });
//   form.values.amount (bindable), form.error('amount') (codes from server and generated rules),
//   form.submit() → Result, form.pending, form.formError; field paths such as 'lines[1].quantity' map 1:1

// a push subscription as one rune
const last = live<BidPlaced>(() => 'artflow.bid-placed');  // last.message, last.count
```

* The query rune re-runs when its argument function reads changed `$state` (filters, sort). Changing a filter resets
  the cursor; `more()` appends the `next` page (keyset only).
* Revalidation on window focus and on push reconnect (SV-6) is set up with `$effect` and removed on destroy; nothing global.
* Optimistic updates (opt-in, SV-6) were built in step 7 (design.md §10: `patch`, `optimistic`). They were **not in this PR**: they need the components' local patches (step 4) to be useful;
  the plan is `changeForm(…, { optimistic: (draft) => … })`, rolled back on `Failed` (including 409
  `Stream.VersionConflict`), then revalidated.
* Forms: client rules come from the generated metadata (SV-5) and run on input and blur; server `Invalid` errors replace
  them on submit. Unknown server paths go to `form.formError` so nothing is lost.

## 4. Decisions

SV-3 (runes only, plain Svelte SPA), SV-5, SV-6; answered.

## 5. What the PR must do

Package with `query`, `live`, `changeForm`, `setTarol`/`getTarol`; component tests in Vitest browser mode (paging, filter
reset, focus revalidation, live stale marking with a fake push, optimistic rollback on 409, field error mapping including
nested paths); type tests; README; skill `tarol-svelte`; budget ≤ 3 KB.

## 6. Public API (new) and choices made while building

Report: `packages/tarol-svelte/api/tarol-svelte.api.md` (generated). `setTarol`, `getTarol`, `Tarol`; `query`, `list`,
`Query`, `List`, `QueryOptions`, `ReadRequest`; `changeForm`, `Form`, `FormOptions`, `at`; `live`, `Live`; `check`,
`isEmail`, `rulePath`, `Rule`, `Rules`.

* **Descriptors, not calls**: a query takes a `ReadRequest` (`{ path, query }`) and a form takes a function from input to
  `ChangeRequest`. The generator (step 5) emits exactly these, so generated code is usable with and without Svelte.
* **Rules live here, not in `tarol-client`**: `check` is the client-side form check (SV-5). It is framework-free and can move
  to the core if a non-Svelte consumer needs it; that would be a listed API move.
* `list.refresh()` (and every revalidation) reads the first page and drops the pages after it: re-reading N keyset pages
  would cost N requests, and the first page is what changed after a push or an own change.
* A form's input is sent as `JSON.parse(JSON.stringify(values))`: the bytes compared for the idempotency key are the bytes
  sent.
* `changeForm` puts server paths that no field of the input has (and `''`) into `formError` as `invalid`, so no server error
  is lost.
* Email rule copied from `Tarol.Validations/Rules.cs:42-65`, including the 253-character domain limit.
* ESLint: in `packages/*/test/**` `explicit-module-boundary-types` and `no-non-null-assertion` are off (tests are not public
  API; with `noUncheckedIndexedAccess` an index into a fixture the test just built is an assertion of the test). One
  `no-dynamic-delete` disable in `form.svelte.ts` (error maps are keyed by runtime field paths).
* **Size is measured on compiled output**: size-limit's esbuild would bundle the `.svelte.js` sources with their runes
  uncompiled (2.13 KB, not what an app ships). `eng/bundle-svelte.mjs` builds the entry with Vite 8 + the Svelte compiler
  (Oxc minifier; Vite 8 no longer bundles esbuild) with `svelte` and `@clorat/*` external, and size-limit measures that file
  (`@size-limit/file`).

## 7. Skill evaluation checklist

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "List my auctions with a load-more button" | `query(...)`, `.more()`, `.hasMore` | offset paging; `$:` reactive statements (Svelte 4) |
| "Show a field error under the amount" | `form.errors.amount` | parsing the problem JSON by hand |
| "Refresh when a bid comes in" | `list(…, { live: 'artflow.bid-placed' })` | polling with `setInterval` |
| "Edit with optimistic concurrency" | `changeForm(…, { expectedVersion: () => view.version })` | sending `If-Match` by hand |
| "An edit form on a live page that must not overwrite another user's change" | `changeForm(…, { from: () => view.value, expectedVersion: () => view.version })`, `FormField` | `expectedVersion` alone (read at submit); copying `view.value` into `initial` by hand |

## 8. Verification

* Tests in Chromium (Vitest browser mode, Playwright 1.63 provider): **25** (query 7, list 2, form 8, rules 5, live 2,
  component 1), 5 runs in a row green [verified]. The component test mounts a parent with `setTarol` and a child with
  `list`, pages with the button and refilters with the checkbox.
* `pnpm verify` green; svelte-check 0 errors, 0 warnings (`--fail-on-warnings`) [verified].
* Size (compiled, without `svelte` and `@clorat/tarol-client`): **2.62 KB gzip / 2.29 KB brotli** (budget 3 KB)
  [verified].
* publint and attw clean; API report generated; 0 undocumented members [verified].

## 10. Edit forms under live data (SV-26, 2026-11-21)

From the design review ([../review/frontend-ease.md](../review/frontend-ease.md) §B, 5a/5b): `expectedVersion` is read at
submit, so under a live view (which revalidates after another user's change) an edit made on old values was sent with
the **new** version and overwrote that change silently [verified: `edit.svelte.test.ts`, last test].

Public API and behaviour changes (additive; without `from` nothing changes):

* `FormOptions.from?: () => Partial<I> | undefined` (new): the server's current values. Only the input's own top-level
  fields are read. Untouched fields follow the server; an edited field keeps the input; when the server's value of an
  edited field changes too, `form.conflict(path)` returns `{ theirs }`. A field the server now has with the user's value
  (e.g. after the own save) is clean again.
* With `from`, the submit sends the `expectedVersion` the current edit started from (the version of the last `from` value
  without edited fields), so a stale edit gets 409 `Stream.VersionConflict`; resolving every conflict moves it to the
  current version.
* `Form.conflict(path)`, `Form.resolve(path, 'mine' | 'theirs')` (new); `reset()` also drops conflicts.
* `@clorat/tarol-components` `FormField`: a `role="status"` region under the field shows `ui.changed` with two buttons,
  `ui.takeTheirs` and `ui.keepMine` (new message ids, de and en). The field and its region are one block
  (`.t-form-field`), so the empty region takes no room: the visual baselines are unchanged (FormField and ChangeForm
  examples 147 px, as on `main`; 163 px with the region as a separate flex item, which failed the `visual` job)
  [verified].

Measured: `@clorat/tarol-svelte` 2.89 → **3.17 KB gzip** / 2.54 → **2.79 KB brotli** (budget raised to 3.5 KB together with
SV-24); `ChangeForm + FormField` 1.59 → **1.97 KB gzip** (budget 2 KB); the notice: CLS **0.0072** (≤ 0.01, asserted), focus
stays on the input, axe 0 violations, 3 runs [verified]. Checks proven with deliberate violations: the version read at
submit fails `edit.svelte.test.ts`; a 6rem notice (CLS 0.0197) fails `conflict.svelte.test.ts` [verified].

Not covered by e2e: the sample has no change that edits a field of an existing aggregate (BC-26 in
[changes.md](../backend/changes.md)); the component and unit tests cover the behaviour.

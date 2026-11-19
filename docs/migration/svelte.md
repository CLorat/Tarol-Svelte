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
setTarol(createClient({ baseUrl: '/api', tokens }));

// a list screen
const auctions = query(() => queries.auctions.list({ settled: false, sort: 'HighestBid' }));
//   auctions.value, .loading, .error (Violation), .stale, .more(), .hasMore, .refresh()
//   .live('artflow.bid-placed') marks it stale on a push and on reconnect

// a form
const form = changeForm(changes.placeBid, { auction: id });
//   form.values.amount (bindable), form.errors['amount'] (codes from server and generated rules),
//   form.submit() → Result, form.pending; field paths such as 'lines[1].quantity' map 1:1 to the server's keys

// a push subscription as one rune
const last = live<BidPlaced>('artflow.bid-placed');        // last.message, last.count
```

* The query rune re-runs when its argument function reads changed `$state` (filters, sort). Changing a filter resets
  the cursor; `more()` appends the `next` page (keyset only).
* Revalidation on window focus and on push reconnect (SV-6) is set up with `$effect` and removed on destroy; nothing global.
* Optimistic updates (opt-in): `change(fn, { optimistic: (cache) => … })` applies a patch to cached entries and rolls it back
  on `Failed` (including 409 `Stream.VersionConflict`), then revalidates.
* Forms: client rules come from the generated metadata (SV-5) and run on input and blur; server `Invalid` errors replace
  them on submit. Unknown server paths go to `form.formErrors` so nothing is lost.

## 4. Decisions

SV-3 (runes only, plain Svelte SPA), SV-5, SV-6; answered.

## 5. What the PR must do

Package with `query`, `live`, `changeForm`, `setTarol`/`getTarol`; component tests in Vitest browser mode (paging, filter
reset, focus revalidation, live stale marking with a fake push, optimistic rollback on 409, field error mapping including
nested paths); type tests; README; skill `tarol-svelte`; budget ≤ 3 KB.

## 6. Skill evaluation checklist

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "List my auctions with a load-more button" | `query(...)`, `.more()`, `.hasMore` | offset paging; `$:` reactive statements (Svelte 4) |
| "Show a field error under the amount" | `form.errors.amount` | parsing the problem JSON by hand |
| "Refresh when a bid comes in" | `.live('artflow.bid-placed')` | polling with `setInterval` |

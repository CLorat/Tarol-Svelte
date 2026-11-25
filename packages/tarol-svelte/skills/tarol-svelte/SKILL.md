---
name: tarol-svelte
description: >-
  Use when building Svelte 5 screens on a Tarol backend: lists with keyset paging and filters, detail views, forms that
  send a change and show the server's field errors, buttons that run a change, or live updates from push topics. Covers
  setTarol, query, list, changeForm, action, live and Rule from @clorat/tarol-svelte. Do not write fetch/$effect loading code by hand, use Svelte 4
  stores or $: statements, or poll with setInterval.
---

# Tarol Svelte bindings (`@clorat/tarol-svelte`)

## Rules

1. Once, in the root component: `setTarol(createClient({ baseUrl, tokens }), connectPush({ url, tokens }))` (the push
   connection is optional). Every rune below takes the client from that context; call the runes during component
   initialisation (top level of `<script>`), not in event handlers.
2. Pass a **function** that returns the request: `list(() => ({ path: '/auctions', query: { settled, sort } }))`. It may
   read `$state`; when that changes the rune reads again (a list restarts at page 1). Return `null` to read nothing.
3. Lists are keyset-paged: `items`, `hasMore`, `more()`. Never compute offsets.
4. A read failure does not throw: check `violation` (`{ kind: 'error', code }` or `{ kind: 'invalid', errors }`). The last
   good `value`/`items` stay visible while revalidating. `loading` is `true` on every revalidation (focus, own change,
   push); `ready` turns `true` with the first value and stays so: gate "create the edit form once" on `ready`.
5. Live data: `query(() => requests.auctionView({ auction: id }), { live: topics.bidPlaced })` (the generated `topics`)
   revalidates only for messages whose `subject` is this auction (the generated request carries `subject` and `stream`),
   and skips a message whose `revision` it already has (its own change). A `list(…, { live })` revalidates on every
   message, read after the message's `position` (`Tarol-Read-After`), so it never shows the row from before the event.
   Both revalidate after a push reconnect, coalesce bursts (one read in flight, one after it), and revalidate on window
   focus and after this client's own changes; never refresh by hand or filter messages yourself. A topic whose `stream`
   is another aggregate than the view's takes every message; for a hand-written topic pass `{ topic, subject: null }`.
6. Forms: `changeForm(change, initial, { rules, expectedVersion })`. Bind inputs to `form.values.x`, call
   `form.touch('x')` on blur, show `form.error('x')`. Server 400 errors land on the field with the same path
   (`lines[1].quantity`), with the server's detail in `form.detail(path)` (`3..60`); errors no field shows, and coded
   errors (403, 409), are in `form.formError` (so is a client rule's error on a path no field shows and the input has no
   value for; a hand-written field over an absent member calls `form.register(path)` in an `$effect`), the request id in `form.requestId` (`query(…).requestId` for reads). A retry of an
   unchanged input reuses the idempotency key, so double clicks and network retries are safe. A generated creation's
   request carries its result (`ChangeRequest<Created>`): `(await form.submit())?.value.id` is typed, no `changeForm<I, Created>`.
   A required enum or number with nothing chosen yet: `changeForm(allowNull(requests.x), { state: null }, { rules })`.
   `draft: 'child-new'` keeps an unfinished creation form in `localStorage` (restored on return, cleared on success/reset).
6a. Optimistic changes are opt-in per form: `changeForm(bid, initial, { expectedVersion: () => view.version,
   optimistic: (input) => view.patch((a) => ({ ...a, highest: input.amount })) })`. The patch shows at once; any failure
   (409 `Stream.VersionConflict`, 400, 403, a throw) rolls it back and reads again; success keeps it until the own-change
   revalidation replaces it. Return the rollback from `optimistic`, i.e. the result of `patch`.
6b. Edit forms over a live view: `changeForm(rename, { title: '' }, { from: () => view.value, expectedVersion: () =>
   view.version })`. The form takes the view's values for its own fields; fields the user has not touched follow the
   server, an edited field keeps the input and `form.conflict('title')` gives `{ theirs }` when the server changed it
   too (`FormField` shows it with "Use the new value" / "Keep mine"; or call `form.resolve(path, 'mine' | 'theirs')`).
   The submit sends the version the edit started from, so a stale edit gets a 409 instead of overwriting.
6c. A button without a form (choose, delete): `const main = action(requests.chooseMain)` at init, then
   `main.run({ location }, { expectedVersion })`; show `main.pending` and `t(main.code)` (the refusal's or first field's code).
7. Codes are not messages: map `form.error(path)` and `violation.code` to text through the message catalogue
   (`@clorat/tarol-design`), never hard-code user text.

## Example

```svelte
<script lang="ts">
  import { changeForm, query } from '@clorat/tarol-svelte';

  let { id }: { id: string } = $props();
  // the generated requests.auctionView({ auction: id }) builds the same request
  const auction = query<AuctionView>(() => ({ path: `/auctions/${id}`, subject: id }), { live: 'artflow.bid-placed' });
  const bid = changeForm(
    (i: { amount: number }) => ({ method: 'POST', path: `/auctions/${id}/bids`, body: i }),
    { amount: 0 },
    { rules: { amount: [{ rule: 'Range', code: 'Range', min: 1 }] }, expectedVersion: () => auction.version },
  );
</script>

{#if auction.value}<p>{auction.value.bids}</p>{/if}
<input type="number" bind:value={bid.values.amount} onblur={() => bid.touch('amount')} aria-invalid={!!bid.error('amount')} />
{#if bid.formError?.kind === 'error'}<p role="alert">{bid.formError.code}</p>{/if}
<button disabled={bid.pending} onclick={() => bid.submit()}>Bid</button>
```

## Common mistakes

| Mistake | What happens |
|---|---|
| `list({ path })` (an object, not a function) | TypeScript error: the argument must be `() => ReadRequest \| null` |
| calling `query()` inside an `onclick` | Svelte throws `lifecycle_outside_component` (context and runes need component initialisation) |
| no `setTarol` above the component | `Error: tarol-svelte: call setTarol(client) in a parent component first` |
| `live()` without a push connection | `Error: tarol-svelte: live() needs a push connection` |
| a hand-typed topic string (`'artflow.bid-placd'`) | no type error; the hub refuses it (`Hub.Forbidden` in `onRefused`) and the page never updates: use `topics.<name>` |
| `live()` plus an `$effect` comparing `message.subject` to re-read a view | unnecessary, and lossy: `live()` keeps only the last message of a burst; use `query(…, { live })` |
| a hand-written `{ path: \`/auctions/${id}\` }` with `live` | every message of the topic re-reads it (no `subject`); use the generated request |
| a saga's topic on a view without `subject: null` | its messages carry the saga's stream id, so the view never updates |
| refetching after `submit()` | unnecessary: queries revalidate after own changes (with `Tarol-Read-After`); to show "Saved" only once they did (a next save starts from the new view), pass `awaitRevalidation: true` |
| `{@html}` of server text | never; render text |
| changing `view.value` by hand for an optimistic UI | `value` is read-only; use `view.patch(update)` and return its rollback from `optimistic` |
| an edit form with `expectedVersion: () => view.version` but no `from` under a live view | the version is read at submit, after the live view moved on: an edit made on old values **overwrites** another user's change silently |
| `from` with nested fields (`lines[1].quantity`) | only top-level fields are compared; a nested object counts as one value |
| `optimistic` without `expectedVersion` | a concurrent change is not detected (no 409), so the patch may show a value that never existed |

## Notes

* Plain Svelte 5 (Vite SPA). The runes are compiled by your app's Svelte plugin; nothing global runs at import.
* `Rule` kinds: `Required`, `NotEmpty`, `Range`, `Length` (UTF-16 units), `Pattern` (ECMAScript, `u` flag), `Email` (the
  backend's rule), `Count`; one code per value, as on the server. The generator (`@clorat/tarol-codegen`) writes them.

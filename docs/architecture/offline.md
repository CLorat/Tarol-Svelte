# Design note: offline outbox and offline reads (Tatalu round 2)

Status: **proposal, not built** (TS-26, TS-27). For the owner's decision; nothing here is in a package yet. Labels as in
the [philosophy](philosophy.md).

## Tatalu's need

Tatalu is a PWA for carers who work where the network drops (outings, basements). It needs:

* **Outbox** (FB-F17.3-1, FB-F04.1-5): a change captured offline is stored **before** it is sent, survives a closed tab
  and a restart, is sent in capture order with the **same idempotency key** on every attempt, separates "try again later"
  (network, 5xx, 429) from "refused" (4xx with a code, kept visible until the person retries or discards), stops on a 401
  after an offline start until the person signs in, and tells a screen the result of the first attempt (sent / queued /
  refused with code). Tatalu's `lib/offline/queue.svelte.ts` (`OfflineQueue`, ≈ 300 lines) and `lib/offline/idb.ts` do it
  today, scoped per `<tenant>/<person>`.
* **Device and capture time** (FB-F17.3-6, FB-F13.2-4): offline captures carry the device and the instant of capture;
  Tatalu puts a `Capture` record into every input. Tarol-Net round 2 is to read headers `Tarol-Device` (an opaque device
  id) and `Tarol-Captured-At` (RFC 3339 instant) at the HTTP edge into `OperationContext`, with a clock-skew bound.
* **Offline reads** (FB-F17.3-5, FB-F04.6-3): selected views (a child's emergency card, today's children) must be readable
  offline, also when not opened today, with the time of the stored state (`savedAt`, "as of 07:42"). Tatalu wraps `fetch`
  (`lib/offline/reads.svelte.ts`) and reads ahead with `client.read` (`AttendanceTile`).

## Options

| | A. In tarol-client (framework-free) + a rune | B. A separate package `@clorat/tarol-offline` | C. Recipes in the docs only |
|---|---|---|---|
| Outbox | `createOutbox({ client, storage, scope })` in `@clorat/tarol-client/outbox` (subpath, tree-shaken), `outbox(…)` state in tarol-svelte, `changeForm(…, { queue })` | same API, own budget and README | Tatalu keeps its code |
| Reads | `ClientOptions.cache: CacheStore` (get/set/delete by key) with an IndexedDB adapter, `Ok.fromCache`/`savedAt`, `client.prefetch(requests)` | same | — |
| Cost | one more subpath; core client unchanged when unused (verified by `check-treeshake`) | one more package to release, depends on tarol-client | none |

**Recommendation: A**, as two subpaths `@clorat/tarol-client/outbox` and `@clorat/tarol-client/idb` (the IndexedDB
adapter, the only code that touches `indexedDB`), because the outbox must use the client's own transport (idempotency,
token refresh, problem mapping) and the cache hook must sit inside `read` (ETag, `Tarol-Read-After`).

## Proposed API (sketch)

```ts
// @clorat/tarol-client/outbox
interface OutboxStorage {           // IndexedDB adapter: idbOutbox(name); tests: memoryOutbox()
  load(scope: string): Promise<Entry[]>; put(entry: Entry): Promise<void>; remove(id: string): Promise<void>;
}
interface Entry { id: string /* = idempotency key */; scope: string; request: ChangeRequest; label: string;
  capturedAt: string; state: 'pending' | 'failed'; code?: string; attempts: number }
const outbox = createOutbox({ client, storage: idbOutbox('app'), scope: () => `${tenant}/${subject}`, device: deviceId });
const first = await outbox.submit(request, { label: 'note' }); // Result of the first attempt, or { queued: true }
outbox.pending; outbox.failed; outbox.flush(); outbox.retry(id); outbox.discard(id); outbox.onChange(listener);
```

Every attempt sends `Idempotency-Key: <entry.id>`, `Tarol-Device: <device>` and `Tarol-Captured-At: <capturedAt>`; a
transient failure keeps the entry and backs off (5/15/30/60 s, and at `online`); a 401 pauses until `flush()` after a new
sign-in; a refusal moves the entry to `failed` with its code. `changeForm(…, { queue: outbox })` submits through it and
reports `queued` instead of `Network`. The catalogue gains `Outbox.Queued` ("will be sent") next to `Network` ("not sent").

```ts
// reads
createClient({ baseUrl, cache: idbCache('app', { keep: (path) => path.startsWith('/children/') }) });
const r = await client.read(path); if (r.ok && r.fromCache) show(`as of ${r.savedAt}`);
await client.prefetch([requests.childCard({ child }), requests.todayList()]);
```

## Open questions for the owner

1. Is offline capture a framework concern (A) or an app concern (C)? It adds about 1.5–2 KB gzip as a subpath **[unverified]**.
2. Device id: generated and kept by the outbox (a random UUID in its storage) or supplied by the app (Tatalu has
   `Device` records)? Proposal: supplied by the app.
3. The two headers need Tarol-Net round 2 (accepted, CORS-allowed, skew bound) before the client sends them; until then a
   browser preflight refuses them on cross-origin APIs.
4. Personal data at rest: the outbox and the cache store request bodies and views in IndexedDB unencrypted. Proposal: the
   storage is the app's choice, scoped per person, cleared at `logout()`/`revoke()`; encryption stays out.

## Explicitly not included

Conflict resolution between devices (FB-F17.3-8, see `ConflictCard` in the round-2 step note), Web Push (FB-F17.4-1),
service-worker code, background sync, and retrying `Stream.VersionConflict` (Tarol-Net round 2 retries a change without
`If-Match` on the server).

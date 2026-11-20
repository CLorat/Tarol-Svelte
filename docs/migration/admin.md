# Step 10: `@clorat/tarol-admin` (optional admin UI)

Backend entries ([overview.md](../architecture/overview.md#operations-data-protection-jobs-taroloperations-taroldataprotection-taroljobs)):
dead letters (list with keyset paging, re-drive one or filtered, discard), projection versions (list, drop), subject
export and erase, `/health/tarol`. Jobs have no HTTP endpoints, so they show only as dead letters and in the health check.

Waits for BC-10 (problem+json with codes, no 500 on a failed erasure, a kinds endpoint, OpenAPI metadata). Screens: a
status page, a dead-letter table with re-drive and discard (confirm dialogs), projection versions, and a data-subject page
(export download, erase with a typed confirmation). The admin package is a set of components plus one `AdminApp` that an
app mounts under a route of its choice; it adds no global state.

## Status (2026-11-19): blocked by BC-10, not built (history)

BC-10 had not landed then; the table below is what the admin entry answered at `73b35ff`. It was built in step 12 (PR C,
[backend-fixes.md](backend-fixes.md)) once Tarol-Net #91 (BC-10) was merged; see "Built" below.

BC-10 has not landed (`CLorat/Tarol-Net@main` is still `73b35ff`; no open PR for it). What the admin entry answers today,
on the running sample [verified, alice with `tarol-admin`]:

| Request | Answer | What the UI would need |
|---|---|---|
| `GET /tarol/admin/dead/reactions` | 200 `{"items":[],"next":null}` | fine (keyset page) |
| `GET /tarol/admin/dead/unknown` | 404 `{"error":"No dead letters of kind 'unknown' are registered (jobs, reactions)."}` | a problem with a code (`Admin.UnknownKind`) |
| `GET /tarol/admin/dead` | 404, empty body | the kinds endpoint (the kinds are only in the error sentence above) |
| `DELETE /tarol/admin/dead/reactions/999999` | 404, empty body | a problem with a code (`DeadLetter.NotFound`) |
| `POST /tarol/admin/dead/reactions/999999/redrive` | 404, empty body | the same |
| `GET /tarol/admin/projections` | 200, the versions with state, rows and bytes | fine |
| `DELETE /tarol/admin/projections/auction-list/1` | 409 `{"error":"'auction-list' v1 is the newest version …"}` | a problem with a code (`Projection.Current`) |
| `POST /tarol/admin/subjects/{id}/erase?tenant=…` | **500, empty body**, although the key is erased; again 500 when repeated (e2e.md) | 200 with `alreadyErased`, or a problem |
| `/openapi/v1.json` | no admin path | `Produces` metadata, so tarol-codegen types the admin client |

Every refusal would reach the UI as free English text or as nothing. Showing it means either printing the backend's
English (P7: no literal text, translated codes) or parsing sentences into codes: both are the client workaround the
rules forbid. So step 10 waits; nothing is built. What is ready for it: `DataTable` (keyset pages for dead letters),
`Dialog` (confirm re-drive and discard), `DetailLayout` and the subject screen of the docs app (export and erase, step 8),
`MenuButton` for row actions.

When BC-10 lands: regenerate the typed admin client from the OpenAPI document, add the codes to the `en`/`de` catalogues,
then build `AdminApp` (status, dead letters, projections, data subject) as described above, with the e2e scenarios
re-drive, discard, drop a superseded version, and erase (200).

## Built (2026-11-20, step 12 PR C)

**Backend facts** [verified against the sample at `Tarol-Net@fe0a2bd` + #109, alice and ada with `tarol-admin`, bob and
ben without]: `GET dead` 200 `["jobs","reactions"]`; `GET dead/reactions` 200 `{"items":[],"next":null}`; unknown kind 404
`Admin.Kind`; redrive/discard of a missing id 404 `Admin.NotFound`; drop of the current version 409 `Projection.Drop`;
export without `?tenant=` 400 `Admin.Tenant`; every error `application/problem+json` with `code` and `traceId`; erase 200
`{tenant, subject, alreadyErased, streams}`, again 200 with `alreadyErased: true`; bob/ben 403 **without a body and
without `Tarol-Request-Id`** (the role check runs in ASP.NET's authorization middleware: BC-21); the document has the nine
`TarolAdmin…` operations with `x-tarol-kind: admin`, `x-tarol-errors`, their schemas, and an export without a schema
(BC-20).

**Package** `@clorat/tarol-admin` (new):
* `AdminApp` (`prefix` default `/tarol/admin`, `messages` default `adminEn`, `tenant`, bindable `section`): tabs for dead
  letters, projections and the data subject; `adminEn`, `adminDe`; `adminErrors` (the codes of each admin operation, from
  the generated client). Internal: `DeadLetters` (kind `<select>`, `DataTable` with keyset pages of 50, a `MenuButton`
  per row, "re-drive all", one confirmation `Dialog`, toasts), `Projections` (a table, drop only for superseded versions,
  confirmation), `DataSubject` (subject id and tenant fields, export as a JSON download from a `Blob`, erase after typing
  the id, 409 `DataProtection.ErasureIncomplete` with its `failed` participants and "Try again").
* The client is generated: `scripts/extract.mjs` takes the admin paths (relative to the prefix) and their schemas from the
  sample's document into `openapi.admin.json`; `tarol-codegen` writes `src/lib/api.ts`; `check:package` fails when
  either is stale. `AdminApp` puts the prefix back (`under(prefix, request)`).
* `@clorat/tarol-client`: `Problem.extensions` (new): a problem's members other than the RFC 9457 and Tarol ones (the
  `failed` list of an incomplete erasure).
* `@clorat/tarol-codegen`: the generated module imports only the client types it uses (an admin-only document has no
  `Page` and no `Created`; the unused imports failed lint).
* The docs app: `#/admin` (an example route) replaces the step 8 example screen `artflow/Subject.svelte`; a catalogue page
  `AdminApp` over the demo client (one dead reaction, a superseded projection); `props.mjs` documents exported components
  only (it had listed the admin package's internal parts).

**Size** (SV-18: ≤ 6 KB gzip without Svelte and the other `@clorat` packages): **5.98 KB gzip / 5.15 KB brotli**
(22.7 KB raw) [verified]. Two trims to get there, measured: the dead-letter table's state as one `Object.create` over the
list instead of five getters, and two CSS rules less (6.04 → 5.98 KB).

**Found while building**:
* CLS on the catalogue page was 0.0136, then 0.021: the dead-letter list showed its empty text while the kinds loaded,
  then the skeleton, then a one-row table. The table's state is now loading until the kinds and the first page are there,
  and the table area keeps the skeleton's height (a shorter page moves nothing below). CLS 0 [verified with a
  `layout-shift` observer], axe 0 in both themes.
* BC-21 and BC-22 (changes.md): no reference on a policy 403; the sample cannot produce a dead letter or a superseded
  projection version, so re-drive, discard and drop run against the demo and the component tests' fake backend only.

**Tests**: component tests (Chromium, axe) **7**: dead letters (kinds, list, re-drive, cancel, discard, re-drive all), a
refused action by code and reference under a custom prefix (`/ops`), the 403 with its reference, projections (drop only
superseded, the confirmation, `Projection.Drop` shown), data subject (export download with `tenant`, erase disabled
until the id is typed, the 409 with `failed` and the reference, "Try again" → erased), German texts, and the catalogues
(same keys in `adminEn`/`adminDe`; every code of `adminErrors` has a message). Client: `keeps a problem's extension
members` (failed before). e2e against the sample (ada, ben): `the admin UI: ada exports a data subject, erases it, and its
export has no personal data left (BC-10)` (the erase answers **200**; it was a 500 without a body: the BC-10 annotation of
step 8 is gone) and `the admin UI: ada sees the dead-letter kinds and the projections; ben gets the 403 (BC-10)`.

**Skill evaluation checklist** (`skills/tarol-admin/SKILL.md`):

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "Add an operator page to my app" | `<AdminApp />` on a route, inside `ThemeRoot`, after `setTarol` | calling `/tarol/admin` by hand; decoding the token to hide the page |
| "The backend maps the admin entry at /ops" | `prefix="/ops"` | editing the generated client |
| "German operators" | `messages={adminDe}` | copying the catalogue into the app |
| "Erase a person's data" | the data-subject tab: id, tenant (empty GUID for none), type the id to confirm | leaving out the tenant (400 `Admin.Tenant`) |
| "An erasure answered 409" | read the participants, "Try again" (idempotent) | treating it as final, or showing `detail` |


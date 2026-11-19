# Step 10: `@clorat/tarol-admin` (optional admin UI)

Backend entries ([overview.md](../architecture/overview.md#operations-data-protection-jobs-taroloperations-taroldataprotection-taroljobs)):
dead letters (list with keyset paging, re-drive one or filtered, discard), projection versions (list, drop), subject
export and erase, `/health/tarol`. Jobs have no HTTP endpoints, so they show only as dead letters and in the health check.

Waits for BC-10 (problem+json with codes, no 500 on a failed erasure, a kinds endpoint, OpenAPI metadata). Screens: a
status page, a dead-letter table with re-drive and discard (confirm dialogs), projection versions, and a data-subject page
(export download, erase with a typed confirmation). The admin package is a set of components plus one `AdminApp` that an
app mounts under a route of its choice; it adds no global state.

## Status (2026-11-19): blocked by BC-10, not built

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

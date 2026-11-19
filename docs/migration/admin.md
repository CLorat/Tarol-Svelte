# Step 10: `@clorat/tarol-admin` (optional admin UI)

Backend entries ([overview.md](../architecture/overview.md#operations-data-protection-jobs-taroloperations-taroldataprotection-taroljobs)):
dead letters (list with keyset paging, re-drive one or filtered, discard), projection versions (list, drop), subject
export and erase, `/health/tarol`. Jobs have no HTTP endpoints, so they show only as dead letters and in the health check.

Waits for BC-10 (problem+json with codes, no 500 on a failed erasure, a kinds endpoint, OpenAPI metadata). Screens: a
status page, a dead-letter table with re-drive and discard (confirm dialogs), projection versions, and a data-subject page
(export download, erase with a typed confirmation). The admin package is a set of components plus one `AdminApp` that an
app mounts under a route of its choice; it adds no global state.

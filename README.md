# tarol-svelte

The Svelte client for [Tarol](https://github.com/CLorat/Tarol-Net): typed calls to every backend entry, forms that show the
server's field errors where they belong, live updates from the UI push hub, and a small accessible design system, so a Tarol
app has its first screen working in minutes and stays fast as it grows.

**Status: design.** The packages are built step by step ([plan](docs/migration/plan.md)).

| Package | What |
|---|---|
| `@clorat/tarol-client` | framework-free client: transport, results, ids, ETag cache, idempotency, push |
| `@clorat/tarol-oidc` | OIDC code + PKCE (Zitadel preset) |
| `@clorat/tarol-svelte` | Svelte 5 runes: `query`, `changeForm`, `live` |
| `@clorat/tarol-codegen` | typed client from the backend's OpenAPI document |
| `@clorat/tarol-design` | tokens, themes, accessible primitives |
| `@clorat/tarol-components` | data table, forms, dialogs, toasts, app shell |

Docs: [philosophy](docs/architecture/philosophy.md) · [overview and backend inventory](docs/architecture/overview.md) ·
[decisions](docs/migration/decisions.md) · [backend changes needed](docs/backend/changes.md).

Licence: AGPL-3.0-only (see `LICENSE` and `NOTICE`); a commercial licence is available from the copyright holder.
Contributions need a CLA (`CONTRIBUTING.md`).

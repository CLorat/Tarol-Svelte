---
name: tarol-admin
description: >-
  Use when an app needs the operator screens of a Tarol backend: dead letters (re-drive, discard), projection versions
  (drop), a data subject's export and erasure. Covers AdminApp, adminEn, adminDe and adminErrors from @clorat/tarol-admin.
  Do not hand-write calls to /tarol/admin or parse the backend's admin error text.
---

# Tarol admin UI (`@clorat/tarol-admin`)

## Rules

1. Mount `<AdminApp />` on a route of your app, inside `ThemeRoot` and after `setTarol(client)` (from
   `@clorat/tarol-svelte`). It needs nothing else and adds no global state.
2. `prefix` is where the backend calls `MapTarolAdmin(prefix)`; default `/tarol/admin`.
3. Access is the backend's: a user without its admin role sees the 403 `Auth.Forbidden` message. Do not hide the route
   by decoding the token yourself.
4. Texts: `messages={adminDe}` for German (default `adminEn`); they are looked up before the app's catalogue, so the
   app's own `ui.*` and `Auth.*` texts still apply. A new backend code needs a message: `adminErrors` lists them.
5. The data subject's `tenant` is required by the backend (`Admin.Tenant` without it); the empty GUID means data without
   a tenant. Pass `tenant` to start with another one.
6. An incomplete erasure (409 `DataProtection.ErasureIncomplete`) is safe to repeat: the screen offers "Try again".

## Example

```svelte
<script lang="ts">
  import { AdminApp, adminDe } from '@clorat/tarol-admin';
  let section = $state('dead'); // or 'projections', 'subject'
</script>

<h1>Betrieb</h1>
<AdminApp prefix="/ops" messages={adminDe} bind:section />
```

## Common mistakes

| Mistake | What happens |
|---|---|
| `AdminApp` without `setTarol(client)` above it | `Error: tarol-svelte: call setTarol(client) in a parent component first` |
| the wrong `prefix` | every section shows `NotFound` (404 without a problem body) |
| erasing without `tenant` for tenant data | 400 `Admin.Tenant`: "Enter the tenant as a GUID …" |
| dropping the current projection version | the button is not offered; the backend would answer 409 `Projection.Drop` |
| showing the backend's `detail` text to users | use the code's message; `detail` is English and for logs |

## Notes

* The admin client is generated from the backend's OpenAPI document (operation ids `TarolAdmin…`); the export has no
  schema in the document yet, so it is offered as a JSON download as the backend sends it.
* Only text nodes, never `{@html}`: dead-letter errors and names are server text.

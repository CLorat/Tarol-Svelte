---
name: tarol-codegen
description: >-
  Use when a tarol-svelte app needs a typed client for its Tarol backend, when the backend added or changed an entry, or
  when the generated api file is out of date. Covers the tarol-codegen CLI (-o, --check), the generated requests, rules
  and tarol(client), and GenerateError. Do not hand-write fetch calls or route strings, edit the generated file, or
  add an OpenAPI generator from another vendor.
---

# tarol-codegen

## Rules

1. Generate from the backend's own document: `tarol-codegen <url or file> -o src/lib/api.ts`. The backend serves it when
   it calls `AddOpenApi(o => o.AddTarolEndpoints())` and `MapOpenApi()` (`/openapi/v1.json`).
2. Never edit the generated file; regenerate after every backend change. In CI run the same command with `--check`
   against a committed copy of the document: it exits 1 when the file is stale.
3. Use the three exports:
   * `requests.<op>(…)` builds a `ReadRequest` or `ChangeRequest`: pass it to `list(() => requests.x(q))`,
     `query(() => requests.y(p))`, `changeForm(requests.z, initial)` from `@clorat/tarol-svelte`.
   * `tarol(client).changes.<op>(input, { key, expectedVersion })` and `.queries.<op>(…)` for code outside components.
   * `rules.<op>` for `changeForm(…, { rules })`: the backend's rules and codes per field path (`lines[].quantity`).
4. Names are the backend's operation ids (its C# type names) in camelCase: `CreateAuction` → `createAuction`.
5. Lists have no `offset`: page with `after` (keyset).
6. Path members and body members go into one input object: `placeBid({ auction, amount })`.

## Example

```ts
import { createClient } from '@clorat/tarol-client';
import { tarol } from './api';

const api = tarol(createClient({ baseUrl: '/api', tokens }));
const created = await api.changes.createAuction({ reserve: 100 });
if (created.ok) await api.changes.placeBid({ auction: created.value.id, amount: 150 }, { expectedVersion: created.value.version });
```

## Common mistakes

| Mistake | What happens |
|---|---|
| `auctionSearch({ offset: 10 })` | TypeScript error: `offset` does not exist (keyset paging only) |
| `auctionSearch({ sort: 'Price' })` | TypeScript error: only the backend's sort members are allowed |
| an OpenAPI 3.0 document | `GenerateError: #/openapi: OpenAPI 3.0.x is not supported (3.1 or later)` |
| a schema the generator cannot type exactly | `GenerateError` with its JSON pointer; fix the backend contract, do not patch the output |
| expecting branded ids (`Id<'Auction'>`) | they appear once the backend emits `x-tarol-id` (proposed backend change BC-3); until then ids are `string` |

## Notes

The generated module imports only types from `@clorat/tarol-client`; its runtime is ≈ 80 B gzip per backend entry.

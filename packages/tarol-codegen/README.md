# @clorat/tarol-codegen

Generates the typed client of a [Tarol](https://github.com/CLorat/Tarol-Net) backend from its OpenAPI document: one
TypeScript module with the schema types, request builders for the `@clorat/tarol-svelte` runes, typed calls over a
`@clorat/tarol-client`, and the backend's validation rules with their codes. A dev dependency: nothing of it runs in the
browser except the generated module (≈ 80 B gzip per backend entry).

```bash
tarol-codegen http://localhost:5080/openapi/v1.json -o src/lib/api.ts     # or a saved openapi.json
tarol-codegen openapi.json -o src/lib/api.ts --check                       # CI: fails when the file is out of date
```

```ts
import { createClient } from '@clorat/tarol-client';
import { requests, rules, tarol } from './api';

const api = tarol(createClient({ baseUrl: '/api', tokens }));
const created = await api.changes.createAuction({ reserve: 100 });          // Result<Created>
const page = await api.queries.auctionSearch({ sort: 'HighestBid' });       // Result<Page<AuctionRow>>

// in a component
const auctions = list(() => requests.auctionSearch({ settled }));
const form = changeForm(requests.createAuction, { reserve: null }, { rules: rules.createAuction });
```

The backend opts in with `AddOpenApi(o => o.AddTarolEndpoints())` and `MapOpenApi()` (Tarol-Net). What it translates:

| Backend | Generated |
|---|---|
| operation (`operationId` = C# type) | `requests.<name>`, `tarol(client).changes.<name>` or `.queries.<name>` |
| creation (201) / change (204) | `Result<Created>` / `Result<undefined>`; input = path members & body |
| view / list (`{items, next}`) | `Result<View>` / `Result<Page<Row>>`; `<Op>Query` without `offset` (keyset only) |
| `["number","string"]` + pattern (ASP.NET Web defaults) | `number` |
| `Id<T>` with `x-tarol-id` (proposed BC-3) | `Id<'Auction'>` branded types; plain `string` until the backend emits it |
| `minLength`/`maxLength`/`minimum`/`maximum`/`minItems`/`maxItems`/`pattern`/`format: email`, required members, `x-tarol-rules` (BC-4) | `rules.<change>['path']` with the backend codes; .NET-only patterns are left to the server |

A construct it cannot translate exactly stops generation with its JSON pointer (`GenerateError`), never `any`.

Licence: AGPL-3.0-only, or a commercial licence from the copyright holder.

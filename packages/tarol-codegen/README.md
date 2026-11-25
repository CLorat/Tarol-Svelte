# @clorat/tarol-codegen

Generates the typed client of a [Tarol](https://github.com/CLorat/Tarol-Net) backend from its OpenAPI document: one
TypeScript module with the schema types, request builders for the `@clorat/tarol-svelte` runes, typed calls over a
`@clorat/tarol-client`, and the backend's validation rules with their codes. A dev dependency: nothing of it runs in the
browser except the generated module (≈ 80 B gzip per backend entry).

```bash
tarol-codegen http://localhost:5080/openapi/v1.json -o src/lib/api.ts     # or a saved openapi.json
tarol-codegen openapi.json -o src/lib/api.ts --check                       # CI: fails when the file is out of date
```

Exit codes: `0` written (or up to date with `--check`); `1` any failure, with one line `tarol-codegen: …` on stderr (a
document it cannot translate, with its JSON pointer; a missing file; an HTTP status other than 2xx; a body that is not
JSON; a stale file with `--check`); `2` missing arguments (the usage on stderr). Only `wrote <file>` goes to stdout.

```ts
import { createClient } from '@clorat/tarol-client';
import { requests, rules, tarol } from './api';

const api = tarol(createClient({ baseUrl: '/api', tokens }));
const created = await api.changes.createAuction({ reserve: 100 });          // Result<Created>
const page = await api.queries.auctionSearch({ sort: 'HighestBid' });       // Result<Page<AuctionRow>>

// in a component
const auctions = list(() => requests.auctionSearch({ settled }));
const form = changeForm(allowNull(requests.createAuction), { reserve: null }, { rules: rules.createAuction });
```

The backend opts in with `AddOpenApi(o => o.AddTarolEndpoints())` and `MapOpenApi()` (Tarol-Net). What it translates:

| Backend | Generated |
|---|---|
| operation (`operationId` = C# type) | `requests.<name>`, `tarol(client).changes.<name>` or `.queries.<name>` |
| `x-tarol-kind` (`creation`, `change`, `view`, `list`, `search`, `admin`, `me`) | the call's shape; nothing is guessed from the responses. An operation without it is not a Tarol entry: skipped with a warning and named in the header (`--strict` / `{ strict: true }`: an error) |
| creation (201) / change (204) | `Result<Created>` / `Result<undefined>`; input = path members & body |
| view by one `x-tarol-id` path parameter | its request also carries `subject: <id>` and `stream: '<Aggregate>'`, the stream a live query filters messages by (SV-24) |
| `x-tarol-topics` (Tarol-Net BC-25) | `topics.<name>: Topic<Payload, '<Stream>'>` with the payload's schema as its type, imported from `@clorat/tarol-client/push`; nothing without the extension |
| view / list (`{items, next}`) / search / `me` | `Result<View>` / `Result<Page<Row>>` / the search page; `<Op>Query` without `offset` (keyset only); required query values are required |
| admin (`TarolAdmin…`) | GETs are reads, the others changes with their 200 type; query values such as `tenant` are part of the input; the subject export has no schema (BC-20) and is `unknown` |
| `x-tarol-errors` | `<Op>Code` (a union of the declared codes) in `Result<T, <Op>Code>`, and `errors.<op>` (the list, e.g. to check a message catalogue); a code the backend builds at run time is not declared |
| `TarolProblem` | no type: the client reads problems as its `Violation` |
| `["number","string"]` + pattern (ASP.NET Web defaults) | `number` |
| `Id<T>` with `x-tarol-id` (on schemas and on path parameters) | `Id<'Auction'>` branded types |
| `x-tarol-rules` (the backend's codes, `flags` `i`/`u`), `x-tarol-email` (must be the e-mail check `isEmail` implements), required members; JSON Schema keywords where there are no `x-tarol-rules` (`multipleOf` → `Scale`, decimal places of the JSON number) | `rules.<change>['path']` with the backend codes; patterns `RegExp` cannot read are left to the server |

A construct it cannot translate exactly stops generation with its JSON pointer (`GenerateError`), never `any`.

Licence: AGPL-3.0-only, or a commercial licence from the copyright holder.

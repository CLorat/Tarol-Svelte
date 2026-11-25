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
     `query(() => requests.y(p))`, `changeForm(requests.z, initial)` from `@clorat/tarol-svelte`. A view by id carries
     `subject` (its stream id) and `stream`, so its `live` topics skip messages about other aggregates.
   * `topics.<name>` from the backend's `x-tarol-topics` (Tarol-Net `0.1.0-preview.5`): `live: topics.bidPlaced` and
     `live(() => topics.bidPlaced)` are checked names with a typed payload (`PushedMessage<BidPlacedV1>`); the name is
     the part after the system (`artflow.bid-placed` → `bidPlaced`), or the whole name when two systems share it.
   * `tarol(client).changes.<op>(input, { key, expectedVersion })` and `.queries.<op>(…)` for code outside components.
   * `rules.<op>` for `changeForm(…, { rules })`: the backend's rules and codes per field path (`lines[].quantity`).
4. Names are the backend's operation ids (its C# type names) in camelCase: `CreateAuction` → `createAuction`.
5. Lists have no `offset`: page with `after` (keyset).
6. Path members and body members go into one input object: `placeBid({ auction, amount })`.
7. Ids are branded (`AuctionId = Id<'Auction'>`): brand a route value or a plain id once with `asId<'Auction'>(s)` from
   `@clorat/tarol-client` (it throws on a non-UUID). The 201 of a creation is a plain `string` id for now (backend BC-19).
8. Nullable members are `T | null`: `oneOf`/`anyOf` of `{type: "null"}` and one schema (`PersonName?`, `Gender?`,
   `Option<PostalAddress>`) and a type array with `"null"` (`["null", "object"]` with members is `type X = {…} | null`). A
   nullable member has no `Required` rule; the rules of a nullable record's members are skipped while it is `null`.
9. Types and constants no operation uses come from the backend's document root: `x-tarol-types` (schema names; each is
   exported as a type, an unknown name is a `GenerateError`) and `x-tarol-constants` (`export const Name = <literal> as
   const;`). Import them from the generated file; never copy a backend enum or constant by hand.
10. Results carry the operation's codes: `Result<undefined, PlaceBidCode>`; `r.violation.code === 'Bid.TooLow'` is checked
   by TypeScript. `errors.placeBid` lists them at run time.

## Example

```ts
import { asId, createClient } from '@clorat/tarol-client';
import { tarol } from './api';

const api = tarol(createClient({ baseUrl: '/api', tokens }));
const created = await api.changes.createAuction({ reserve: 100 });
if (created.ok) {
  const auction = asId<'Auction'>(created.value.id);
  const bid = await api.changes.placeBid({ auction, amount: 150 }, { expectedVersion: created.value.version });
  if (!bid.ok && bid.violation.kind === 'error' && bid.violation.code === 'Bid.TooLow') showTooLow();
}
```

## Common mistakes

| Mistake | What happens |
|---|---|
| `auctionSearch({ offset: 10 })` | TypeScript error: `offset` does not exist (keyset paging only) |
| `auctionSearch({ sort: 'Price' })` | TypeScript error: only the backend's sort members are allowed |
| an OpenAPI 3.0 document | `GenerateError: #/openapi: OpenAPI 3.0.x is not supported (3.1 or later)` |
| a schema the generator cannot type exactly | `GenerateError` with its JSON pointer; fix the backend contract, do not patch the output |
| passing a row's or a URL's `string` where an `AuctionId` is expected | TypeScript error; brand it once with `asId<'Auction'>(s)` (a view row's `Guid Id` carries no `x-tarol-id`) |
| an operation without `x-tarol-kind` (an app's plain endpoint) | skipped with `tarol-codegen: warning: … skipped, no x-tarol-kind` and named in the header comment; call it with your own code. With `--strict` (`{ strict: true }`): `GenerateError: …/x-tarol-kind: x-tarol-kind is required` |
| hiding a plain endpoint from the document (`ExcludeFromDescription`) only to make the generator pass | not needed any more: it is skipped |
| `bid.violation.code === 'Auction.NotSeller'` on a `PlaceBid` result | TypeScript error: not one of `PlaceBidCode` or the client's own codes |

## Notes

The generated module imports only types from `@clorat/tarol-client`; its runtime is ≈ 85 B gzip per backend entry
(1,340 B for the sample's 16 entries, admin and search included).

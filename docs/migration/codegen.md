# Step 5: `@clorat/tarol-codegen` (typed client generator)

## 1. Inventory: what the backend contract carries today

The sample's `/openapi/v1.json` (OpenAPI **3.2.0**, 23,724 bytes, captured 2026-11-19 [verified]; a copy is the
generator's test fixture) has six operations: `AuctionSearch` (`GET /auctions`), `CreateAuction`, `AuctionView`, `PlaceBid`,
`SettleAuction`, `MyAuctions`. It carries:

* operation ids = the C# type names; path, query and header parameters (`If-Match`, `Idempotency-Key`, `sort` enum,
  `after`, `limit`, `offset`, `count`); 201 schema `{id: uuid, version: int64}`; the page schema `{items, next, total}`;
* component schemas for inputs, views and rows, with `Id<T>` as `string/uuid` (no aggregate name);
* numbers as `type: ["number","string"]` with a decimal `pattern` (ASP.NET's `AllowReadingFromString` leaking into response
  schemas);
* problem responses with an **empty** `application/problem+json` content;
* no `x-tarol-*` extensions; search, admin, health and the hub are not in the document.

## 2. Candidates, with measurements

| Candidate | Runtime gzip | Types for problems / ids / pages | Tarol semantics | Developer loop |
|---|---|---|---|---|
| **own generator**: OpenAPI + `x-tarol-*` → TS calling `tarol-client` | 0 KB beyond `tarol-client` (core ≤ 3 KB); generated code per operation ≈ 1 line | exact once BC-3 lands (ids branded per aggregate, error-code unions, pages); good on plain OpenAPI already | idempotency, ETag, Read-After, Result unions come from the core | `tarol-codegen <url-or-file> -o src/tarol` in a `predev` script; deterministic output, snapshot-tested |
| `openapi-typescript` 7.13.0 + `openapi-fetch` 0.17.0 (MIT) | 3.62 KB | errors untyped (empty schemas); `uuid` as `string` | wrapped by hand | good |
| `@hey-api/openapi-ts` 0.99.0 (MIT) | generated SDK + client [not measured: superseded by SV-4] | same gaps | wrapped by hand | good |
| backend emits TS | 0 KB | exact | exact | needs a .NET build to regenerate |

Decided: own generator (SV-4). Measurement of the generated output for the sample is recorded in the step-5 PR.

## 3. Design

Output (one file, no runtime dependency except `@clorat/tarol-client`):

```ts
export type AuctionId = Id<'Auction'>;                      // from x-tarol-id (BC-3); `string` brand per path name meanwhile
export interface CreateAuction { reserve: number }
export interface AuctionRow { id: AuctionId; seller: string; reserve: number; highestBid: number; … }
export const changes = (c: TarolClient) => ({
  createAuction: (input: CreateAuction, o?: ChangeOptions) => c.change<Created<AuctionId>>({ method: 'POST', path: '/auctions', body: input }, o),
  placeBid: ({ auction, ...body }: { auction: AuctionId } & PlaceBid, o?: ChangeOptions) => c.change<void>({ method: 'POST', path: `/auctions/${encodeURIComponent(auction)}/bids`, body }, o),
});
export const queries = (c: TarolClient) => ({ auctions: { list: (q: AuctionSearchQuery = {}) => c.read<Page<AuctionRow>>('/auctions', { query: q }) }, … });
export const rules = { CreateAuction: { reserve: [{ rule: 'Range', code: 'Range', min: 1, max: 1000000 }] } } as const; // BC-4
```

* Kind detection: `x-tarol-kind` (BC-3); until then from the shape (201 + `{id,version}` → creation; 204 → change; 200 page
  schema → list; 200 otherwise → view).
* Numbers: `["number","string"]` + pattern → `number` in outputs and inputs (the client always sends numbers).
* Unknown or unsupported schema constructs are a generator **error** with the JSON pointer, never `any`.

## 4. Decisions

SV-4, SV-5; answered. Backend changes BC-3 and BC-4 are proposed ([backend/changes.md](../backend/changes.md)).

## 5. What the PR must do

CLI and library; snapshot tests on the sample fixture and on synthetic documents (every schema construct); a type-check
test that compiles the generated output with `tsc --strict`; README; skill `tarol-codegen`.

## 6. Skill evaluation checklist

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "Call the new backend change" | regenerate, then `changes.<name>(input)` | hand-writing `fetch('/…')` |
| "The backend added a field" | rerun the generator | editing the generated file |

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

## 6. Built: public API, choices and verification

**Public API (new)**, report `packages/tarol-codegen/api/tarol-codegen.api.md`: `generate(document, options)`,
`GenerateError` (with `pointer`), `GenerateOptions`, and the input types `OpenApiDocument`, `Operation`, `Parameter`,
`Schema`, `GeneratedRule`; the CLI `tarol-codegen <input> -o <out> [--check]` (exit 0, 1 on a stale file or a
`GenerateError`, 2 on usage).

**The generated module** (`packages/tarol-codegen/test/__snapshots__/artflow.ts` for the sample): schema types, `<Op>Query`
and `<Op>Input` types, `requests` (descriptors for the runes), `rules` (per change and field path) and `tarol(client)`
(`changes`, `queries`). It imports only types from `@clorat/tarol-client`.

**Choices made while building**

* Branded ids only from `x-tarol-id` (BC-3). Branding by heuristics (path parameter names) would make a created id
  (`string`) unusable as the next call's `Id<'Auction'>`; one rule for every id is better than a half-branded client.
* `["number","string"]` with a pattern → `number`; that pattern is ASP.NET's number format, so it is not a `Pattern` rule.
* Rules from JSON Schema keywords until BC-4: required members → `Required`; `minLength: 1` without a maximum → `NotEmpty`
  (code `Required`, as `[NotEmpty]` emits it); `minimum`/`maximum` (strings in Tarol's emitter) → `Range`;
  `minItems`/`maxItems` → `Count`; `format: email` → `Email`; a `pattern` only when it compiles as an ECMAScript `u` pattern
  (a .NET-only one, e.g. an atomic group, is left to the server).
* `offset` is not generated (philosophy P1, keyset only); webhooks are skipped (server to server).
* Path parameters must be identifiers and must not collide with body members (else `GenerateError`).
* An object schema without members becomes `object` (any JSON object; the backend ignores unknown members).
  `Record<string, never>` (the first version) made `{ auction } & SettleAuction` unsatisfiable, so
  `settleAuction({ auction })` did not compile: the type-check of the contract test found it, and the strict usage test
  now calls a change with an empty body schema. `Record<never, never>` compiles but is `{}`, which the lint of the generated
  file rejects (`no-generated-empty-object-type`).
* The generated file is linted with the repository's strict ESLint config: two findings fixed in the generator
  (`String()` around string path members; default type arguments).

**Verification**

* Tests: **12** unit (snapshot of the sample; strict type-check of the generated module together with a usage file that
  calls the runes and has three `@ts-expect-error` lines for a missing member, an unknown sort and `offset`; every schema
  construct; ids; nested rules; `x-tarol-rules`; 7 error cases with their JSON pointers; CLI write/`--check`/usage) and
  **2** contract tests against the running sample: the live `/openapi/v1.json` generates exactly the committed snapshot,
  and the generated calls create, bid (version 2), are refused (403 settle by the bidder), settle, read the view and page
  the list [verified].
* Generated runtime for the sample's 6 entries: **489 B gzip / 426 B brotli** (1,410 B minified; `requests` alone 281 B)
  [verified, `eng/bundle-svelte.mjs` + zlib].
* ESLint (generator and generated file), tsc, publint, attw clean; API report with 0 undocumented members.

## 7. Skill evaluation checklist

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "Call the new backend change" | regenerate, then `changes.<name>(input)` | hand-writing `fetch('/…')` |
| "The backend added a field" | rerun the generator | editing the generated file |

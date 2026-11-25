# Design note: downloads and decimals (Tatalu round 2)

Status: **proposal, not built** (TS-28, TS-29); both wait for a backend contract. Labels as in the
[philosophy](philosophy.md).

## `client.download(request)` (FB-F17.5-3)

**Tatalu's need.** The data export of a person (GDPR art. 15/20) is a file. The backend has no file endpoint, so Tatalu
puts the export as a string into a view and builds a `Blob` in the browser (`Account.svelte`, `DataExportView.Content`).
The admin export (`GET {admin}/subjects/{id}/export`) is JSON without a schema (BC-20).

**Options.** (a) `client.download(request): Promise<Result<{ blob: Blob; name: string | null; type: string }>>`, reading
`Content-Disposition` and `Content-Type`, with the client's auth, problem mapping and request id; the app saves it with an
`<a download>` (a helper `saveFile(result)` in tarol-components). (b) A URL with a short-lived signed token for a plain
`<a href>` (needs a backend design, and leaks the token into history). (c) Keep views with a string member.

**Recommendation: (a)** once Tarol-Net round 2 defines file endpoints (`IFile`/a stream view with `Content-Disposition`,
`x-tarol-kind: file` in the document): `tarol-codegen` then generates `requests.<op>()` as a `FileRequest` that only
`download` accepts. Not built now: without the backend's kind the generator cannot tell a file from a view, and a client
method without a backend counterpart would invite apps to download views.

**Not included:** uploads, streaming progress, resumable downloads.

## Decimals (FB-F04.5-1)

**Tatalu's need.** Hours accounts are exact sums of minutes × rates; TypeScript has no decimal, so Tatalu computes in
integer fractions (minutes × 700) and rounds only for display (`account.ts`).

**Options.** (a) The backend sends `decimal` as a JSON string (`"12.50"`) and the generator types it as a branded
`Decimal` string with a few helpers (`add`, `sub`, `compare`, `format` via `Intl.NumberFormat` with the string, which
formats exactly); no arithmetic library. (b) Numbers, as today (exact only up to 2⁵³ and only for binary fractions).
(c) An arbitrary-precision dependency (`big.js`, ≈ 3 KB) — against the dependency rule without a measured need.

**Recommendation: (a)**, but it is a contract decision of Tarol-Net (how `decimal` is written and described:
`type: string, format: decimal`), so it stays open here; the client side is a few lines once the format exists. Until then
the advice stays Tatalu's: integers of the smallest unit, computed on the backend where it must be exact.

**Not included:** money types with currency, rounding modes beyond `Intl`'s display rounding.

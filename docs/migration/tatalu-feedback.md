# Feedback from Tatalu: implementation notes

The items of [docs/feedback/tatalu.md](../feedback/tatalu.md) (TS-1 … TS-8), one PR each. Every public API or behaviour change
of those PRs is listed here. Labels as in the [philosophy](../architecture/philosophy.md).

## TS-1: AppShell on phones

**Finding checked.** "With `nav` the shell is a two-column grid at every width; at 360 px the page keeps about 200 px" does
**not** hold for `0.1.0-preview.5`: `AppShell.svelte` has had `@media (max-width: 40rem)` (one column, the nav stacked
above the page) since the design step (`83f3988`). **[verified]** `test/shell.test.ts`, first case: at 360 × 740 in Chromium
the main landmark is 360 px wide, the nav ends above it, the page does not scroll horizontally, axe finds nothing. What
does hold: below 40rem the nav is a block above the page, not a bar in thumb reach, so Tatalu wrote its own bottom nav.

**Change.** `navPosition?: 'side' | 'bottom'` (default `side`, unchanged). With `bottom`, below 40rem the nav moves after
the page in the grid and sticks to the viewport's bottom edge (`env(safe-area-inset-bottom)` padding); a `<ul>` in it is
one row of equal items and every link at least 2.75rem (44 px) high. Above 40rem it is the side nav.

| Check | Result **[verified]** (`pnpm vitest run --project tarol-components test/shell.test.ts`) |
|---|---|
| red first | before the change the bottom case failed: the nav's bottom was at 234 px, not at the viewport's 740 |
| 360 px, `bottom` | nav bottom = viewport bottom, height ≤ 64 px, the five links in one row, each ≥ 44 px, no horizontal scroll, the last line of a long page ends above the bar, axe 0 violations |
| 1024 px, `bottom` | the side nav (left of the main landmark) |

Public API: the `navPosition` prop, in `dist/AppShell.svelte.d.ts`; the API Extractor report shows `AppShell` as `Component<Props>` (the props type is not an export), so `pnpm api:update` leaves it unchanged. P1: no script, a few CSS rules (size in the PR). P6: axe in
every case; the targets meet WCAG 2.5.8 (24 px) and the 44 px of Tatalu's NFR-UX-01.

## TS-2: message fallback for `<Aggregate>.NotFound`

**Change.** `translator` tries, in order: the code with its bound suffix (`.min`/`.max`/`.any`), the code, **the part after its
last dot** (`ChildDayCare.NotFound` → `NotFound`), `error.generic`, the code itself. Tarol-Net answers `<Aggregate>.NotFound`
and `<Aggregate>.AlreadyExists` (`ChangeEndpoints`, the generated `x-tarol-errors`); `NotFound` was in both catalogues,
`AlreadyExists` is new in `en` and `de`. A code whose generic part has no text (`Bid.TooLow`) still reads `error.generic`;
an app's own `X.Y` text still wins.

Behaviour change: a code `X.Y` that is not in any catalogue but whose `Y` is (for example an app code `Order.Required`) now
shows `Y`'s text instead of `error.generic`. **[verified]** `test/messages.test.ts` (red before: `ChildDayCare.NotFound` read
"Etwas ist schiefgelaufen."). Public API: no new export (the catalogue objects gain a key; the API report lists them).

## TS-3: tarol-codegen and plain operations

**Change.** An operation without `x-tarol-kind` is not a Tarol entry (Tatalu's anonymous sign-up `POST /konto/registrierung`
calls the identity provider and has no tenant). It is skipped before any other check (a plain ASP.NET endpoint often has no
`operationId` either), reported through `GenerateOptions.onWarning` (the CLI writes `tarol-codegen: warning: #/paths/…:
skipped, no x-tarol-kind (not a Tarol entry)` to stderr) and named in the header comment of the generated module, so a
reviewer sees it. `strict: true` / `--strict` keeps the old error. The rest of the output is byte-identical (the test
compares it with the document without the operation).

Not done: `--plain` (a typed request builder from `requestBody`). A plain endpoint has no Tarol contract (no problem codes,
no idempotency, no ETag), so a typed builder would promise more than the backend states; the app keeps its few lines.

Public API: `GenerateOptions.strict`, `GenerateOptions.onWarning` (API report regenerated); CLI flag `--strict`. Behaviour
change: a document with such an operation now generates (it failed before). **[verified]** `test/generate.test.ts`.

## TS-5: the space before „(Pflichtfeld)“

**Finding confirmed.** `Field.svelte:41` had `<span class="t-required"> (…)</span>`: Svelte drops whitespace at the start of
an element's content, so the label read "Title(Pflichtfeld)" in the DOM **[verified]** (the new assertion in
`primitives.test.ts` failed with exactly that text). The finding says the accessible name was fine; the test does not
depend on it (`getByLabelText(/Title/)` matches either way).

**Change.** The space is an expression before the span (`{' '}`), which Svelte keeps; the span's text is `(Pflichtfeld)`.
Behaviour: the visible label gains the space. No API change.

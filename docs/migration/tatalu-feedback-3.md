# Feedback from Tatalu, round 3: implementation notes

The tarol-svelte items of Tatalu's wave 3 ([docs/feedback/tatalu.md](../feedback/tatalu.md#round-3), TS-34 … TS-38) and
the owner decisions of 2026-11-25 on round-2 items (SV-34 … SV-36: TS-26, TS-27, TS-29, TS-33). Every public API or
behaviour change is listed here. Labels as in the [philosophy](../architecture/philosophy.md). Each item was reproduced by
a test that failed before the change (named per item), or closed with *Checked* and the reason.

## TS-34: `Calendar`

**Finding confirmed** (FB-F06.1-2). Tatalu builds the month grid, the week and day lists and the "name contains the
visible text" rule itself (`frontend/apps/web/src/screens/planung/Calendar.svelte`, `calendar.ts`); its day buttons have
no arrow-key navigation, and an `aria-label` "01.12.2026" on a button showing "1" is axe's `label-content-name-mismatch`.

**Change.** `@clorat/tarol-components` `Calendar` (generic over the entry type `T`), with `days.ts` for ISO day arithmetic
on UTC dates (no time zone or DST moves a day):

* `view` (bindable) `month` | `week` | `day`, `views` (which to offer; one view shows no switch), `date` (bindable, the
  focused day `YYYY-MM-DD`, default today), `today` (marked `aria-current="date"`), `locale` (Intl texts), `firstDay`
  (default Monday), `entries(day) => T[]`, an `entry` snippet (the text), `tone(entry)` (`accent`, `danger`, `warning`,
  `success`, `muted`: the dot's token colour; the text says what it is), a `day` snippet (extra content in the week and day
  views), `dots` (default 3, then "+n"), `onselect(day)`.
* Month: a `<table role="grid">` of always six weeks (the height never changes between months, no layout shift), weekday
  headers with `abbr` (the long name), one tab stop (roving `tabindex`), `aria-selected` on the focused day. Week: a
  one-column grid of seven rows with the day and its entries (dot and text). Day: the entries, or "No entries.".
* Keyboard (WAI-ARIA grid / date-picker pattern): Arrow Left/Right a day, Up/Down a week (in the week view a day),
  Home/End first/last day of the week, Ctrl+Home/End first/last day of the month, Page Up/Down a month (Shift: a year; in
  the week view a week), the focus follows across months; Enter/Space activates: `onselect(day)`, else the day view.
* A day button is named by `aria-labelledby` a visually hidden text with the full date and the entry count ("Tuesday,
  December 1, 2026, entries: 2"); the visible number is `aria-hidden` and contained in that name, so
  `label-content-name-mismatch` holds. The "+n" of more entries is drawn by CSS (`content: '+' attr(data-more)`), so it is
  no visible text outside the name. First tried: visible and hidden **parts** of `Intl.formatToParts` inside the button;
  Chromium puts spaces around an absolutely positioned span ("December 1 , 2026"), so the name was wrong **[verified]**.
* Texts (`ui.previous`, `ui.next`, `ui.today`, `ui.month`, `ui.week`, `ui.day`, `ui.calendarView`, `ui.weekOf`,
  `ui.entries`, `ui.noEntries`) are in `en` and `de`, not in `uiEn`: every primitive that calls `getMessages()` bundles
  `uiEn`, and with them there Dialog went 4 B and DateField 27 B over their budgets **[verified]** `pnpm size`. So the
  Calendar needs a `ThemeRoot` (or an app catalogue) for its texts.
* `eng/doc-svelte-dts.mjs` copied the component doc with `String.replace` on the first `type Calendar…` of the file, which
  is `type CalendarView`; API Extractor then reported `ae-undocumented` for `Calendar`. It now inserts at the match
  (`03da383`).

**[verified]** `tarol-components/test/calendar.test.ts` (9 tests; red before: no component): six rows, one tab stop,
`aria-current`, `aria-selected`; the name with the count and only "1" visible; the axe rule proven by a deliberate
`aria-label="01.12.2026"` on a "1" button; the key table above across months (Home into November moves the grid); month
steps clamp (31 January + 1 = 28/29 February); Enter opens the day view, `onselect` replaces it; the week view; German
texts and dates; axe with `label-content-name-mismatch` enabled (it is experimental in axe 4.14 and off by default) in
every view. The catalogue page `#/components/Calendar` passes `apps/docs` e2e (`catalogue` project: renders, axe 0, CLS
≤ 0.01 in both themes) **[verified]** `npx playwright test --project catalogue -g Calendar`.

Public API: `Calendar`, `CalendarProps<T>`, `CalendarView`, `CalendarTone`; test helper `violations(root, enable)` in
`tarol-components/test/axe.ts` (not shipped). Size: **[verified]** `pnpm size` 4.03 kB gzip / 3.51 kB brotli (compiled,
incl. CSS, without svelte and @clorat); new budget 4.5 kB for both.

## TS-35: colour transition and axe

**Finding confirmed** (FB-F06.1-3). **[verified]** A temporary test (two `Button`s whose `variant` follows a state, click,
axe at once) failed 5 of 5 runs with `color-contrast` on both buttons: the background is in its 120 ms transition while the
text colour switches at once. Under `prefers-reduced-motion: reduce` the duration tokens were already 0 (`tokens.css`).

**Change.** `ThemeRoot motion` (`auto` default | `reduce`): `reduce` sets `data-motion="reduce"`, and `tokens.css` sets
`--t-duration-fast` and `--t-duration-normal` to `0ms` under it: an in-app "reduce motion" setting and the test recipe.
`Button` has `transition: none` under `prefers-reduced-motion: reduce`, also where an app sets its own durations. The
tarol-design skill names the recipe ("render the test inside `<ThemeRoot motion="reduce">` or emulate `reducedMotion`;
never wait a fixed time").

**[verified]** `tarol-design/test/motion.test.ts`: by default the transition is 0.12 s; with Playwright's
`emulateMedia({ reducedMotion: 'reduce' })` (a vitest browser command `reducedMotion` in `vitest.config.ts`) it is 0 s and
axe right after the switch passes; with `motion="reduce"` the tokens are `0ms` and axe passes (red before: the tokens were
`120ms`/`200ms`).

Public API: `ThemeRoot`'s prop `motion`. The API report does not show component props (their `Props` interfaces are not
exported), so the report is unchanged; `apps/docs/src/catalogue/props.json` lists it.

## TS-36: typed lint of components

**Finding reproduced, cause outside the packages** (FB-F05.1-4, FB-INT3-6). **[verified]**
`eng/tests/typed-lint.test.mjs` lints fixtures (`eng/tests/fixtures/typed-lint`, its own `tsconfig.json`) with the
repository's ESLint config (`strictTypeChecked`): a type exported from an app component's `<script module>` is unresolved
(`no-unsafe-member-access` "a type that cannot be resolved", also from a `.ts` file), and the parameter of an app
component's callback (`onSent={(c) => c.id}`) is `any`. typescript-eslint's project service reads no `.svelte` file, so
it sees svelte's ambient `*.svelte` module. The packages' components are not affected: their generated `.svelte.d.ts` make
`onselect={(id) => id.toUpperCase()}` on `MenuButton` and `onselect={(hit) => hit.title}` on `SearchBox` lint clean.
*Checked: no package change can fix an app's own components.*

**Change.** What the packages lacked were the item and snippet parameter types an app needs to annotate its own helpers:
`@clorat/tarol-design` exports `MenuItem`, `TabItem`, `ComboboxOption`, `FieldControl`; `@clorat/tarol-components` exports
`QueryStateSource` (moved to `<script module>`, as `SelectProps` already was; members documented). The tarol-components
skill has a section "Typed lint in an app" (types in a `.ts` module, annotate callback parameters of app components,
`ComponentProps<typeof X>`, never switch the rules off), and the tarol-design skill names the exported types.

**[verified]** the eng test's recipe fixture (`Good.svelte`) uses `MenuItem` and `TabItem`; with the imports renamed to
names that do not exist it reports `no-unsafe-return`, `no-unsafe-member-access` and `no-redundant-type-constituents`
(red before the exports). The catalogue e2e expected the old local name in the Combobox props table
(`(option: Option, …)`) and was updated to `ComboboxOption` (`e5710cd`).

Public API: the five type exports (API reports regenerated). Behaviour: none.

## TS-37: `tarol-codegen` fails loudly

**Finding partly confirmed** (FB-F06.6-1). **[verified]** by running `dist/cli.js`: a `GenerateError` (Tatalu's
"a schema without a type") already exited 1 with `tarol-codegen: <pointer>: <message>` on stderr, so
`pnpm generate >/dev/null` showed it and failed; the error vanished in Tatalu's script only if the script ignored the exit
code. But a missing file, a body that is not JSON (an HTML error page) and an HTTP error status ended in an uncaught
exception with a stack trace, and an HTTP error with a JSON body was parsed as the document (then refused as
"OpenAPI undefined is not supported").

**Change.** `cli.ts` reads the document in one place: every failure is one line `tarol-codegen: …` on stderr, exit code 1,
nothing on stdout: `cannot read <file>: ENOENT`, `<file> is not JSON: …`, `<url> answered 503 …`, `cannot fetch <url>: …`;
an unexpected error is `internal error: …`, also exit 1. Only `wrote <file>` goes to stdout. README and skill state the exit
codes (0, 1, 2) and that a script must check them (`set -e`, `&&`).

**[verified]** `tarol-codegen/test/cli.test.ts` "fails loudly: exit code 1, one tarol-codegen line on stderr, nothing on
stdout (TS-37)" spawns the built CLI on a bad document, a non-JSON file, a missing file and a local HTTP server answering
503 (red before: the non-JSON case printed a stack trace).

Public API: none (the CLI's messages). Behaviour: the three read failures exit 1 with one line instead of a stack.

## TS-38: nullable objects (wave-3 confirmations)

*Checked: covered by TS-9 (round 2, `5612651`, `cb2bcb9`), which is not in preview.5.* `tarol-codegen/test/generate.test.ts`
"nullable objects in inputs, views, rows and Option<T> (TS-38 = TS-9; …)" generates Tatalu's shapes as Tarol-Net writes
them: `AppointmentRow.details` (`AppointmentDetails?`, a list row, FB-F06.6-1), `CreateMedicationOrder.authorization`
(`AuthorizationInput?`, an input) and `MedicationOrderView.authorization`/`details` (a view, FB-F05.8-2; `details` in the
older component shape `["null", "object"]`), `AssignSubstitute.external` (`Option<ExternalSubstituteInput>` as
`oneOf [null, $ref]` in place, TN-31, FB-F06.5-1). All are `T | null`, the nullable member has no `Required` rule, its
members keep theirs, and a usage that sends and reads `null` type-checks. It passed before any change **[verified]**.

## TS-26, TS-27: outbox and offline reads (SV-34)

Owner decision 2026-11-25: option A of [offline.md](../architecture/offline.md). Built from Tatalu's
`frontend/apps/web/src/lib/offline/queue.svelte.ts`, `idb.ts` and `reads.svelte.ts`, framework-free (no runes: a
`subscribe(listener)` for a UI).

**`@clorat/tarol-client/outbox`**:

* `createOutbox({ client, store, scope, device?, captureHeaders?, delays?, online?, now?, flushOnOnline? })` → `Outbox`
  with `entries`, `pending`, `failed`, `syncing`, `needsSignIn`, `lastSync`, `ready()`, `load()`, `submit(request, {
  label })`, `flush()`, `retry(key)`, `discard(key)`, `clear()`, `subscribe(listener)`, `dispose()`.
* `submit` writes the entry to the store **before** sending, then flushes: `{ state: 'sent', result }` (the `Ok`, e.g. a
  creation's id), `{ state: 'queued', result }` (offline, 5xx, 429, or an older entry still waiting; `result` is the
  transient failure or `undefined` when not attempted) or `{ state: 'failed', result }` (a refusal). It throws without a
  scope (nothing is stored for nobody).
* Every attempt sends the entry's `key` as `Idempotency-Key`; entries keep a `sequence` and are sent in capture order, also
  after a restart (a new outbox over the same store). A transient failure counts the attempt and retries after the delays
  (5, 15, 30, 60 s; the last repeats) and on the window's `online` event; a 401 sets `needsSignIn` and stops the timer
  until a `flush()` (the signal that the person signed in again); a refusal keeps the entry as `failed` with the whole
  `violation` (code, `detail`, `reasons`, other members), `status` and `requestId` (FB-F05.1-3) until `retry` (same key) or
  `discard`.
* `Tarol-Device` and `Tarol-Captured-At` only with `captureHeaders: true` (and `device` from the app): off by default
  until Tarol-Net TN-60 accepts them (a cross-origin preflight would refuse them).
* No client retry of `Stream.VersionConflict` (TS-32: the backend retries a change without `If-Match`); Tatalu's three
  immediate retries are not carried over.
* `offlineReads({ store, scope, keep, fetch?, now? })` → `{ fetch, savedAt(path), saved(), clear(), subscribe }`: a `fetch`
  for `createClient({ fetch })`; a 200 of a kept path is stored (body and ETag); when the network fails, the stored answer
  is returned as a 200 with its ETag, so `read` gives an `Ok` with the stored value and `version`; `savedAt(path)` is the
  time of the stored state until a fresh answer arrives. This replaces the sketched `ClientOptions.cache`/`Ok.fromCache`:
  the core client stays unchanged, as in Tatalu's template.
* `memoryStore()`: an `OfflineStore` in memory (tests; a browser without IndexedDB).

**`@clorat/tarol-client/idb`**: `idbStore(name = 'tarol-offline')`, the only code that touches `indexedDB` (opened on first
use; tables `outbox` and `reads` keyed by `key`, indexed by `scope`).

**Core client:** `ChangeOptions.headers` adds request headers to a change; the client's own (`idempotency-key`,
`if-match`, `content-type`, `accept`, `authorization`, `traceparent`, `tarol-read-after`) are dropped from it (`8833d7f`).

Personal data at rest (SV-34): the store is the app's choice, scoped per `<tenant>/<person>`, records are stored
unencrypted; the app calls `outbox.clear()` and `reads.clear()` at `logout()`/`revoke()` (not automatic: tarol-client does
not know tarol-oidc).

**[verified]** `tarol-client/test/outbox.test.ts` (8 tests, Node, a fake backend behind the real `createClient`): sent at
once with the creation's value; stored before sending, one key across a failed attempt and a restart, capture order; a 409
with `detail` and `reasons` kept as `failed`, retried with the same key; 401 pause and back-off with fake timers; the
capture headers only when asked; scopes and `clear`; extra headers never replace the idempotency key; offline reads
(kept path answered offline with `savedAt`, an unkept path is `Network`, a fresh answer clears `savedAt`, `clear`).
`tarol-svelte/test/idb.test.ts` (Chromium): `idbStore` per scope across a second store on the same database, `clear` of one
scope, and an outbox entry with its request in IndexedDB. Red before: the modules did not exist.

Size **[verified]** `pnpm size` (`import { createOutbox }` etc., after TS-33's `reasons`): outbox 1.35 kB gzip / 1.24 kB
brotli (budget 1.5 kB), offline reads 642 B / 577 B (1 kB), idb 385 B / 345 B (0.5 kB). Core `createClient`: 2.24 kB gzip
on `main`, 2.34 kB gzip / 2.13 kB brotli now (`ChangeOptions.headers`, `Problem.reasons`), within its 3 kB budget.

Not built: `changeForm(…, { queue })` and a Svelte state around the outbox (`subscribe` covers a screen today);
`client.prefetch` (read ahead with `client.read` through the offline `fetch`); clearing at sign-out inside tarol-oidc.

## TS-29: `multipleOf` (SV-35)

Owner decision: `decimal` stays a JSON number; Tarol-Net TN-53 writes `[Scale(n)]` as `multipleOf: 10^-n`. **Finding:**
the generator ignored `multipleOf` (**[verified]** by reading `generate.ts` `fieldRules`; no occurrence in any package).

**Change.** `tarol-codegen`: a number or integer schema with `multipleOf > 0` gets the rule `{ rule: 'Scale', code:
'Scale', step }` after `Range` (`Schema.multipleOf`, `GeneratedRule.step`; `Scale` is accepted in `x-tarol-rules`).
`@clorat/tarol-svelte` `Rule`: kind `Scale`, member `step`; `check` counts the decimal places of the number **as JSON writes
it** for a power-of-ten step (what the backend's `decimal` reads: `0.1 + 0.2` is sent as `0.30000000000000004` and is
refused on both sides; `1e-7` has 7 places) and divides with a tolerance for any other step. `en`/`de` gain `Scale` ("The
value has too many decimal places." / "Der Wert hat zu viele Nachkommastellen.").

The backend's code is `Scale` **[verified by reading]** Tarol-Net `e147531` (branch `ccr-8972722e-gwv2vp`, not yet on
`main`): `Tarol.Validations.Generators/Emitter.cs` emits code `Scale` with the digits as detail, and the OpenAPI emitter
writes `multipleOf` and an `x-tarol-rules` item `{ rule: 'Scale', code: 'Scale', step: 0.01 }` (a JSON number). "Trailing
zeros do not count" there, and a JSON number has none. The test "takes Scale from x-tarol-rules as Tarol-Net e147531 writes
it" pins that shape.

**[verified]** `tarol-codegen/test/generate.test.ts` "multipleOf as the client rule Scale (TS-29 …)" (red before: no
`Scale` in the rules), `tarol-svelte/test/rules.test.ts` "checks Scale: a multiple of the step, without float noise".

Public API: `Rule['rule']` gains `'Scale'`, `Rule.step`, `Schema.multipleOf`, `GeneratedRule.step`. Generated output: new
rules where the document has `multipleOf`; the sample's snapshot is unchanged.

## TS-33, part 1: `reasons` (SV-36)

Tarol-Net round 2 TN-36 writes `reasons` (`IReadOnlyList<string>`, `Tarol.Results/Violation.cs:202-255`) into a problem
**[verified by reading]**. The client passed it through as `extensions.reasons`; no component showed it.

**Change.** `Problem.reasons?: readonly string[]` when the member is a list of strings (else it stays in `extensions`);
`ChangeForm` lists each translated reason under the refusal's message inside the alert; the outbox keeps them with the
violation. The confirmation step is part 2 below.

**[verified]** `tarol-client/test/client.test.ts` "reads the reasons of a refusal (Tarol-Net TN-36) as codes, not as an
extension (TS-33)", `tarol-components/test/components.test.ts` "lists the reasons of a refusal under its message, each
translated" (red before: `reasons` was an extension, no list).

Behaviour change: a problem's `reasons` list moves from `extensions.reasons` to `reasons` (code that read
`extensions.reasons` reads `reasons`). `ChangeForm`'s alert is a `<div role="alert">` with a `<p>` (was a `<p>`).

## TS-33, part 2: the confirmation step (SV-36, Tarol-Net TN-37)

**Contract** **[verified by reading]** Tarol-Net `61dfc8b` (branch `ccr-8972722e-gwv2vp`, not yet on `main`),
`src/Changes/Tarol.Changes.AspNetCore/ChangeEndpoints.cs`: a confirmable warning is 409 with the problem members `code` and
`confirm: { code, args }` (`args` always present, string values, may be empty); the request is sent again with
`Tarol-Confirm: <code>` (several comma-separated, at most 16 codes and 1,024 characters, CORS-allowed). Only a successful
append stores the idempotency key (`Tarol.Changes/ChangePipeline.cs`), so the confirmed request may keep the key.

**Change.**

* `@clorat/tarol-client`: `Problem.confirm?: Confirmation` (`{ code, args }`), the new type `Confirmation`; a `confirm`
  member of another shape stays in `extensions`.
* `@clorat/tarol-svelte` `changeForm`: `form.confirmation` is the last submit's warning; `form.confirm()` adds its code to
  the codes confirmed for the input as sent and submits again with `headers: { 'tarol-confirm': codes.join(', ') }` and the
  same key, so a second warning of the same input (`A`, then `B`) is confirmed as `A, B`. An input edited since the warning
  is a new intent: a new key and no confirmed codes (the person sees the warnings of the new input). `undefined` without a
  warning. `reset()` clears it with the violation.
* `@clorat/tarol-components` `ChangeForm`: the warning's message is `t(code, args)`; inside the alert a secondary Confirm
  button (`ui.confirm`, en "Confirm", de "Bestätigen") calls `form.confirm()`.
* `@clorat/tarol-client/outbox`: a warning is kept as `failed` with its violation (incl. `confirm`); `outbox.confirm(key)`
  records the code on the entry (`OutboxEntry.confirmed`) and sends it again with `Tarol-Confirm` and the same key;
  `retry(key)` keeps the confirmed codes.
* Not built: a confirmation step in `action()` (TS-15) — the same two members can be added there when a screen needs it.

**[verified]** red first, then green: `tarol-client/test/client.test.ts` "reads a warning to confirm (Tarol-Net TN-37) as
confirm, with its arguments (TS-33)"; `tarol-client/test/outbox.test.ts` "keeps a warning to confirm as failed;
confirm(key) resends it with Tarol-Confirm and the same key"; `tarol-svelte/test/form.svelte.test.ts` "offers the warning,
resends with Tarol-Confirm and the same key, and collects codes of the same input" and "a changed input is a new intent";
`tarol-components/test/components.test.ts` "shows a warning to confirm with its arguments and resends with Tarol-Confirm on
Confirm" (with axe).

Public API: `Confirmation`, `Problem.confirm`, `Form.confirmation`, `Form.confirm()`, `Outbox.confirm(key)`,
`OutboxEntry.confirmed` (API reports regenerated). Size **[verified]** `pnpm size`: core client 2.42 kB gzip (3 kB),
outbox 1.46 kB (1.5 kB), svelte bindings 4.3 kB / 3.83 kB brotli (5.25 kB, the round-2 proposal), ChangeForm + FormField
2.55 kB (3 kB), ThemeRoot 3.03 kB (3.25 kB, proposed SV-37).

## TS-40: a change that may start its aggregate (Tarol-Net TN-42)

Tarol-Net round 3c answers 201 `{id, version}` for every change whose commit started its stream (`IOrStart<T>`, an `ILoads`
load-or-create) and documents the 201 next to the 204. tarol-codegen typed such a change's result as `undefined`, so the new id
was out of reach. Now a `change` operation with a 201 response returns `Created<Id> | undefined` (`undefined` for the 204).

* **API change:** the generated result type of such changes; no new exports.
* **Test [verified]:** `generate.test.ts` "a change that may start its aggregate (TS-40, Tarol-Net TN-42)" (red before: `undefined`).
* **Tatalu:** the parents' `GET /ich/vorschlaege` round trip after a first proposal (FB-F15.5-2) can read the id from the answer.

## TS-39: one projection row (Tarol-Net TN-54)

Tarol-Net round 3b adds `IRowQuery<TRow>`: a GET answering one projection row, `x-tarol-kind: row`. tarol-codegen refused the
document ("unknown kind row"). Now a `row` operation is a read like a view: `requests.<op>()` / `api.<op>()` returning the row type.

* **API change:** the kind union accepts `row`; no new exports.
* **Test [verified]:** `generate.test.ts` "one projection row (TS-39, Tarol-Net TN-54)" (red before: `GenerateError`).
* **Tatalu:** `GET /tpp/aenderungen` as a list of one row and `items[0]` in the frontend become a row query and a plain read.

## Open items

* **TS-28 (`client.download`)**: waits for Tarol-Net file endpoints (TN-65); [files-and-decimals.md](../architecture/files-and-decimals.md).
* **TS-30 (`ConflictCard`)**: waits for Tarol-Net's `FieldConflict<T>` shape; proposal unchanged (round-2 note).
* **TS-31 (`idleLock`, `LockScreen`)**: not built this round (time went to the owner's offline decision); proposal unchanged
  (round-2 note): the timer and the screen in the packages, the unlock factor the app's.
* **TS-33**: a confirmation step in `action()`, when a screen needs it.
* **TS-26 follow-ups**: `changeForm(…, { queue })`, a rune over `Outbox`, `client.prefetch`.
* **Calendar visual baselines**: `apps/docs/e2e/__screenshots__/Calendar-*.png` do not exist; they are made in the CI
  container (`TAROL_VISUAL=1`, `pnpm visual --update-snapshots`), as SV-12 says, not here.

## Size

* `@clorat/tarol-design` "ThemeRoot (with Toaster, messages de+en)": **[verified]** `pnpm size` 2.88 kB gzip on `main`,
  2,998 B with the calendar texts, 3,017 B gzip / 2,550 B brotli with `Scale` (17 B over 3 kB). Raising a budget is the
  owner's decision; the commit "design: raise the ThemeRoot budget to 3.25 kB (proposed)" (`c2f323d`) is separate so it
  can be dropped or changed. Proposed as SV-37, not recorded in [decisions.md](decisions.md) until the owner answers.
  Alternative: move the calendar texts into a catalogue part that only apps with a calendar pass (`messages={[calendarEn,
  en]}`), which breaks "the components work with the default catalogue".
* New budgets (measured above): `Calendar` 4.5 kB; `outbox` 1.5 kB, `offline reads` 1 kB, `idb` 0.5 kB (gzip and
  brotli each).

## Release notes 0.1.0-preview.6 (round 3)

What Tatalu can change or remove when it moves to `0.1.0-preview.6`, in addition to the round-2 table in
[tatalu-feedback-2.md](tatalu-feedback-2.md#release-notes-010-preview6-tatalu):

| Item | Tatalu file | What to do |
|---|---|---|
| TS-34 | `frontend/apps/web/src/screens/planung/Calendar.svelte` (the `<table class="month">`, the week/day `<ul class="days">`, `move`, `monthName`, the `aria-label` per cell), `screens/planung/calendar.ts` (`weekOf`, `monthGrid`) | `<Calendar label bind:date bind:view today={today()} locale="de" entries={shown} tone={toneOf}>` with `{#snippet entry(e: CalendarEntry)}{label(e)}{/snippet}` and the expected-count line in the `day` snippet; keep `entriesOn`, `closedDay`, `expectedOn` and the filter (app logic). `calendar.node.test.ts` cases for `weekOf`/`monthGrid` can go |
| TS-35 | `frontend/apps/web/src/screens/planung/Calendar.test.ts:132` (`setTimeout(r, 400)` before axe) | render the test harness inside `<ThemeRoot motion="reduce">` (or emulate `reducedMotion`) and drop the wait |
| TS-36 | `screens/dokumentation/entry.ts` (types out of `<script module>`), `screens/nachrichten/QuickMessage.svelte` (`onSent={(c: string) => …}`) | nothing to remove: both are the recipe now (tarol-components skill "Typed lint in an app"); use `MenuItem`/`TabItem`/`ComboboxOption` where helpers built these by shape |
| TS-37 | scripts that run `pnpm generate >/dev/null` | nothing; check the exit code (`set -e` or `&&`): every failure is exit 1 with one stderr line |
| TS-38 / TS-9 | `backend/src/Tatalu.Planung/Appointment.cs` (`AppointmentDetails.Hidden` placeholder), `backend/src/Tatalu.Dokumentation/MedicationChanges.cs` and `MedicationViews.cs` (flat `authorizedFrom` … `doctorOrder`), `backend/src/Tatalu.Planung/Substitutes.cs` and `Views.cs` (`ExternalName`, `ExternalContact`) | use `AppointmentDetails?`, `AuthorizationInput?`, `MedicationAuthorization?`, `Option<ExternalSubstituteInput>` again and regenerate (`null` = not shared / none) |
| TS-26 | `frontend/apps/web/src/lib/offline/queue.svelte.ts`, `idb.ts`, the `QueuedChange.detail` workaround (FB-F05.1-3) | `createOutbox({ client, store: idbStore('tatalu-offline-2'), scope, device: device.id })` from `@clorat/tarol-client/outbox`/`idb`; `outbox.failed[i].violation.detail` and `.reasons`; wrap `subscribe` in the app's `$state` for `SyncStatus.svelte`; put the `Capture` record into inputs as today until Tarol-Net TN-60, then `captureHeaders: true`. Entries in Tatalu's old database are not read: flush them before switching |
| TS-27 | `frontend/apps/web/src/lib/offline/reads.svelte.ts` | `offlineReads({ store, scope, keep: offline })` and `createClient({ fetch: reads.fetch })`; `reads.savedAt(path)` |
| TS-26/27 | `lib/offline/session.ts` (clearing at sign-out) | call `outbox.clear()` and `reads.clear()` next to `oidc.logout()`/`revoke()` |
| TS-29 | `frontend/apps/web/src/screens/anwesenheit/account.ts` (integer fractions) | stays (it is arithmetic, not validation); amount inputs get the `Scale` rule once the backend writes `multipleOf` (Tarol-Net TN-53) |
| TS-33 | screens that read `violation.extensions.reasons` (none found on `main`) | read `violation.reasons`; `ChangeForm` lists them |
| TS-33 | `frontend/apps/web/src/screens/anwesenheit/actions.ts`, `ChildAttendance.svelte`, `SubstituteReview.svelte` (a second submit with `warningConfirmed`), `screens/planung/quota.ts` (`overflow()` parsing `detail` "Jugendamt\|Tage"), `Absences.svelte`, `YearPlan.svelte` (`confirmQuota`); backend `Tatalu.Anwesenheit/AttendanceMonth.cs`, `Handover.cs`, `Changes.cs`, `Tatalu.Planung/Absences.cs`, `AnnualPlan.cs`, `Changes.cs` (`warningConfirmed`, `ConfirmQuota` inputs) | with Tarol-Net TN-37: raise the confirmable warning with its args in the backend and drop the input flags; in the UI `form.confirmation` / `form.confirm()` (or ChangeForm's Confirm button), `outbox.confirm(key)` for queued changes; messages take the args (`{allowance}`, `{days}`) instead of parsing `detail` |

Breaking for Tatalu: `Problem.reasons` instead of `extensions.reasons`; `ChangeForm`'s alert is a `div` (tests that select
`p[role=alert]` change); the Combobox option type is named `ComboboxOption` in generated props docs.

## Skill evaluation checklist

| Skill | Task | Expected API | Mistake to avoid |
|---|---|---|---|
| tarol-components | "A month calendar of closing days and appointments, week and day on demand" | `<Calendar label bind:date bind:view entries tone>` with an `entry` snippet, `locale`, `today` | an own `<table>` of buttons with `aria-label="01.12.2026"` |
| tarol-components | "Open a form when a day is chosen instead of the day view" | `onselect={(day) => …}` | a click handler on the cell markup |
| tarol-components | "ESLint says `c` is `any` in `onSent={(c) => …}` on our own component" | move the type to a `.ts` module, `onSent={(c: Sent) => …}` | `eslint-disable`, or a `<script module>` type |
| tarol-design | "axe reports color-contrast right after switching a button's variant in a test" | `<ThemeRoot motion="reduce">` (or Playwright `reducedMotion`) | `setTimeout(400)` before axe |
| tarol-codegen | "CI must fail when the client cannot be generated" | rely on exit code 1 and the stderr line; `--check` in CI | piping to `/dev/null` and chaining with `;` |
| tarol-client | "Notes must be saved offline and sent later, with the refusal's details shown" | `createOutbox({ client, store: idbStore('app'), scope })`, `submit`, `failed[i].violation.detail`/`.reasons`, `retry`, `discard` | an own IndexedDB queue; a new key per retry |
| tarol-client | "The emergency card must open offline with its time" | `offlineReads({ store, scope, keep })`, `createClient({ fetch: reads.fetch })`, `savedAt(path)` | caching views in `localStorage` |
| tarol-client | "Show why a contract cannot start" | `violation.reasons`, each through `t(code)` | parsing `detail` |
| tarol-svelte | "Warn when the quota is exceeded and let the carer save anyway" | `form.confirmation` with `t(code, args)`, `form.confirm()` (or ChangeForm's Confirm) | a `confirmQuota` field in the input; a new idempotency key |
| tarol-client | "A queued change came back with a warning" | `outbox.failed[i].violation.confirm`, `outbox.confirm(key)` | `discard` and capture again |
| tarol-svelte | "Amounts have two decimal places" | the generated `Scale` rule from `multipleOf`; `check` | rounding the value before sending |

## Verification

`pnpm verify` (format, build, lint, typecheck, test, size, package checks, API reports, eng tests): **exit 0**
**[verified]** at `2f326b5` and `83338af` (round 3), and again at `f4f01f0` after TS-33 part 2.

* `pnpm test` at `f4f01f0`: 28 test files passed, 3 skipped; 281 tests passed, 15 skipped (on `main` before this round: 246
  passed, 15 skipped). The skipped tests are the existing ones that need the sample backend or a container (unchanged).
* `pnpm eng:test`: 20 passed, 0 failed (18 on `main`; + `typed-lint.test.mjs`).
* `check-deps` 7 packages, 0 violations; `check-contrast` 30 pairs, 0 below the minimum; `check-text` 29 components, 0
  literal texts; publint and attw clean for the new subpaths; API Extractor reports regenerated with `pnpm api:update`
  (new: `tarol-client-outbox.api.md`, `tarol-client-idb.api.md`) and checked.
* Size: every budget passes, with the proposed ThemeRoot budget (3.03 kB of 3.25 kB; it fails at 3 kB without `c2f323d`).
* Not part of `verify`, run separately: `apps/docs` Playwright `catalogue` project, 68 tests, all passed after `e5710cd`
  **[verified]** (not re-run after TS-33 part 2); the visual project was not run (baselines are made in the CI container).

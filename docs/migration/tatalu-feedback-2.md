# Feedback from Tatalu, round 2: implementation notes

The tarol-svelte items of Tatalu's waves 1 and 2 ([docs/feedback/tatalu.md](../feedback/tatalu.md#round-2), TS-9 …). Every
public API or behaviour change is listed here. Labels as in the [philosophy](../architecture/philosophy.md). Each item was
reproduced by a test that failed before the change (named per item).

## TS-9: nullable schemas

**Finding confirmed.** Tarol-Net writes `PersonName?` (a nullable reference) as `oneOf: [{type: "null"}, {$ref}]`; the
generator translated each member and failed on `{type: "null"}` with `a schema without a type` (the exact Tatalu error).
`Option<PostalAddress>` is a component schema `type: ["null", "object"]` with the record's members; the generator emitted
`interface OptionOfPostalAddress {…}` without `| null`. An enum with `type: ["string", "null"]` lost the `null` too.

**Change.**

* `oneOf`/`anyOf` whose members include `{type: "null"}` is `T | null` (null last), for a `$ref`, an inline enum, an object
  or a primitive; `{type: "null"}` alone is `null`.
* A type array with `"null"` is `T | null`: an enum (`"A" | "B" | null`), and a component schema `["null", "object"]` with
  members is `export type X = {…} | null` (it was an interface).
* Rules: a nullable member has no `Required` rule (null is a valid value; the backend says `Required` itself where it is
  not); a `oneOf [null, $ref]` member has the rules of its value type (`PersonName`'s `Length`); the members of a nullable
  record keep their rules (`address.street`).
* `@clorat/tarol-svelte` `changeForm`: `validate()` skips the rules of a path whose parent value is `null`, so a nullable
  record that is `null` does not block the submit with its members' `Required`.

**[verified]** `tarol-codegen/test/generate.test.ts` "nullable schemas (TS-9 …)" (red before: `GenerateError:
#/components/schemas/ChildView/properties/name/oneOf/0: a schema without a type`) — four cases, one type-checks a usage with
`null` in an input and `?.` on a view; `tarol-svelte/test/form.svelte.test.ts` "skips the rules of members of a nullable
record while it is null" (red before: the submit returned `undefined`). The sample's snapshot is unchanged.

Behaviour change: a document that failed now generates; an `Option<Record>` type is a type alias `{…} | null` instead of an
interface (code that `implements` or `extends` it must use the type alias); a nullable enum in a type array gains `| null`.
No new export.

## TS-10: `x-tarol-types` and `x-tarol-constants`

**Contract** (defined by Tarol-Net round 2): the document root carries `x-tarol-types: string[]`, names of
`components.schemas` entries the client must have although no operation references them (Tatalu: `MeaslesStatus`, the
result of a domain function), and `x-tarol-constants: { [Name]: literal }` with a string, a finite number, a boolean or a
list of these (Tatalu: `PrivacyDocuments.ProcessingAgreementVersion`).

**Change.** The generator already exported every component schema; it now checks `x-tarol-types` (not a list →
`GenerateError` at `#/x-tarol-types`; a name that is not a schema → at `#/x-tarol-types/<i>`), so a backend that lists a
type it did not describe fails at generation, not in the app. Each constant becomes `export const <Name> = <literal> as
const;` after a doc line `/** Backend constants (x-tarol-constants). */`, sorted by name; a name that is not PascalCase
(`^[A-Z][A-Za-z0-9]*$`) or a value that is no literal (an object, `NaN`) is a `GenerateError` with its pointer.

**[verified]** `tarol-codegen/test/generate.test.ts` "x-tarol-types and x-tarol-constants (TS-10 …)" (red before: the
unknown type name and the constants were ignored), the constants type-check as literal types (`'2026-03'`).

Public API: `OpenApiDocument['x-tarol-types']`, `OpenApiDocument['x-tarol-constants']`, the type `ConstantValue` (API
report regenerated). Generated output: new `export const`s when the document has constants; otherwise byte-identical.

## TS-11: typed creations

**Finding confirmed.** `changeForm(requests.createAuction, …)` typed the submit's value as `undefined`: the generated
request returned a plain `ChangeRequest`, and `changeForm`'s `T` defaulted to `undefined`. Tatalu wrote
`changeForm<I, Created>(…)` (`RegisterChild.svelte`).

**Change.** `@clorat/tarol-client` `ChangeRequest<T = undefined>`: `T` is the value a successful change returns, a type
only (no member carries it; TypeScript infers it from the type reference). `TarolClient.change<T>(request:
ChangeRequest<T>, …)` and `@clorat/tarol-svelte` `changeForm(change: (input: I) => ChangeRequest<T>, …)` infer it. The
generator types the request of a creation as `ChangeRequest<Created>` / `ChangeRequest<Created<XId>>` and of an admin
change with an answer as `ChangeRequest<View>`; plain changes stay `ChangeRequest` (= `ChangeRequest<undefined>`). Because
`T` is not used structurally, every `ChangeRequest<X>` is assignable to every other, so explicit `changeForm<I, Created>`,
`client.change<Created>(…)` and hand-written `ChangeRequest` values keep compiling.

**[verified]** `tarol-codegen/test/generate.test.ts` "typed creations (TS-11 …)" type-checks `changeForm(requests.createAuction,
…)` and `client.change(requests.createAuction(…))` without type arguments (red before: `Property 'id' does not exist on type
'never'` twice and `'direct.value' is possibly 'undefined'`). Snapshot change reviewed: the three request builders with a
result gain their type argument. `packages/tarol-admin/src/lib/api.ts` and `apps/docs/src/artflow/api.ts` regenerated.

Public API: `ChangeRequest` gains a type parameter (default `undefined`), `TarolClient.change`'s parameter is
`ChangeRequest<T>`, `changeForm`'s `change` returns `ChangeRequest<T>` (API reports regenerated).

## TS-12: a form that blocks silently

**Finding confirmed.** A client rule for a path no field shows (Tatalu: `guardian: Required`, the id is added by the change
builder, not typed in) failed `validate()`, so `submit()` returned `undefined`: no field error visible, no `formError`.

**Change.** `@clorat/tarol-svelte` `Form.register(path): () => void` declares that a field shows the path (returns the
undo; counted, so two fields of one path work). On a blocked submit, the client errors on paths that are **not registered
and have no value in the input** (`at(values, path) === undefined`) become `formError: { kind: 'invalid', errors, details }`
(details `[{ code }]`), which `ChangeForm` announces above the button; otherwise `formError` is cleared. Both conditions,
so that a hand-written field over an existing member (`''`, `null`) keeps its error on the field only, and a `FormField`
over a member without an initial value keeps it too. `@clorat/tarol-components` `FormField` registers its path in an
`$effect`.

Not changed: `form.values` stays a getter (the second half of FB-F02.2-5); replace all values with `form.reset(next)`.

**[verified]** `tarol-svelte/test/form.svelte.test.ts` "reports a client rule error of a path no field shows as formError …"
(red before: `formError` was `undefined`); `tarol-components/test/components.test.ts` "announces a client rule error of a
path no field shows …" and "keeps the error of a path a FormField shows on that field …" (red before the `FormField` change:
the alert appeared for `note`), axe 0 violations.

Public API: `Form.register` (API report regenerated). Behaviour change: such a submit sets `formError` (it stayed as it was).

## TS-13: `ready`

**Finding confirmed (as documented behaviour).** `query(…).loading` is `true` while any read is in flight, revalidations
included (focus, own change, push). A form created "after loading" (`{#if !view.loading}`) is destroyed and created again
on each revalidation, and the user's input is gone. Tatalu keeps its own `loaded` flag (`Profile.svelte`).

**Change.** `Query.ready` and `List.ready`: `false` until a first successful read, then `true` for the life of the rune
(also when a later read fails or the request changes). `loading` is unchanged; its doc comment now points to `ready`.
Skill rule 4 says which to use.

**[verified]** `tarol-svelte/test/query.svelte.test.ts` "is ready once the first value arrived …" (a failed first read is
not ready; a revalidation has `loading: true, ready: true`; a failed revalidation stays ready) and "is ready once the first
page arrived …" (red before: `ready` was `undefined`).

Public API: `Query.ready`, `List.ready` (API report regenerated).

## TS-14: own change, stale view

**Finding confirmed.** After a successful change every `query` of the client revalidates (`onChange`), but nobody waits for
it: `submit()` resolved when the PUT was answered, Tatalu showed "Gespeichert." and a second save right after it took the
old view value as "last seen" (`previous`), a false conflict with its own change (`Devices.svelte`, `audit.spec.ts`).

**Change.** `FormOptions.awaitRevalidation` (default `false`, unchanged timing): with `true`, a successful submit awaits
the reads that this client's own changes started (the revalidations `onChange` triggers, tracked per client in a
`WeakMap` created on first use, nothing at import) before it calls `onSuccess` and resolves; `pending` stays `true` until
then. A failed revalidation does not fail the submit (it is the query's `violation`). The new aggregate version is
`Ok.version` (from the change's `ETag`), as before.

Not done: making it the default. It changes when every form's submit resolves (the button stays busy for one more read),
so it is the owner's decision (proposed in the PR).

**[verified]** `tarol-svelte/test/form.svelte.test.ts` "with awaitRevalidation, resolves a successful submit after the
queries its change revalidates" (red before: the submit resolved while the view still read `15:00`).

Public API: `FormOptions.awaitRevalidation` (API report regenerated).

## TS-15: `action`

**Finding confirmed.** A change without a form (choose the main location, delete the account, deactivate a location) had
no rune: Tatalu calls `tarol(getTarol().client).changes.*` and keeps its own `refusal` state and code extraction per
screen (`Locations.svelte`, `BankSection.svelte`, `InsuranceSection.svelte`).

**Change.** `@clorat/tarol-svelte` `action(change, { client, onSuccess, awaitRevalidation })` → `Action<I, T>`:
`run(input, { expectedVersion })` returns the `Result` (or `undefined` when a run is already pending), `pending`,
`violation` (cleared by a success or `reset()`), `code` (the coded refusal's `code`, else the first code of the first
field of a 400, for `t(code)`), `requestId`. Like `changeForm`, a retry of the same input after a failure reuses the
idempotency key, and `T` is inferred from the request (`ChangeRequest<Created>`, TS-11).

**[verified]** `tarol-svelte/test/action.svelte.test.ts` (4 cases: pending and a 409's code and request id; a 400's field
code, success clears it, key reuse; expected version, a second run while pending, the inferred `Created`; and
`awaitRevalidation`). Red before: `The requested module '/src/index.ts' does not provide an export named 'action'`.

Public API: `action`, `Action`, `ActionOptions`, `RunOptions` (API report regenerated). Size: not in the measured
"svelte bindings" bundle (an unused export is tree-shaken); a bundle of `action` alone is 728 B gzip (`gzip -9`, it pulls in the revalidation tracking), **[verified]** `eng/bundle-svelte.mjs dist/index.js … action`.

## TS-16: `FormField` select, radio, date and time

**Finding confirmed.** `FormField` had text-like types, `number` and (since TS-4) `checkbox`; no select, radio, date or
time. Tatalu wrote `lib/ChoiceGroup.svelte` (radio buttons in a fieldset), `lib/SelectField.svelte` (a select over `Field`)
and shows the row errors of its opening hours itself (`OpeningHoursEditor.svelte`).

**Checked: per-row errors already worked.** `FormField` reads `form.error(path)` for any path, so `path="windows[3].to"`
shows the server's `windows[3].to` error; what was missing was a time field for the row. The new test pins it.

**Change.**

* `@clorat/tarol-design` `Select` (label, hint, error over `Field`; the native `select` with a disabled empty first entry
  `placeholder`; binds the chosen `value` or `null`) and `RadioGroup` (a `fieldset role="radiogroup"` named by its legend,
  hint and error in `aria-describedby`, `aria-invalid`/`aria-required` on the group, an option `hint` describes its radio,
  every option at least 44 px high, visible focus ring on the option); both generic over the value type
  (`V extends string`), props types `SelectProps`, `RadioGroupProps`. `TextField` accepts `type="time"`.
* `@clorat/tarol-components` `FormField type="select" | "radio"` with `options` (`{ value, label, hint? }`) and
  `placeholder`, touched on the change (like a box); `type="date"` (`DateField`, ISO date or `null`) and `type="time"`
  (`HH:mm`, `''` → `null`), touched on blur like a text field.

**[verified]** `tarol-design/test/primitives.test.ts` "select and radio group (TS-16)" (name, description, required, `null`
before a choice, arrow keys move the radio choice, 44 px rows, axe; red before: no export `RadioGroup`) and
`tarol-components/test/components.test.ts` "select, radio, date and time fields bind by path; a row error lands on its
row" (red before: no select was rendered, `selectOption` timed out), axe 0 violations.

Public API: `Select`, `RadioGroup`, `SelectProps`, `RadioGroupProps` (design API report regenerated); `TextField`'s `type`
gains `time`; `FormField`'s `type` gains `select`, `radio`, `date`, `time` and the props `options`, `placeholder` (in
`dist/FormField.svelte.d.ts`; the report lists `FormField` as `Component<Props>`). Size **[verified]** (`pnpm size`):
tarol-design "everything" 11.31 kB of 15 kB; tarol-components "ChangeForm + FormField" 2.3 kB of 3 kB.

## TS-17: merging catalogues

**Finding confirmed.** Tatalu builds its German catalogue from one part per area. Equal keys of two areas with different
texts were found only by `svelte-check` (TS1117, duplicate key in one literal), and a part spread into the catalogue
(`...vertraegeDe`) was overwritten silently by a later key (`occupancy.title`). tarol-design had no merge helper.

**Change.** `@clorat/tarol-design` `defineMessages(...parts: Catalogue[]): Catalogue` merges the parts in order and throws
`Error('defineMessages: "occupancy.title" has two texts: "…" (part 1) and "…" (part 3)')` for a key that two parts give
different texts; the same text twice is accepted (shared weekday names). It throws when the module is loaded, so the app's
first test fails. A spread inside an object literal is resolved by JavaScript before any function sees it, so it cannot be
detected at run time: the skill says to pass each part as an argument (a merged result can be a part again).

**[verified]** `tarol-design/test/messages.test.ts` "merges catalogue parts and refuses a key with two different texts …"
(red before: no export `defineMessages`).

Public API: `defineMessages` (API report regenerated).

## TS-18: `Tabs` on a narrow screen

**Finding confirmed.** `.t-tablist` was `display: flex` without wrapping or scrolling: six tabs (Tatalu's profile) made the
page 702 px wide at a 360 px viewport **[verified]** (the new test's first assertion, before the change).

**Change.** The tab list scrolls horizontally in itself (`overflow-x: auto`, thin scrollbar); tabs keep their width
(`flex: none`, no wrapping); the browser scrolls the focused tab into view (arrow keys, Home/End move the focus). The focus
ring is drawn inside the tab (`outline-offset: -2px`), because the scrolling list clips anything outside it. The line under
the tabs is an inset shadow instead of a border with the tabs' `-1px` overlap, which made the list scroll vertically by one
pixel once it scrolls. Looks unchanged otherwise.

**[verified]** `tarol-design/test/widgets.test.ts` "many tabs at 360 px …": no horizontal page scroll, the list scrolls
horizontally and not vertically, End focuses the last tab inside the list's box, the ring is inside the tab, axe 0
violations (red before: page 702 px wide; then list height 36 > 35 with the border).

No API change.

## TS-19: `AppShell` bottom bar, own scroll area

**Checked against Tatalu's frame.** Tatalu's `App.svelte` wraps `AppShell` (without `nav`) in `.frame` (a flex column of
`100dvh`) with `.frame-content` scrolling in itself and its `BottomNav` below it, with `env(safe-area-inset-bottom)`.
#46 (TS-1) gave `AppShell` a bottom bar: one row, 44 px targets, the safe area, the last line of the page above the bar, no
page scroll by the bar's height (the shell's rows are `auto 1fr auto` in `min-height: 100dvh`). What it did **not** cover:
the bar was `position: sticky` over a document that scrolls, so in the middle of a scroll every line passes under the bar
— the case behind Tatalu's axe `target-size` findings for covered buttons and Playwright's "intercepts pointer events".
**[verified]** the new test below: the document was 3,797 px high at a 740 px viewport.

**Change.** Below 40rem with `navPosition="bottom"` (and a `nav`): the shell is exactly `height: 100dvh` with rows
`auto minmax(0, 1fr) auto`; `main` scrolls (`overflow-y: auto`, `overscroll-behavior: contain`) between the header and the
bar; the bar is a plain grid row (no `sticky`, no `z-index`), padded by the safe area. Because `main` is now a scroll area,
it is a tab stop in this mode (`tabindex="0"`, a focus ring inside it), so the arrow keys scroll it (axe
`scrollable-region-focusable`); in the other modes it stays `tabindex="-1"` (the skip link's target). Svelte's
`a11y_no_noninteractive_tabindex` warns about a tab stop on `main`; it is suppressed at that element with this reason
(`<!-- svelte-ignore … -->`, the same form as `Combobox`'s): a scroll area without a tab stop cannot be scrolled with the
keyboard in every browser, which is the WCAG 2.1.1 failure axe reports. Above 40rem the
side navigation is unchanged.

Behaviour change: with `navPosition="bottom"` on a phone, `window` no longer scrolls; code that scrolls the page uses the
main landmark (`document.querySelector('main')?.scrollTo(…)`, or `element.scrollIntoView()`, which works either way).
`main` is a tab stop in `bottom` mode also on a wide screen (one extra tab stop; it is not a scroll area there).

**[verified]** `tarol-components/test/shell.test.ts` "navPosition="bottom": the page scrolls in its own area above the
bar …" (document height ≤ viewport, `main` scrolls, at mid-scroll `main` ends where the bar begins, bar at the viewport's
bottom, axe 0 violations; red before: document 3,797 px > 740); the TS-1 cases pass with `scrollIntoView` instead of
`window.scrollTo`.

No API change.

## TS-20: drafts

**Finding confirmed.** A half-filled `changeForm` was gone once the form closed (Tatalu US-01.1.3 AC 2); Tatalu wrote
`lib/draft.svelte.ts` (`keepDraft`: load with `Object.assign`, an `$effect` that writes, `clear()`).

**Change.** `FormOptions.draft: string | { key, storage? }`. The input is stored as JSON under `tarol.draft.<key>` in
`storage` (default `localStorage`, read from `globalThis` when the form is created, so nothing happens outside a browser):
restored (shallow `Object.assign` over `initial`, as Tatalu did) when the form is created, written by an `$effect` on every
change (removed while the values equal `initial`), removed after a successful submit and by `reset()`. Every storage call is
in `try`/`catch`: a private window or a blocked storage means no draft, never an error. New types `DraftOptions`,
`DraftStorage` (the three Web Storage methods).

Notes: the draft is per device and browser profile; give the key the user or tenant when people share a device (Tatalu's
key is per screen). With `from` (edit forms) the server's first value replaces a restored draft: drafts are for creation
forms.

**[verified]** `tarol-svelte/test/form.svelte.test.ts` "keeps a draft in browser storage, restores it, and clears it on
success" (red before: nothing was stored) and "works without a draft when the storage fails".

Public API: `FormOptions.draft`, `DraftOptions`, `DraftStorage` (API report regenerated).

## TS-21: form values with nothing chosen yet

**Finding confirmed.** `changeForm`'s values have the change's input type, so a required enum (or number) cannot be `null`
while nothing is chosen. Tatalu casts each value with `unchosen(value)` (`lib/forms.ts`) and writes an input function with
`T | null` per step; the docs app writes `changeForm<{ reserve: number | null }, Created>(…)`. Also, `changeForm` inferred
`I` from the `initial` literal when it was narrower than the change's input, so `{ state: null }` typed `state` as `null`.

**Change.** `@clorat/tarol-svelte`:

* `type FormInput<I> = { [K in keyof I]: I[K] | null }` and `allowNull(change)`, which returns the same function typed
  `(input: FormInput<I>) => ChangeRequest<T>` (no run-time work). `changeForm(allowNull(requests.openDayCare), { state:
  null, … }, { rules })` then has `form.values.state: State | null`. The generated `Required` rule of a required member stops
  the submit while it is `null` (and the backend answers `Required` too, FB-F01.1-11's proposal).
* `changeForm(change, initial: NoInfer<I>, …)`: the input type is taken from the change, never from a narrower initial
  literal (TypeScript 5.4 or later).

Not done: a generated `FormInput` per change in `tarol-codegen`; one generic type over the generated input does the same.
Only top-level members: a nested required member (`address.city`) keeps its type.

**[verified]** `tarol-svelte/test/form.svelte.test.ts` "allowNull lets a required member be null until the user chooses …"
(red before: no export `allowNull`; then, before `NoInfer`, svelte-check: `Type '"SH"' is not assignable to type 'null'`) and
`tarol-codegen/test/generate.test.ts` "a form over a generated change with nothing chosen yet" (type-checks the README
example and refuses `null` without `allowNull`).

Public API: `allowNull`, `FormInput` (API report regenerated); `changeForm`'s `initial` is `NoInfer<I>`. Behaviour (types
only): a call whose `initial` literal was narrower than the change's input and relied on that now reports the mismatch.

## TS-22: `DataTable filter`

**Finding confirmed.** List filters are equality only on the backend; a time range ("last week") is narrowed in the
browser, and `DataTable` rendered `list.items` as they were, so Tatalu wrapped the `List` in its own object
(`AuditLog.svelte`).

**Change.** `DataTableProps.filter?: (row: T) => boolean`: the table renders, counts (`aria-rowcount`), navigates and
virtualizes only the rows it keeps. `list.items`, `hasMore` and `more()` are untouched, so "load more" stays the list's
(Tatalu loads older pages while they fall into the range). `QueryState`'s empty state still looks at the list, not the
filter: when the filter keeps nothing, show your own text.

**[verified]** `tarol-components/test/components.test.ts` "shows only the rows a filter keeps, with the grid row count over
them" (red before: all five rows were rendered), axe 0 violations.

Public API: `DataTableProps.filter` (API report regenerated). The server-side range filter is Tarol-Net round 2.

## TS-23: `tarol-oidc` offline

**Finding confirmed.** `restore()` is a top-level redirect: offline it either rejected with `TypeError: Failed to fetch`
(the discovery) or, with the metadata served from a service worker's cache, navigated to the authorization server and
left the app on the browser's error page. There was no "last signed-in person" for an app opened offline. Tatalu calls
`restore()` only when `navigator.onLine` (`lib/auth.ts`) and remembers subject, tenant and roles itself
(`lib/offline/session.ts`).

**Change.**

* `restore(returnTo?)` resolves `RestoreResult` (`'redirected' | 'offline'`, it was `void`). Before it navigates it checks
  `OidcOptions.online` (default `navigator.onLine`), the discovery, and a `HEAD` with `mode: 'no-cors'` and `cache:
  'no-store'` to the authorization endpoint (an opaque answer is enough; a `TypeError` means no network or no server). Any
  other error still throws.
* `OidcOptions.lastSession: true | OidcStorage` (default off: a person's identifiers stay out of persistent storage unless
  the app asks): every sign-in and refresh writes `{ subject, tenant, roles, signedInAt }` (no token) under
  `tarol-oidc-last`; `logout()` removes it; a refused refresh keeps it (that person is still the last one).
  `oidc.lastSession()` reads it (`null` when off, empty or unreadable).
* Skill: a section "Offline PWA".

**[verified]** `tarol-oidc/test/oidc.test.ts` "an offline PWA (TS-23 …)": offline → `'offline'`, no navigation; unreachable
server → `'offline'`, then `'redirected'` once it answers; the last session survives a new `createOidc` (a reload) without
tokens, contains no token text, and is gone after `logout()`; off by default. Red before: `restore()` resolved
`undefined`, rejected with `TypeError: Failed to fetch`, and `lastSession` did not exist.

Public API: `RestoreResult`, `LastSession`, `OidcOptions.online`, `OidcOptions.lastSession`, `Oidc.lastSession`,
`Oidc.restore` now returns `Promise<RestoreResult>` (API reports regenerated). Size **[verified]** `pnpm size`: 8.01 kB gzip
of 9 kB.

## TS-24: a stronger sign-in

**Finding confirmed.** `login(returnTo)` could not ask for a stronger or a fresh sign-in (no `acr_values`, `max_age`,
`prompt=login`); Tatalu reads `amr` from `session.claims` itself (`main.ts`).

**Change.** `login(returnTo?: string | LoginOptions)`; `LoginOptions { returnTo, acr, maxAge, prompt }` sends
`acr_values` (space-separated), `max_age` and `prompt` (`login`, `select_account`, `consent`). `maxAge` is kept with the
pending login, so the callback passes it to `oauth4webapi`'s check of `auth_time` (an older sign-in is
`{ kind: 'signed-out', error: 'invalid_response' }`). `OidcSession.factors` is the ID token's `amr` (strings only; `[]`
without). Not done: Zitadel values in the preset (which `acr` values Zitadel honours is not documented; `amr` is read as it
comes); the backend policy is Tarol-Net's part.

**[verified]** `tarol-oidc/test/oidc.test.ts` "a stronger sign-in (TS-24 …)": the three parameters in the authorization
URL, a sign-in older than `maxAge` refused, a fresh one accepted, `factors` from `amr` (red before: no `acr_values`, no
`factors`).

Public API: `LoginOptions`, `OidcSession.factors`, `Oidc.login`'s parameter (API reports regenerated). Behaviour: none
for `login(returnTo)`.

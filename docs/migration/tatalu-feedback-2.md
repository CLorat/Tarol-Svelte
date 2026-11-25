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

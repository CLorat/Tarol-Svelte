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

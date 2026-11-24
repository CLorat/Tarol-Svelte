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

## TS-8: singleton views

**Finding checked: no client change needed.** `tarol-codegen` builds a read's parameters from the operation's path
parameters only (`generate.ts`, `pathParams`); an operation without one gets a call without arguments. With Tarol-Net TN-2
(`[PerTenant]`, CLorat/Tarol-Net PR "primitives, changes: aggregates with one instance per tenant") the backend writes
`GET /house` without `{id}`, and the generator emits `houseView: (): ReadRequest => ({ path: \`/house\` })` and
`api.houseView()` **[verified]** (`test/generate.test.ts`, "a view of a per-tenant aggregate"; it also type-checks). An app
then no longer brands the tenant id as the aggregate id (`asId<'ChildDayCare'>(session.tenant)` in Tatalu's `App.svelte`).

No public API or behaviour change; the test pins the shape.

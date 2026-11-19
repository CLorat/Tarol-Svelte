## What and why

<!-- One clear feature: which step (or part of it) of docs/migration/plan.md this PR delivers, and why. -->

## Public API and behaviour changes

<!-- Every public API or behaviour change, or "none". Details belong in docs/migration/<step>.md. -->

## Suppressions and lint configuration

<!-- Every new suppression or rule change with its reason, or "none". -->

## Philosophy (docs/architecture/philosophy.md)

- P1 fast (budgets, tree-shaking): …
- P2 little to write: …
- P3 no bloat (dependency graph): …
- P4 defaults, open ends: …
- P5 correct (backend shapes, Result, idempotency): …
- P6 accessible (axe, keyboard): …
- P7 international (no literal text, de/en): …

## Verification

- [ ] `pnpm format:check` and `pnpm lint` (0 warnings)
- [ ] `pnpm build` and `pnpm typecheck` (every package)
- [ ] `pnpm test` (counts: unit …, component …)
- [ ] `pnpm size` (budgets: …)
- [ ] `pnpm check:packages` (publint, attw, check-deps) and `pnpm api:check`
- [ ] e2e against `samples/Sagas` (from step 8 on)
- [ ] Note, plan status, CHANGELOG and README updated

## Not in this PR

<!-- What is deliberately left out, and where it will be done. -->

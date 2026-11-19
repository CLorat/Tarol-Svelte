# AGENTS.md

Instructions for coding agents (Claude Code, Copilot, Codex, …) working in **tarol-svelte**.
`CLAUDE.md` points here; this file is the single source.

## What this repository is

The browser side of [Tarol](https://github.com/CLorat/Tarol-Net), the .NET 11 framework for event-sourced DDD: a
framework-free TypeScript client, Svelte 5 bindings, a typed-client generator, a design system and default components.
Read [docs/architecture/philosophy.md](docs/architecture/philosophy.md) (the principles every PR is held to) and
[docs/architecture/overview.md](docs/architecture/overview.md) (packages and the backend interface inventory) first.
The plan and the owner's decisions (SV-*): [docs/migration/plan.md](docs/migration/plan.md),
[docs/migration/decisions.md](docs/migration/decisions.md).

## Build, test, format

Node 22, pnpm 10 (through corepack: `corepack enable`).

```bash
pnpm install --frozen-lockfile      # install scripts never run (onlyBuiltDependencies: [])
pnpm verify                         # format, lint, build, typecheck, test, size, package checks, API reports, eng tests
pnpm api:update                     # after a public API change: regenerates the API Extractor reports
```

## Rules

* Measure before recommending: bundle sizes (gzip and brotli), timings as the minimum of several runs; prove a check works
  with a deliberate violation.
* TypeScript `strict`; warnings are errors; no `any` in public types; no suppression without a written reason in the step's
  note.
* No runtime dependency beyond Svelte unless measured and decided (`docs/migration/dependencies.md`); versions pinned by the
  lockfile; no install scripts.
* The backend is the truth: build from Tarol-Net's code, not from memory. If the backend lacks something, write it down as a
  backend change in `docs/backend/changes.md`; never work around it in the client.
* Every public API or behaviour change is listed in the step's note. Public API reports are generated, never hand-written.
* Labels **[verified]** / **[verified by reading]** / **[unverified]** as defined in the philosophy.
* The licence is AGPL-3.0-only plus the owner's commercial licence (SV-1; `LICENSE`, `NOTICE`, `CONTRIBUTING.md` with the
  CLA). Do not change them, do not add per-file licence headers or other legal claims.
* Never merge, never create tags, never publish to the public npm registry (GitHub Packages only, SV-14). No secrets in the
  repository or the chat; test identity providers run in Testcontainers.
* Pull requests: one clear feature each; stacked PRs are retargeted to `main` before their base is merged. Commits small,
  imperative subject, body explains why.

## Skills: what you must add with a package

Every package users write code against ships `packages/<pkg>/skills/tarol-<topic>/SKILL.md` (front matter `name` = folder
name, `description: Use when … Covers … Do not …`), written from the code and tests, 2–8 KB, rules first, one minimal
example, common mistakes with the error they produce. No instructions to download, execute, change settings or disable
checks. Add its evaluation checklist to the step's note.

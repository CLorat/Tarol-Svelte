# Step 9: docs app and component catalogue

Decided by SV-11: an own Svelte + Vite app in `apps/docs`, static, deployed to GitHub Pages later.

* A page per component: live examples (real `.svelte` files, shown with their source), props table generated from the
  component's types, token list, keyboard table, a11y notes.
* Guides: first screen in minutes (shell + list + create form against the sample), forms and validation, push, theming,
  auth with Zitadel.
* Every page is visited by the e2e suite: axe (0 violations), CLS ≤ 0.01, screenshots (SV-12).
* No Storybook or Histoire dependency.

# Design-session measurements

Reproducible inputs for the numbers in the evaluation notes. This folder is **not** part of the pnpm workspace and ships
nothing; its `pnpm-lock.yaml` pins every candidate.

```bash
cd docs/migration/measurements
pnpm install --frozen-lockfile --ignore-scripts
bash run.sh          # bundle sizes  -> sizes.txt
node bench.cjs       # list render timings in Chromium (needs dist/m_List.js from run.sh) -> bench.txt
```

* Bundles: Vite 7.3.8 library build, esbuild minify, `target: es2022`, ESM, everything bundled (no externals). Sizes are
  deterministic, so one build is enough; gzip level 9 and brotli quality 11 from Node's zlib (`size.mjs`).
* `ownfetch.js` and `ownhub.js` are measurement prototypes of the transport and the SignalR JSON client, not the shipped
  code; the shipped packages are measured again by `size-limit` in CI.
* `bench.cjs`: a keyed `{#each}` table of N rows (4 cells) rendered from an empty state in a fresh page, timed from the
  `$state` assignment to the next animation frame plus a task; 5 runs per N, min and median reported; "update" changes
  every 10th row. Machine: this session's cloud container, headless Chromium from the preinstalled Playwright.
* `tw/`: the same button, field, dialog and table styled with Tailwind v4 utilities (`c.html`) and with token CSS
  (`own.css`).

## Results (2026-11-19)

`sizes.txt` (bytes):

```
m_Base.js       raw  54020  gzip 15787  br 14022   Svelte 5.58.0 baseline (one $state counter)
m_BitsDialog.js raw 153089  gzip 41309  br 36006   + Bits UI 2.21.0 Dialog
m_MeltDialog.js raw 112363  gzip 32735  br 28821   + Melt UI 0.86.6 createDialog
m_OwnDialog.js  raw  61779  gzip 18008  br 15935   + own <dialog> component
m_List.js       raw  61905  gzip 18027  br 15969   benchmark list
oauth4.js       raw  22708  gzip  6862  br  6040   oauth4webapi 3.8.8, code+PKCE+refresh
oidcclient.js   raw  96070  gzip 21868  br 18832   oidc-client-ts 3.5.0 UserManager
openapifetch.js raw  11401  gzip  3619  br  3124   openapi-fetch 0.17.0
ownfetch.js     raw    661  gzip   409  br   350   own transport prototype
ownhub.js       raw   1795  gzip   888  br   783   own SignalR JSON client prototype
signalr.js      raw  88263  gzip 19879  br 17109   @microsoft/signalr 11.0.0
tw/out.css      raw  13208  gzip  3406  br  2952   Tailwind 4.3.5
tw/own.css      raw   2419  gzip   840  br   698   token CSS
```

`bench.txt` (ms; two sessions gave 13.3 / 44.0 / 77.1 and 12.6 / 42.6 / 74.7 for 100 / 500 / 1,000 rows, min of 5):
see the file.

## Backend checks against the running sample

Commands used for the **[verified]** rows in `../client.md` and `../../backend/changes.md` (sample started with
`dotnet samples/Sagas/AppHost/bin/Debug/net11.0/ArtFlow.AppHost.dll`, tokens by client credentials as in Tarol-Net's
`samples/Sagas/apphost.sh`):

```bash
curl -si -X POST :5080/auctions -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -H 'Idempotency-Key: k-1' -d '{"reserve":100}'
curl -si -X POST … same key, '{"reserve":101}'          # 422 Idempotency.KeyReused
curl -si -X POST … '{"reserve":"x"}'                    # 400 {"errors":{"reserve":["Json"]}}
curl -si :5080/auctions -H 'Origin: http://localhost:5173'   # 401, no Access-Control-* headers
curl -si ':5080/auctions?limit=500' -H "Authorization: Bearer $B"   # 400 limit:["Range"]
curl -s  :5080/openapi/v1.json                          # OpenAPI 3.2.0, 6 operations
```

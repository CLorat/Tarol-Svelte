# Step 8: end-to-end tests against the backend sample

## Inventory

`samples/Sagas` (Tarol-Net) runs through its Aspire AppHost: PostgreSQL, NATS, Zitadel v4.20.3 on `:8080`, the API on
`:5080`, the worker on `:5081`, the dashboard on `:18888`. In this session it was built with SDK 11.0.100 in 75 s and
started in about 60 s, `/health/ready` 200 [verified]. Tokens come from `$TMPDIR/artflow-zitadel/clients.txt` via client
credentials (alice: seller + tarol-admin; bob: bidder).

## The scenarios and what each needs

| Scenario | Backend entry | Available today |
|---|---|---|
| a change | `POST /auctions`, `POST /auctions/{id}/bids` | yes [verified] |
| a list with paging | `GET /auctions?limit=…&count=true`, `next` → `after` | yes [verified] |
| a validation error on the right field | a change with a rule | only `{"reserve":["Json"]}` and `limit:["Range"]`; a domain rule needs BC-9 |
| a push update | hub `/tarol/messages` | no: the sample maps no hub, and the hub ignores `access_token` (BC-2, BC-9) |
| an expired token | short token lifetime | no: BC-9 (a short-lived token option) |
| an erased subject | `POST /tarol/admin/subjects/{id}/erase?tenant=…` | yes, with `?tenant=` (the sample's own script omits it and gets 400) |
| a browser login | Zitadel PKCE app, human user | no: BC-9 |

## Design

* A Playwright project `e2e` in `apps/docs` (the docs app hosts the example screens). `globalSetup` starts the AppHost
  (`dotnet ArtFlow.AppHost.dll`) unless `TAROL_E2E_URL` points to a running one, waits for `/health/ready` (≤ 240 s), reads
  the client credentials, and stops everything in `globalTeardown`.
* Until BC-9: the browser gets machine-user tokens through a test-only `TokenProvider`; the Vite dev server proxies
  `/api` to `:5080` (same origin, so BC-1 is not needed for the first runs).
* Web vitals: INP and CLS collected per test through `web-vitals` (test-only), asserted against P1.
* Visual regression (SV-12): `toHaveScreenshot` per component page × theme × density, run in the Linux CI container
  only; baselines are generated in CI and committed by the PR that changes them.
* CI: a separate `e2e` job (needs Docker and the .NET 11 SDK), checking out `CLorat/Tarol-Net` at a pinned commit.

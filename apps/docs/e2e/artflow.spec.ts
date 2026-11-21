import { readFileSync } from 'node:fs';
import { accessToken, api, sample, sql, userId, type User } from './sample.js';
import { expect, expectAccessible, signIn, test } from './fixtures.js';

interface Created {
  id: string;
}

const createAuction = (user: User, reserve = 100) => api<Created>(user, 'POST', '/auctions', { reserve });

test('a change: ada creates an auction, ben bids on it', async ({ browser, page }) => {
  await signIn(page, 'ada', '/#/auctions');
  await page.getByLabel('Reserve (EUR)').fill('120');
  await page.getByRole('button', { name: 'Create auction' }).click();
  await expect(page).toHaveURL(/#\/auctions\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).hash.split('/').at(-1) ?? '';
  await expect(page.getByRole('heading', { level: 1, name: `Auction ${id.slice(-6)}` })).toBeVisible();
  await expect(page.getByTestId('bids')).toHaveText('0 bids');
  await expectAccessible(page);

  const ben = await browser.newPage();
  await signIn(ben, 'ben', `/#/auctions/${id}`);
  await ben.getByLabel('Amount (EUR)').fill('150');
  await ben.getByRole('button', { name: 'Bid' }).click();
  await expect(ben.getByText('Bid placed.')).toBeVisible();
  await expect(ben.getByTestId('bids')).toHaveText('1 bid');
  await ben.close();
});

test('the app calls the API on its origin (no proxy), and reads ETag and Tarol-Position across origins', async ({
  page,
}) => {
  await signIn(page, 'ada');
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.url() === `${sample.api}/auctions`);
  await page.goto('/#/auctions');
  await page.getByLabel('Reserve (EUR)').fill('130');
  await page.getByRole('button', { name: 'Create auction' }).click();
  const answer = await created;
  // a cross-origin answer from the API itself, readable because the backend allows the app's origin
  expect(answer.status()).toBe(201);
  expect(await answer.headerValue('access-control-allow-origin')).toBe('http://localhost:5173');
  expect(await answer.headerValue('access-control-expose-headers')).toMatch(/ETag.*Tarol-Position/);
  await expect(page).toHaveURL(/#\/auctions\/[0-9a-f-]{36}$/);
  // the page script reads what CORS exposes: the version from ETag, the position from Tarol-Position (a preflighted request)
  const token = await accessToken('alice'); // the page script's own token (test setup), not the app's
  const read = await page.evaluate(async ([api, token]) => {
    const r = await fetch(`${api}/auctions?limit=1`, { headers: { authorization: `Bearer ${token}` } });
    return {
      status: r.status,
      etag: r.headers.get('etag'),
      position: r.headers.get('tarol-position'),
      id: r.headers.get('tarol-request-id'),
    };
  }, [sample.api, token] as const);
  expect(read.status).toBe(200);
  expect(read.etag).toMatch(/^W\/"/);
  expect(read.position).toMatch(/^\d+\.\d+$/);
  expect(read.id).toMatch(/^[0-9a-f]{32}$/);
});

test('a paged list: 5 rows, the total, and the next page by its cursor', async ({ page }) => {
  for (let i = 0; i < 6; i++) await createAuction('alice');
  await signIn(page, 'ada');
  const cursors: (string | null)[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.origin === sample.api && url.pathname === '/auctions') cursors.push(url.searchParams.get('after'));
  });
  await page.goto('/#/auctions');
  const grid = page.getByRole('grid', { name: 'All auctions' });
  await expect(grid.getByRole('row')).toHaveCount(6); // header + 5
  const total = Number((await page.getByTestId('total').textContent())?.replace(/\D/g, ''));
  expect(total).toBeGreaterThanOrEqual(6);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(grid.getByRole('row')).toHaveCount(Math.min(total, 10) + 1);
  expect(cursors.filter((c) => c !== null)).toHaveLength(1);
  // keyboard: the grid has one tab stop and moves by arrows
  await grid.getByRole('link').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(':focus')).toHaveText(/^Auction [0-9a-f]{6}$/);
  await expectAccessible(page);
});

test('a validation error on the right field: the client rule, and the server 400 mapped by path', async ({ page }) => {
  await signIn(page, 'ada');
  let posts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url() === `${sample.api}/auctions`) posts++;
  });
  await page.goto('/#/auctions');
  const reserve = page.getByLabel('Reserve (EUR)');
  // the rule comes from the backend's OpenAPI document (tarol-codegen): Required, checked before sending
  await page.getByRole('button', { name: 'Create auction' }).click();
  await expect(reserve).toHaveAttribute('aria-invalid', 'true');
  // and the Range of x-tarol-rules, with its bounds, before sending
  await reserve.fill('0');
  await page.getByRole('button', { name: 'Create auction' }).click();
  await expect(reserve).toHaveAccessibleDescription('Enter a value between 1 and 1000000.');
  expect(posts).toBe(0);
  // the backend's own verdict: the body without the member is answered 400 {"reserve":["Required"]} by the real API,
  // and lands on the field with the same path
  await page.route(`${sample.api}/auctions`, (route) =>
    route.request().method() === 'POST' ? route.continue({ postData: '{}' }) : route.continue(),
  );
  await reserve.fill('100');
  await page.getByRole('button', { name: 'Create auction' }).click();
  await expect(reserve).toHaveAttribute('aria-invalid', 'true');
  await expect(reserve).toHaveAccessibleDescription(/required|enter/i);
  expect(posts).toBe(1);
  await expectAccessible(page);
});

test('the server’s rule on the right field: 400 Range on the reserve, with the bounds of its detail', async ({
  page,
}) => {
  // the page without client rules: the value reaches the real API, whose [Range(1, 1_000_000)] refuses it
  await signIn(page, 'ada', '/#/auctions?validate=server');
  const answer = page.waitForResponse((r) => r.request().method() === 'POST' && r.url() === `${sample.api}/auctions`);
  const reserve = page.getByLabel('Reserve (EUR)');
  await reserve.fill('0');
  await page.getByRole('button', { name: 'Create auction' }).click();
  const r = await answer;
  expect(r.status()).toBe(400);
  expect(await r.json()).toMatchObject({
    errors: { reserve: ['Range'] },
    errorDetails: { reserve: [{ code: 'Range', detail: '1..1000000' }] },
  });
  await expect(reserve).toHaveAttribute('aria-invalid', 'true');
  await expect(reserve).toHaveAccessibleDescription('Enter a value between 1 and 1000000.');
  await expectAccessible(page);
});

test('a coded refusal: ada (a seller) may not bid; the optimistic bid is rolled back', async ({ page }) => {
  const { id } = await createAuction('alice');
  await signIn(page, 'ada');
  await page.goto(`/#/auctions/${id}`);
  await expect(page.getByTestId('bids')).toHaveText('0 bids');
  await page.getByLabel('Amount (EUR)').fill('150');
  await page.getByRole('button', { name: 'Bid' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('bids')).toHaveText('0 bids');
});

test('a reload signs in again without the login page (prompt=none)', async ({ page }) => {
  await signIn(page, 'ada', '/#/auctions');
  await page.reload(); // the tokens were in memory only (SV-7): Zitadel's session answers the silent request
  await expect(page.getByTestId('user')).toHaveText(userId('ada'));
  await expect(page.getByRole('grid', { name: 'All auctions' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#/auctions');
});

test('an expired token: 401, one refresh, the read repeated; the hub closes and reconnects', async ({
  page,
}) => {
  test.setTimeout(150_000); // waits (by polling) for the server to see the 30-second token expire
  const { id } = await createAuction('alice');
  const bearers: string[] = [];
  const refreshes: string[] = [];
  const statuses: number[] = [];
  const hub = `${sample.api.replace(/^http/, 'ws')}/tarol/messages`;
  const sockets: { url: string; closed: boolean }[] = [];
  page.on('request', (r) => {
    const auth = r.headers()['authorization'];
    if (r.url().startsWith(sample.api) && auth) bearers.push(auth.slice('Bearer '.length));
    if (r.url() === `${sample.issuer}/oauth/v2/token` && (r.postData() ?? '').includes('grant_type=refresh_token'))
      refreshes.push(r.url());
  });
  page.on('response', (r) => {
    if (new URL(r.url()).pathname === `/auctions/${id}`) statuses.push(r.status());
  });
  page.on('websocket', (ws) => {
    if (!ws.url().startsWith(hub)) return;
    const socket = { url: ws.url(), closed: false };
    sockets.push(socket);
    ws.on('close', () => (socket.closed = true));
  });
  await page.clock.install(); // the page's own clock, so it can be stopped below
  await signIn(page, 'ada', '/#/auctions');
  const token = bearers.at(-1) ?? '';
  const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, number>;
  const lifetime = (claims['exp'] ?? 0) - (claims['iat'] ?? 0);
  test.skip(lifetime > 120, `needs the sample started with ARTFLOW_TOKEN_LIFETIME=30s (tokens live ${String(lifetime)} s)`);
  await expect.poll(() => sockets.length).toBe(1);
  // the page's time stops, as in a throttled background tab: its early refresh (at 80 % of the lifetime) does not run, and
  // the client still believes in its token when the server no longer does
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  const status = async (): Promise<number> =>
    (await fetch(`${sample.api}/auctions?limit=1`, { headers: { authorization: `Bearer ${token}` } })).status;
  await expect.poll(status, { timeout: 120_000, intervals: [1_000] }).toBe(401); // the server's own expiry
  await expect.poll(() => sockets[0]?.closed, { timeout: 30_000 }).toBe(true); // the hub closed it at expiry
  await page.goto(`/#/auctions/${id}`);
  await expect(page.getByTestId('bids')).toHaveText('0 bids');
  expect(statuses.slice(0, 2)).toEqual([401, 200]); // the expired token, then the refreshed one
  expect(refreshes).toHaveLength(1);
  // time runs again: the push client's reconnect (a timer) asks for the token and gets the refreshed one
  await page.clock.resume();
  await expect.poll(() => sockets.length, { timeout: 30_000 }).toBe(2);
  expect(new URL(sockets[1]?.url ?? '').searchParams.get('access_token')).not.toBe(token);
  await api('bob', 'POST', `/auctions/${id}/bids`, { amount: 150 });
  await expect(page.getByTestId('bids')).toHaveText('1 bid'); // pushed over the new connection
});

test('a rejected token: the 401 is answered by a refresh and the read repeated once', async ({ page }) => {
  await signIn(page, 'ada');
  // the real 30-second expiry is B4 (ARTFLOW_TOKEN_LIFETIME); here the first list read carries a token the API rejects
  const refreshes: string[] = [];
  page.on('request', (r) => {
    if (r.url() === `${sample.issuer}/oauth/v2/token` && (r.postData() ?? '').includes('grant_type=refresh_token'))
      refreshes.push(r.url());
  });
  let spoiled = false;
  await page.route(
    (url) => url.origin === sample.api && url.pathname === '/auctions',
    (route) => {
      if (spoiled || route.request().method() !== 'GET') return route.continue();
      spoiled = true;
      return route.continue({
        headers: { ...route.request().headers(), authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjF9.c2ln' },
      });
    },
  );
  const statuses: number[] = [];
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.origin === sample.api && url.pathname === '/auctions') statuses.push(r.status());
  });
  await page.goto('/#/auctions');
  await expect(page.getByRole('grid', { name: 'All auctions' })).toBeVisible();
  expect(statuses.slice(0, 2)).toEqual([401, 200]);
  expect(refreshes).toHaveLength(1); // a real refresh-token grant at Zitadel
});


test('the admin UI: ada exports a data subject, erases it, and its export has no personal data left', async ({
  page,
}) => {
  // the sample has no list of bidder profiles: its apphost.sh finds bob's profile in the store, and so does this setup
  const subject = sql("SELECT stream_id FROM tarol.events WHERE type = 'bidder_profile' LIMIT 1") || undefined;
  test.skip(subject === undefined, 'the sample has no bidder profile yet');
  const id = subject ?? '';
  await signIn(page, 'ada', '/#/admin');
  await page.getByRole('tab', { name: 'Data subject' }).click();
  await page.getByLabel(/Subject id/).fill(id);
  const exported = async (): Promise<string> => {
    await page.getByRole('button', { name: 'Export' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: /^Download the export/ }).click();
    return readFileSync(await (await download).path(), 'utf8');
  };
  const before = await exported();
  expect(JSON.parse(before)).toMatchObject({ subject: id, tenant: '00000000-0000-0000-0000-000000000000' });
  const answer = page.waitForResponse((r) => r.url().includes(`/subjects/${id}/erase`));
  await page.getByRole('button', { name: 'Erase personal data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Erase personal data' });
  await dialog.getByLabel(/Type the subject id/).fill(id);
  await dialog.getByRole('button', { name: 'Erase personal data' }).click();
  expect((await answer).status()).toBe(200); // it was a 500 without a body before Tarol-Net #95
  // a first run erases (bob's email was in the export), a later run finds it erased already
  const outcome = page.getByRole('status').filter({ hasText: /Erased \(1 streams\)\.|Already erased\./ });
  await expect(outcome).toBeVisible();
  if (before.includes('@artflow.example')) await expect(outcome).toContainText('Erased (1 streams).');
  expect(await exported()).not.toContain('@artflow.example');
  await expectAccessible(page);
});

test('the admin UI: ada sees the dead-letter kinds and the projections; ben gets the 403', async ({
  browser,
  page,
}) => {
  await signIn(page, 'ada', '/#/admin');
  const kind = page.getByRole('combobox', { name: 'Kind' });
  await expect(kind.getByRole('option')).toHaveText(['jobs', 'reactions']); // GET {admin}/dead
  await kind.selectOption('reactions');
  await expect(page.getByText('Nothing here yet.')).toBeVisible(); // the sample has no dead letters
  await page.getByRole('tab', { name: 'Projections' }).click();
  const table = page.getByRole('table', { name: 'Projections' });
  await expect(table.getByRole('row', { name: /auction-list 1 current/ })).toBeVisible();
  await expect(table.getByRole('button')).toHaveCount(0); // nothing superseded: nothing to drop
  await expectAccessible(page);

  const ben = await browser.newPage();
  await signIn(ben, 'ben', '/#/admin');
  // the role check of the admin entry answers before Tarol's code runs: no Tarol-Request-Id, so no reference (BC-21)
  await expect(ben.getByRole('alert').first()).toHaveText(/^You are not allowed to do this\.\s+Try again$/);
  await ben.close();
});


test('the search box finds an auction and opens it', async ({ page }) => {
  await signIn(page, 'ada', '/#/auctions');
  const seller =
    (await api<{ items: { seller: string }[] }>('alice', 'GET', '/auctions?limit=1')).items[0]?.seller ?? '';
  const box = page.getByRole('combobox', { name: 'Search' });
  await box.fill(seller);
  const option = page.getByRole('listbox', { name: 'Search' }).getByRole('option').first();
  await expect(option).toBeVisible();
  await box.press('ArrowDown');
  await box.press('Enter');
  await expect(page).toHaveURL(/#\/auctions\/[0-9a-f-]{36}$/);
});

test('a push update: a bid by bob updates ada’s open auction', async ({ page }) => {
  const { id } = await createAuction('alice');
  // the hub connection: a WebSocket to the API with the token in the query (browsers cannot set headers on it); its
  // frames are recorded from the start, so a frame that arrives before an assertion is not missed
  const hub = `${sample.api.replace(/^http/, 'ws')}/tarol/messages`;
  const sockets: string[] = [];
  const frames: string[] = [];
  page.on('websocket', (ws) => {
    if (!ws.url().startsWith(hub)) return;
    sockets.push(ws.url());
    ws.on('framereceived', (f) => frames.push(String(f.payload)));
  });
  await signIn(page, 'ada', `/#/auctions/${id}`); // the app connects to the hub once signed in
  await expect(page.getByTestId('bids')).toHaveText('0 bids');
  await expect.poll(() => sockets.length).toBe(1);
  expect(new URL(sockets[0] ?? '').searchParams.get('access_token')).toMatch(/^ey/);
  // subscribed once the hub has answered the Subscribe invocation (a completion frame)
  await expect.poll(() => frames.some((f) => f.includes('"type":3'))).toBe(true);
  await api('bob', 'POST', `/auctions/${id}/bids`, { amount: 150 }); // another user, outside this page
  await expect.poll(() => frames.some((f) => f.includes('artflow.bid-placed') && f.includes(id))).toBe(true);
  await expect(page.getByTestId('bids')).toHaveText('1 bid'); // revalidated by the push, no reload
});


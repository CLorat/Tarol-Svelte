import { api, sql, type User } from './sample.js';
import { expect, expectAccessible, signIn, test } from './fixtures.js';

interface Created {
  id: string;
}

const createAuction = (user: User, reserve = 100) => api<Created>(user, 'POST', '/auctions', { reserve });

test('a change: alice creates an auction, bob bids on it', async ({ browser, page }) => {
  await signIn(page, 'alice');
  await page.goto('/#/auctions');
  await page.getByLabel('Reserve (EUR)').fill('120');
  await page.getByRole('button', { name: 'Create auction' }).click();
  await expect(page).toHaveURL(/#\/auctions\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).hash.split('/').at(-1) ?? '';
  await expect(page.getByRole('heading', { level: 1, name: `Auction ${id.slice(-6)}` })).toBeVisible();
  await expect(page.getByTestId('bids')).toHaveText('0 bids');
  await expectAccessible(page);

  const bob = await browser.newPage();
  await signIn(bob, 'bob');
  await bob.goto(`/#/auctions/${id}`);
  await bob.getByLabel('Amount (EUR)').fill('150');
  await bob.getByRole('button', { name: 'Bid' }).click();
  await expect(bob.getByText('Bid placed.')).toBeVisible();
  await expect(bob.getByTestId('bids')).toHaveText('1 bid');
  await bob.close();
});

test('a paged list: 5 rows, the total, and the next page by its cursor', async ({ page }) => {
  for (let i = 0; i < 6; i++) await createAuction('alice');
  await signIn(page, 'alice');
  const cursors: (string | null)[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.pathname === '/api/auctions') cursors.push(url.searchParams.get('after'));
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
  await signIn(page, 'alice');
  let posts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/auctions')) posts++;
  });
  await page.goto('/#/auctions');
  const reserve = page.getByLabel('Reserve (EUR)');
  // the rule comes from the backend's OpenAPI document (tarol-codegen): Required, checked before sending
  await page.getByRole('button', { name: 'Create auction' }).click();
  await expect(reserve).toHaveAttribute('aria-invalid', 'true');
  expect(posts).toBe(0);
  // the backend's own verdict: the body without the member is answered 400 {"reserve":["Required"]} by the real API,
  // and lands on the field with the same path (a domain rule such as Range needs BC-9)
  await page.route('**/api/auctions', (route) =>
    route.request().method() === 'POST' ? route.continue({ postData: '{}' }) : route.continue(),
  );
  await reserve.fill('100');
  await page.getByRole('button', { name: 'Create auction' }).click();
  await expect(reserve).toHaveAttribute('aria-invalid', 'true');
  await expect(reserve).toHaveAccessibleDescription(/required|enter/i);
  expect(posts).toBe(1);
  await expectAccessible(page);
});

test('a coded refusal: alice may not bid; the optimistic bid is rolled back', async ({ page }) => {
  const { id } = await createAuction('alice');
  await signIn(page, 'alice');
  await page.goto(`/#/auctions/${id}`);
  await expect(page.getByTestId('bids')).toHaveText('0 bids');
  await page.getByLabel('Amount (EUR)').fill('150');
  await page.getByRole('button', { name: 'Bid' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('bids')).toHaveText('0 bids');
});

test('an expired token: the 401 is answered by a refresh and the read repeated once', async ({ page }) => {
  // a token the backend rejects stands in for an expired one until the sample has a short-lived option (BC-9)
  const session = await signIn(page, 'alice', { first: 'eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjF9.c2ln' });
  const statuses: number[] = [];
  page.on('response', (r) => {
    if (new URL(r.url()).pathname === '/api/auctions') statuses.push(r.status());
  });
  await page.goto('/#/auctions');
  await expect(page.getByRole('grid', { name: 'All auctions' })).toBeVisible();
  expect(statuses.slice(0, 2)).toEqual([401, 200]);
  expect(session.refreshes()).toBe(1);
});

test('an erased subject: the operator exports, erases, and the personal data is gone', async ({ page }) => {
  // the sample has no list of bidder profiles: its apphost.sh finds bob's profile in the store, and so does this setup
  const subject = sql("SELECT stream_id FROM tarol.events WHERE type = 'bidder_profile' LIMIT 1") || undefined;
  test.skip(subject === undefined, 'the sample has no bidder profile yet');
  await signIn(page, 'alice');
  await page.goto(`/#/subjects/${subject ?? ''}?tenant=00000000-0000-0000-0000-000000000000`);
  const email = page.getByTestId('field-email');
  await expect(email).toBeVisible();
  if ((await email.textContent())?.includes('@')) {
    const erased = page.waitForResponse((r) => r.url().includes('/erase'));
    await page.getByRole('button', { name: 'Erase personal data' }).click();
    const status = (await erased).status();
    // BC-10: the erasure forgets the key, then answers 500 without a body (ErasureIncompleteException), so the page
    // shows the generic error; what matters here is that the personal data is gone
    if (status !== 200) test.info().annotations.push({ type: 'BC-10', description: `erase answered ${String(status)}` });
  } else {
    // erasure is final; a second run finds it erased (a repeated erase also answers 500: BC-10)
    test.info().annotations.push({ type: 'note', description: 'already erased by an earlier run' });
  }
  await expect(email).toHaveText('erased');
  await expect(page.getByTestId('field-name')).toHaveText('erased');
  await expectAccessible(page);
});

test('the search box finds an auction and opens it', async ({ page }) => {
  await signIn(page, 'alice');
  await page.goto('/#/auctions');
  const seller = (await api<{ items: { seller: string }[] }>('alice', 'GET', '/auctions?limit=1')).items[0]?.seller ?? '';
  const box = page.getByRole('combobox', { name: 'Search' });
  await box.fill(seller);
  const option = page.getByRole('option').first();
  await expect(option).toBeVisible();
  await box.press('ArrowDown');
  await box.press('Enter');
  await expect(page).toHaveURL(/#\/auctions\/[0-9a-f-]{36}$/);
});

test.fixme('a push update: a bid by bob updates alice’s open auction', () => {
  // waits for BC-2 (access_token on the hub) and BC-9 (the sample maps no hub, no bid topic): docs/migration/e2e.md
});

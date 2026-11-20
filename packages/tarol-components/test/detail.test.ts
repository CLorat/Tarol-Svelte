import type { ChangeRequest, ReadOptions, Result, TarolClient } from '@clorat/tarol-client';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@clorat/tarol-design/tokens.css';
import { expectAccessible } from './axe.js';
import Detail from './fixtures/Detail.svelte';

let app: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  document.body.innerHTML = '';
});

const ok = <T>(value: T, version?: number): Result<T> => ({
  ok: true,
  value,
  status: 200,
  replayed: false,
  stale: false,
  notModified: false,
  ...(version === undefined ? {} : { version }),
});

function detailClient() {
  const server = { highest: 100, version: 1 };
  const searches: { q: unknown; types: unknown; snippets: unknown; aborted: () => boolean }[] = [];
  let answer: (r: ChangeRequest) => Promise<Result<unknown>> = () => Promise.resolve(ok(undefined));
  const listeners = new Set<() => void>();
  const client: TarolClient = {
    read<T>(path: string, o?: ReadOptions) {
      if (path === '/search') {
        const q = String(o?.query?.['q'] ?? '');
        const snippets = o?.query?.['snippets'];
        searches.push({ q, types: o?.query?.['types'], snippets, aborted: () => o?.signal?.aborted ?? false });
        // the snippet is plain text, highlights are UTF-16 ranges (the sunflower is 2 code units)
        const snippet = '🌻 <script>alert(1)</script> Irises by <b>Vincent</b>';
        const items = [
          {
            type: 'Auction',
            id: '1',
            aggregate: 'a1',
            title: '<img src=x onerror=alert(1)> Irises',
            score: 2,
            ...(snippets === true
              ? {
                  snippet,
                  highlights: [
                    { start: snippet.indexOf('<script>'), length: '<script>'.length },
                    { start: snippet.indexOf('Irises'), length: 6 },
                    { start: 999, length: 3 }, // out of range: ignored
                  ],
                }
              : {}),
          },
          { type: 'Bid', id: '2', aggregate: 'a1', title: `Bid on ${q}`, score: 1 },
        ];
        return Promise.resolve(ok({ items, next: null }) as Result<T>);
      }
      return Promise.resolve(ok({ id: 'a', title: 'Irises', highest: server.highest }, server.version) as Result<T>);
    },
    change<T>(r: ChangeRequest) {
      return answer(r).then((x) => {
        if (x.ok) for (const l of listeners) l();
        return x as Result<T>;
      });
    },
    url: (p) => p,
    invalidate: () => undefined,
    onChange: (l) => {
      const f = () => {
        l({ method: 'POST', path: '/auctions/a/bids' });
      };
      listeners.add(f);
      return () => listeners.delete(f);
    },
    position: null,
  };
  return {
    client,
    server,
    searches,
    answerWith(f: (r: ChangeRequest) => Promise<Result<unknown>>) {
      answer = f;
    },
  };
}

function render(client: TarolClient): void {
  app = mount(Detail, { target: document.body, props: { client } });
  flushSync();
}

describe('DetailLayout', () => {
  it('shows the heading, facts, actions and aside of the loaded view, and passes axe', async () => {
    const d = detailClient();
    render(d.client);
    await expect.element(page.getByRole('heading', { level: 1, name: 'Irises' })).toBeInTheDocument();
    await expect.element(page.getByTestId('highest')).toHaveTextContent('100');
    await expect.element(page.getByRole('complementary')).toHaveTextContent('History');
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Settle' }).click();
    await expect.element(page.getByTestId('action')).toHaveTextContent('settle');
    await expectAccessible();
  });
});

describe('optimistic bid in the detail layout', () => {
  it('shows the bid at once and keeps it when the backend accepts', async () => {
    const d = detailClient();
    render(d.client);
    await expect.element(page.getByTestId('highest')).toHaveTextContent('100');
    let accept!: () => void;
    d.answerWith(
      () =>
        new Promise((res) => {
          accept = () => {
            d.server.highest = 150;
            d.server.version = 2;
            res(ok(undefined));
          };
        }),
    );
    await page.getByRole('button', { name: 'Bid' }).click();
    await expect.element(page.getByTestId('highest')).toHaveTextContent('150'); // before the answer
    accept();
    await expect.element(page.getByTestId('highest')).toHaveTextContent('150');
  });

  it('rolls the bid back on 409 and shows the conflict', async () => {
    const d = detailClient();
    render(d.client);
    await expect.element(page.getByTestId('highest')).toHaveTextContent('100');
    let refuse!: () => void;
    d.answerWith(
      () =>
        new Promise((res) => {
          refuse = () => {
            res({ ok: false, status: 409, violation: { kind: 'error', code: 'Stream.VersionConflict' } });
          };
        }),
    );
    await page.getByRole('button', { name: 'Bid' }).click();
    await expect.element(page.getByTestId('highest')).toHaveTextContent('150');
    refuse();
    await expect.element(page.getByTestId('highest')).toHaveTextContent('100');
    await expect.element(page.getByRole('alert')).toBeVisible();
    await expectAccessible();
  });
});

describe('SearchBox', () => {
  it('asks the server from the second character, lists titles as text, and opens the chosen hit', async () => {
    const d = detailClient();
    render(d.client);
    const box = page.getByRole('combobox', { name: 'Search' });
    await userEvent.click(box);
    await userEvent.keyboard('i');
    expect(d.searches).toHaveLength(0);
    await userEvent.keyboard('r');
    await expect.poll(() => d.searches.map((s) => s.q)).toEqual(['ir']);
    const first = page.getByRole('option').first();
    await expect
      .element(first)
      .toHaveTextContent('<img src=x onerror=alert(1)> Irises 🌻 <script>alert(1)</script> Irises by <b>Vincent</b>');
    expect(document.querySelector('[role=listbox] img')).toBeNull(); // server text is never markup
    await expectAccessible();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect.element(page.getByTestId('opened')).toHaveTextContent('Auction:a1');
  });

  it('shows the snippet as text with the highlights marked, never as markup', async () => {
    const d = detailClient();
    render(d.client);
    await userEvent.click(page.getByRole('combobox', { name: 'Search' }));
    await userEvent.keyboard('ir');
    await expect.poll(() => d.searches.map((s) => s.snippets)).toEqual([true]);
    const first = page.getByRole('option').first();
    await expect
      .element(first)
      .toHaveTextContent('<img src=x onerror=alert(1)> Irises 🌻 <script>alert(1)</script> Irises by <b>Vincent</b>');
    const option = document.querySelector('[role=option]');
    expect(option?.querySelector('script, b, img')).toBeNull();
    expect([...(option?.querySelectorAll('mark') ?? [])].map((m) => m.textContent)).toEqual(['<script>', 'Irises']);
    await expectAccessible();
  });

  it('aborts the previous request when the text changes', async () => {
    const d = detailClient();
    render(d.client);
    const box = page.getByRole('combobox', { name: 'Search' });
    await userEvent.click(box);
    await userEvent.keyboard('ir');
    await expect.poll(() => d.searches.length).toBe(1);
    await userEvent.keyboard('i');
    await expect.poll(() => d.searches.map((s) => s.q)).toEqual(['ir', 'iri']);
    expect(d.searches[0]?.aborted()).toBe(true);
    expect(d.searches[1]?.aborted()).toBe(false);
    await expect.element(page.getByRole('option', { name: 'Bid on iri' })).toBeInTheDocument();
  });
});

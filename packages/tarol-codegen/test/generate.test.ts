import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { generate, GenerateError, type OpenApiDocument, type Schema } from '../src/generate.js';

const fixture = JSON.parse(
  readFileSync(new URL('fixtures/artflow.openapi.json', import.meta.url), 'utf8'),
) as OpenApiDocument;

/** Type-checks files with the repository's strict settings; returns the diagnostics as text. */
function typecheck(files: Record<string, string>): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'tarol-codegen-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  const program = ts.createProgram(
    Object.keys(files).map((f) => join(dir, f)),
    {
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
      types: [],
      paths: {
        '@clorat/tarol-client': [new URL('../../tarol-client/dist/index.d.ts', import.meta.url).pathname],
        '@clorat/tarol-client/push': [new URL('../../tarol-client/dist/push.d.ts', import.meta.url).pathname],
        '@clorat/tarol-svelte': [new URL('../../tarol-svelte/dist/index.d.ts', import.meta.url).pathname],
      },
    },
  );
  return ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

const doc = (schemas: Record<string, Schema>, paths: OpenApiDocument['paths'] = {}): OpenApiDocument => ({
  openapi: '3.1.0',
  paths,
  components: { schemas },
});
const post = (operationId: string, body: string, created = false) => ({
  post: {
    operationId,
    'x-tarol-kind': created ? 'creation' : 'change',
    requestBody: { content: { 'application/json': { schema: { $ref: `#/components/schemas/${body}` } } } },
    responses: created
      ? {
          '201': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'string', format: 'uuid', 'x-tarol-id': 'Order' } },
                },
              },
            },
          },
        }
      : { '204': {} },
  },
});

describe('the sample (samples/Sagas /openapi/v1.json)', () => {
  const code = generate(fixture, { source: 'artflow.openapi.json' });

  it('matches the reviewed snapshot', async () => {
    await expect(code).toMatchFileSnapshot('__snapshots__/artflow.ts');
  });

  it('names the stream of a view by id (its x-tarol-id path parameter) as the request subject, and only there', () => {
    expect(code).toContain('({ path: `/auctions/${enc(auction)}`, subject: auction, stream: "Auction" })');
    expect(code.match(/, subject: \w+, stream: "\w+" }\)/g)).toHaveLength(1);
  });

  it('types the UI push topics of x-tarol-topics, with their stream and payload (BC-25)', () => {
    expect(code).toContain("import type { Topic } from '@clorat/tarol-client/push';");
    expect(code).toContain(
      'bidPlaced: { topic: "artflow.bid-placed", stream: "Auction" } as Topic<BidPlacedV1, "Auction">,',
    );
    expect(code).toContain('/** artflow.bid-placed (version 1, about a Auction, subscribable) */');
  });

  it('compiles with strict settings, and its builders fit the Svelte runes', () => {
    const usage = `
import { asId, createClient, type ClientCode } from '@clorat/tarol-client';
import { changeForm, list, live, query } from '@clorat/tarol-svelte';
import { errors, requests, rules, tarol, topics, type PlaceBidCode } from './artflow.js';

const api = tarol(createClient({ baseUrl: '/api' }));
export async function run(): Promise<void> {
  const created = await api.changes.createAuction({ reserve: 100 });
  if (!created.ok) return;
  // the 201 id carries no x-tarol-id yet (BC-19): brand it once
  const auction = asId<'Auction'>(created.value.id);
  const bid = await api.changes.placeBid({ auction, amount: 150 }, { expectedVersion: created.value.version });
  if (!bid.ok && bid.violation.kind === 'error') {
    const code: PlaceBidCode | ClientCode = bid.violation.code;
    void code;
    // @ts-expect-error not a code of PlaceBid
    void (bid.violation.code === 'Auction.NotSeller');
  }
  const listed: readonly string[] = errors.placeBid;
  void listed;
  // @ts-expect-error a plain string is not an auction's id
  await api.changes.settleAuction({ auction: created.value.id });
  await api.changes.settleAuction({ auction }); // a change whose body schema is empty
  const page = await api.queries.auctionSearch({ sort: 'HighestBid', limit: 20 });
  if (page.ok) for (const a of page.value.items) a.highestBid.toFixed(2);
  // @ts-expect-error amount is required
  await api.changes.placeBid({ auction: 'x' });
  // @ts-expect-error not a sort of the backend
  await api.queries.auctionSearch({ sort: 'Price' });
  // @ts-expect-error offset is not offered: keyset paging only
  await api.queries.auctionSearch({ offset: 10 });
}
export function screen(): void {
  list(() => requests.auctionSearch({ settled: false }));
  query(() => requests.auctionView({ auction: asId<'Auction'>('01a1fa49-3098-785c-817a-9f7832ceea0e') }));
  changeForm(requests.createAuction, { reserve: 0 }, { rules: rules.createAuction });
  list(() => requests.auctionSearch({}), { live: topics.bidPlaced });
  const bids = live(() => topics.bidPlaced);
  bids.message?.data.amount.toFixed(2); // the payload is typed
  // @ts-expect-error not a member of BidPlacedV1
  void bids.message?.data.bidder;
  // @ts-expect-error not a topic of the backend
  void topics.bidPlacd;
}
`;
    expect(typecheck({ 'artflow.ts': code, 'usage.ts': usage })).toEqual([]);
  });

  it('leaves the server-to-server webhook out and finds every client entry', () => {
    expect(code).not.toContain('webhook');
    for (const name of ['auctionSearch', 'auctionView', 'createAuction', 'myAuctions', 'placeBid', 'settleAuction'])
      expect(code).toContain(`  ${name}: (`);
  });
});

describe('schema constructs', () => {
  const schemas: Record<string, Schema> = {
    Line: {
      type: 'object',
      required: ['sku', 'quantity'],
      properties: {
        sku: { type: 'string', minLength: 1 },
        quantity: { type: ['integer', 'string'], pattern: '^-?(?:0|[1-9]\\d*)$', minimum: '1', maximum: '100' },
      },
    },
    PlaceOrder: {
      type: 'object',
      required: ['customer', 'lines'],
      properties: {
        customer: { type: 'string', minLength: 3, maxLength: 80 },
        email: { type: ['null', 'string'], format: 'email' },
        zip: { type: 'string', pattern: '^\\d{5}$' },
        atomic: { type: 'string', pattern: '(?>a)b' },
        lines: { type: 'array', items: { $ref: '#/components/schemas/Line' }, minItems: 1, maxItems: 50 },
        status: { enum: ['Open', 'Closed'] },
        tags: { type: 'object', additionalProperties: { type: 'string' } },
        payment: { oneOf: [{ $ref: '#/components/schemas/Card' }, { $ref: '#/components/schemas/Invoice' }] },
        owner: { type: 'string', format: 'uuid', 'x-tarol-id': 'Customer' },
      },
    },
    Card: { type: 'object', properties: { number: { type: 'string' } } },
    Invoice: {
      allOf: [
        { $ref: '#/components/schemas/Card' },
        { type: 'object', properties: { due: { type: 'string', format: 'date-time' } } },
      ],
    },
  };
  const code = generate(doc(schemas, { '/orders': post('PlaceOrder', 'PlaceOrder', true) }));

  it('translates types exactly', () => {
    expect(code).toContain('  email?: string | null;');
    expect(code).toContain('  lines: Line[];');
    expect(code).toContain('  status?: "Open" | "Closed";');
    expect(code).toContain('  tags?: Record<string, string>;');
    expect(code).toContain('  payment?: Card | Invoice;');
    expect(code).toContain('export type Invoice = Card & {');
    expect(code).toContain('  quantity: number;');
  });

  it('brands ids named by x-tarol-id and types the created id', () => {
    expect(code).toContain("export type CustomerId = Id<'Customer'>;");
    expect(code).toContain('  owner?: CustomerId;');
    expect(code).toContain('Promise<Result<Created<OrderId>>>');
  });

  it('derives rules with the backend codes per field path, nested lines included', () => {
    const r = /export const rules = (\{[\s\S]*?\}) as const;/.exec(code)?.[1] ?? '';
    expect(r).toContain(
      '"customer": [{"rule":"Required","code":"Required"}, {"rule":"Length","code":"Length","min":3,"max":80}]',
    );
    expect(r).toContain('"email": [{"rule":"Email","code":"Email"}]');
    expect(r).toContain('"zip": [{"rule":"Pattern","code":"Pattern","pattern":"^\\\\d{5}$"}]');
    expect(r).not.toContain('atomic'); // a .NET-only pattern (atomic group) is not an ECMAScript pattern: left to the server
    expect(r).toContain(
      '"lines": [{"rule":"Required","code":"Required"}, {"rule":"Count","code":"Count","min":1,"max":50}]',
    );
    expect(r).toContain(
      '"lines[].sku": [{"rule":"Required","code":"Required"}, {"rule":"NotEmpty","code":"Required"}]',
    );
    expect(r).toContain(
      '"lines[].quantity": [{"rule":"Required","code":"Required"}, {"rule":"Range","code":"Range","min":1,"max":100}]',
    );
  });

  it('prefers x-tarol-rules over the JSON Schema keywords', () => {
    const c = generate(
      doc(
        {
          In: {
            type: 'object',
            properties: {
              iban: {
                type: 'string',
                minLength: 1,
                'x-tarol-rules': [{ rule: 'Pattern', code: 'Iban', pattern: '^[A-Z]{2}' }],
              },
            },
          },
        },
        { '/x': post('Pay', 'In') },
      ),
    );
    expect(c).toContain('"iban": [{"rule":"Pattern","code":"Iban","pattern":"^[A-Z]{2}"}]');
  });

  it('compiles', () => {
    expect(typecheck({ 'api.ts': code })).toEqual([]);
  });
});

describe('errors instead of any', () => {
  const fails = (d: OpenApiDocument, pointer: string) => {
    expect(() => generate(d)).toThrow(GenerateError);
    try {
      generate(d);
    } catch (e) {
      expect((e as GenerateError).pointer).toBe(pointer);
    }
  };

  it('rejects OpenAPI 3.0, unresolved refs, unknown types, arrays without items and missing operation ids', () => {
    fails({ openapi: '3.0.3' }, '#/openapi');
    fails(
      doc({ A: { type: 'object', properties: { b: { $ref: '#/components/schemas/Nope' } } } }),
      '#/components/schemas/A/properties/b',
    );
    fails(
      doc({ A: { type: 'object', properties: { b: { type: ['string', 'boolean'] } } } }),
      '#/components/schemas/A/properties/b',
    );
    fails(doc({ A: { type: 'object', properties: { b: { type: 'array' } } } }), '#/components/schemas/A/properties/b');
    fails(doc({}, { '/x': { get: { responses: {}, 'x-tarol-kind': 'view' } } }), '#/paths/~1x/get');
  });

  it('rejects a path parameter that collides with a body member, and an unknown x-tarol-kind', () => {
    const body = { A: { type: 'object', properties: { id: { type: 'string' } } } } satisfies Record<string, Schema>;
    const op = post('Rename', 'A');
    fails(
      doc(body, {
        '/x/{id}': {
          post: { ...op.post, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
        },
      }),
      '#/paths/~1x~1{id}/post',
    );
    fails(doc(body, { '/x': { post: { ...op.post, 'x-tarol-kind': 'other' } } }), '#/paths/~1x/post/x-tarol-kind');
  });
});

describe('Tarol extensions', () => {
  const problem = {
    content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/TarolProblem' } } },
  };
  const schemas: Record<string, Schema> = {
    TarolProblem: { type: 'object', required: ['type', 'status', 'title'], properties: { code: { type: 'string' } } },
    Signup: {
      type: 'object',
      required: ['email', 'name'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          'x-tarol-rules': [{ rule: 'Email', code: 'Email' }],
          'x-tarol-email':
            'one @ with 1 to 64 characters before it; a domain of at most 253 characters that contains a dot, does not start or end with one and has no empty label; no white space; at most 254 characters',
        },
        name: {
          type: 'string',
          minLength: 3,
          'x-tarol-rules': [{ rule: 'Pattern', code: 'Pattern', pattern: '^\\p{L}+$', flags: 'iu' }],
        },
      },
    },
    Erasure: { type: 'object', required: ['streams'], properties: { streams: { type: 'integer' } } },
  };
  const paths: OpenApiDocument['paths'] = {
    '/signups': {
      post: {
        ...post('Signup', 'Signup').post,
        'x-tarol-errors': ['Signup.Taken', 'Auth.Forbidden'],
        responses: { '204': {}, '409': problem },
      },
    },
    '/me': {
      get: {
        operationId: 'Me',
        'x-tarol-kind': 'me',
        responses: {
          '200': {
            content: {
              'application/json': { schema: { type: 'object', properties: { subject: { type: 'string' } } } },
            },
          },
        },
      },
    },
    '/admin/subjects/{id}/erase': {
      post: {
        operationId: 'AdminErase',
        'x-tarol-kind': 'admin',
        'x-tarol-errors': ['Admin.Tenant', 'DataProtection.ErasureIncomplete'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'tenant', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Erasure' } } } } },
      },
    },
    '/admin/subjects/{id}/export': {
      get: {
        operationId: 'AdminExport',
        'x-tarol-kind': 'admin',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'tenant', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': {} },
      },
    },
    '/admin/dead/{kind}/{id}': {
      delete: {
        operationId: 'AdminDiscard',
        'x-tarol-kind': 'admin',
        parameters: [
          { name: 'kind', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', format: 'int64' } },
        ],
        responses: { '204': {} },
      },
    },
  };
  const code = generate(doc(schemas, paths));

  it('types the error codes of each operation from x-tarol-errors', () => {
    expect(code).toContain(`export type SignupCode = "Signup.Taken" | "Auth.Forbidden";`);
    expect(code).toContain('Promise<Result<undefined, SignupCode>>');
    expect(code).toContain(`signup: ["Signup.Taken", "Auth.Forbidden"],`);
  });

  it('generates admin and me operations by their kind, with required query values and untyped answers only where the document has none', () => {
    expect(code).toContain(
      'adminErase: (input: AdminEraseInput, options?: ChangeOptions): Promise<Result<Erasure, AdminEraseCode>>',
    );
    expect(code).toContain('export type AdminEraseInput = { readonly id: string } & { readonly tenant: string };');
    expect(code).toMatch(
      /adminExport: \(p: \{ readonly id: string \}, query: AdminExportQuery\): Promise<Result<unknown>>/,
    );
    expect(code).toContain('  readonly tenant: string;');
    expect(code).toContain(
      'adminDiscard: (input: AdminDiscardInput, options?: ChangeOptions): Promise<Result<undefined>>',
    );
    expect(code).toContain('me: (): Promise<Result<{');
  });

  it('keeps Required next to x-tarol-rules, passes flags, and checks the e-mail semantics', () => {
    const r = /export const rules = (\{[\s\S]*?\}) as const;/.exec(code)?.[1] ?? '';
    expect(r).toContain('"email": [{"rule":"Required","code":"Required"}, {"rule":"Email","code":"Email"}]');
    expect(r).toContain(
      '"name": [{"rule":"Required","code":"Required"}, {"rule":"Pattern","code":"Pattern","pattern":"^\\\\p{L}+$","flags":"iu"}]',
    );
    const changed = structuredClone(schemas);
    const email = changed['Signup']?.properties?.['email'] as Record<string, unknown>;
    email['x-tarol-email'] = 'any text with an @';
    expect(() => generate(doc(changed, paths))).toThrow(/x-tarol-email/);
  });

  it('names topics by their name after the system, and by the whole name when two systems share it', () => {
    const t = generate({
      ...doc({}),
      'x-tarol-topics': {
        'artflow.note-added': { publish: true },
        'billing.note-added': { subscribe: true },
        'artflow.chat': {},
      },
    });
    expect(t).toContain('chat: { topic: "artflow.chat" } as Topic<unknown>,');
    expect(t).toContain('artflowNoteAdded: { topic: "artflow.note-added" } as Topic<unknown>,');
    expect(t).toContain('billingNoteAdded: { topic: "billing.note-added" } as Topic<unknown>,');
    expect(t).toContain('/** artflow.note-added (publishable) */');
    expect(generate(doc({}))).not.toContain('Topic');
  });

  it('imports only the client types it uses (no list and no creation here: no Page, no Created)', () => {
    expect(code).toMatch(/^import type \{ ChangeOptions, ChangeRequest, QueryValue, Result, TarolClient \} from/m);
  });

  it('leaves TarolProblem to the client (its Violation) and requires x-tarol-kind', () => {
    expect(code).not.toContain('TarolProblem');
    const untyped: Record<string, unknown> = { ...post('Pay', 'Signup').post };
    delete untyped['x-tarol-kind'];
    expect(() => generate(doc(schemas, { '/pay': { post: untyped } }))).toThrow(/x-tarol-kind is required/);
  });

  it('compiles', () => {
    expect(typecheck({ 'api.ts': code })).toEqual([]);
  });
});

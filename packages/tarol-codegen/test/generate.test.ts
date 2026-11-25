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

  it('leaves TarolProblem to the client (its Violation)', () => {
    expect(code).not.toContain('TarolProblem');
  });

  it('skips an operation without x-tarol-kind with a warning, or refuses it with strict (TS-3)', () => {
    const plain: Record<string, unknown> = { ...post('Pay', 'Signup').post };
    delete plain['x-tarol-kind'];
    delete plain['operationId']; // a plain ASP.NET endpoint often has neither
    const warnings: string[] = [];
    const out = generate(doc(schemas, { ...paths, '/konto/registrierung': { post: plain } }), {
      onWarning: (m) => warnings.push(m),
    });
    expect(warnings).toEqual(['#/paths/~1konto~1registrierung/post: skipped, no x-tarol-kind (not a Tarol entry)']);
    expect(out).toContain('// Not Tarol entries (no x-tarol-kind), not generated: POST /konto/registrierung.');
    expect(out.replace(/^\/\/ Not Tarol entries.*\n/m, '')).toBe(code);
    expect(() =>
      generate(doc(schemas, { '/pay': { post: { ...plain, operationId: 'Pay' } } }), { strict: true }),
    ).toThrow(/x-tarol-kind is required/);
  });

  it('compiles', () => {
    expect(typecheck({ 'api.ts': code })).toEqual([]);
  });
});

describe('a view of a per-tenant aggregate (TS-8, Tarol-Net TN-2)', () => {
  const schemas: Record<string, Schema> = {
    HouseView: {
      type: 'object',
      required: ['id', 'name'],
      properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' } },
    },
  };
  // the document Tarol-Net writes for GET /house over a [PerTenant] House: no path parameter, x-tarol-kind view
  const house = doc(schemas, {
    '/house': {
      get: {
        operationId: 'HouseView',
        'x-tarol-kind': 'view',
        'x-tarol-errors': ['Auth.Forbidden', 'House.NotFound'],
        responses: {
          '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/HouseView' } } } },
        },
      },
    },
  });
  const code = generate(house);

  it('is a read without an id: requests.houseView() and api.houseView()', () => {
    expect(code).toContain('houseView: (): ReadRequest => ({ path: `/house` }),');
    expect(code).toContain('houseView: (): Promise<Result<HouseView, HouseViewCode>> => {');
    expect(code).not.toContain('asId');
  });

  it('compiles', () => {
    expect(typecheck({ 'api.ts': code })).toEqual([]);
  });
});

describe('one projection row (TS-39, Tarol-Net TN-54)', () => {
  const schemas: Record<string, Schema> = {
    HouseRow: {
      type: 'object',
      required: ['id', 'name', 'renames'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        renames: { type: 'integer', format: 'int32' },
      },
    },
  };
  // the document Tarol-Net writes for an IRowQuery<HouseRow>: x-tarol-kind row, a Tarol-Read-After header
  const rows = doc(schemas, {
    '/house/row': {
      get: {
        operationId: 'TenantHouseRow',
        'x-tarol-kind': 'row',
        'x-tarol-errors': ['Auth.Forbidden', 'House.NotFound', 'Projection.Building'],
        parameters: [{ name: 'Tarol-Read-After', in: 'header', schema: { type: 'string' } }],
        responses: {
          '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/HouseRow' } } } },
        },
      },
    },
  });
  const code = generate(rows);

  it('is a read of the row, like a view', () => {
    expect(code).toContain('tenantHouseRow: (): ReadRequest => ({ path: `/house/row` }),');
    expect(code).toContain('tenantHouseRow: (): Promise<Result<HouseRow, TenantHouseRowCode>> => {');
  });

  it('compiles', () => {
    expect(typecheck({ 'api.ts': code })).toEqual([]);
  });
});

describe('nullable schemas (TS-9, Tatalu FB-3, FB-F01.1-4, FB-F17.3-3, FB-F02.1-5, FB-F13.3-5)', () => {
  const nul: Schema = { type: 'null' };
  const schemas: Record<string, Schema> = {
    PersonName: { type: 'string', minLength: 1, maxLength: 80 },
    Gender: { enum: ['Female', 'Male', 'Diverse'] },
    PostalAddress: {
      type: 'object',
      required: ['street', 'city'],
      properties: { street: { type: 'string', minLength: 1 }, city: { type: 'string' } },
    },
    // Option<PostalAddress> as Tarol-Net writes it today: a type array with "null" and the record's members
    OptionOfPostalAddress: {
      type: ['null', 'object'],
      required: ['street', 'city'],
      properties: { street: { type: 'string' }, city: { type: 'string' } },
    },
    ChildView: {
      type: 'object',
      required: ['name', 'gender', 'address', 'status', 'previous', 'second', 'count'],
      properties: {
        name: { oneOf: [nul, { $ref: '#/components/schemas/PersonName' }] },
        gender: { oneOf: [nul, { $ref: '#/components/schemas/Gender' }] },
        address: { anyOf: [{ $ref: '#/components/schemas/PostalAddress' }, nul] },
        status: { oneOf: [nul, { enum: ['Open', 'Closed'] }] },
        previous: { $ref: '#/components/schemas/OptionOfPostalAddress' },
        second: { type: ['string', 'null'], enum: ['A', 'B'] },
        count: { oneOf: [nul, { type: 'integer' }] },
        inline: {
          type: ['null', 'object'],
          properties: { at: { type: 'string', format: 'date-time' } },
        },
      },
    },
    RegisterChild: {
      type: 'object',
      required: ['name', 'address'],
      properties: {
        name: { oneOf: [nul, { $ref: '#/components/schemas/PersonName' }] },
        address: { oneOf: [nul, { $ref: '#/components/schemas/PostalAddress' }] },
        moved: { $ref: '#/components/schemas/OptionOfPostalAddress' },
      },
    },
  };
  const view = {
    get: {
      operationId: 'ChildView',
      'x-tarol-kind': 'view',
      responses: {
        '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/ChildView' } } } },
      },
    },
  };
  const code = generate(doc(schemas, { '/children/x': view, '/children': post('RegisterChild', 'RegisterChild') }));

  it('types oneOf/anyOf of null and one schema as T | null, for value types, enums, records and primitives', () => {
    expect(code).toContain('  name: PersonName | null;');
    expect(code).toContain('  gender: Gender | null;');
    expect(code).toContain('  address: PostalAddress | null;');
    expect(code).toContain('  status: "Open" | "Closed" | null;');
    expect(code).toContain('  count: number | null;');
  });

  it('types a type array with "null" as T | null, also for an object with properties (Option<Record>)', () => {
    expect(code).toMatch(/export type OptionOfPostalAddress = \{\n {2}street: string;\n {2}city: string;\n\} \| null;/);
    expect(code).toContain('  previous: OptionOfPostalAddress;');
    expect(code).toContain('  second: "A" | "B" | null;');
    expect(code).toMatch(/ {2}inline\?: \{\n\s+at\?: string;\n\} \| null;/);
  });

  it('gives a nullable member no Required rule, and keeps the rules of its value type and of a nullable record', () => {
    const r = /export const rules = (\{[\s\S]*?\}) as const;/.exec(code)?.[1] ?? '';
    expect(r).toContain('"name": [{"rule":"Length","code":"Length","min":1,"max":80}]');
    expect(r).not.toContain('"address": [');
    expect(r).toContain(
      '"address.street": [{"rule":"Required","code":"Required"}, {"rule":"NotEmpty","code":"Required"}]',
    );
    expect(r).not.toContain('"moved": [');
  });

  it('compiles, and null is accepted where the backend sends or accepts it', () => {
    const usage = `
import { tarol, type ChildView, type RegisterChildInput } from './api.js';
import { createClient } from '@clorat/tarol-client';
export const input: RegisterChildInput = { name: null, address: null, moved: null };
export function show(v: ChildView): string {
  return (v.name ?? '-') + (v.gender ?? '') + (v.address?.city ?? '') + (v.previous?.street ?? '');
}
void tarol(createClient({ baseUrl: '/api' })).changes.registerChild(input);
`;
    expect(typecheck({ 'api.ts': code, 'usage.ts': usage })).toEqual([]);
  });
});

describe('x-tarol-types and x-tarol-constants (TS-10, Tatalu FB-F02.6-2, FB-F13.5-1)', () => {
  const schemas: Record<string, Schema> = {
    MeaslesStatus: { type: 'string', enum: ['NotRequired', 'Missing', 'Sufficient', 'FollowUpDue', 'Expired'] },
  };
  const withExtras = (extra: Record<string, unknown>): OpenApiDocument => ({ ...doc(schemas), ...extra });

  it('exports a type no operation references when x-tarol-types names it, and refuses a name that is no schema', () => {
    const code = generate(withExtras({ 'x-tarol-types': ['MeaslesStatus'] }));
    expect(code).toContain(
      'export type MeaslesStatus = "NotRequired" | "Missing" | "Sufficient" | "FollowUpDue" | "Expired";',
    );
    expect(() => generate(withExtras({ 'x-tarol-types': ['Measles'] }))).toThrow(
      '#/x-tarol-types/0: Measles is not in components.schemas',
    );
    expect(() => generate(withExtras({ 'x-tarol-types': 'MeaslesStatus' }))).toThrow(
      '#/x-tarol-types: not a list of schema names',
    );
  });

  it('writes x-tarol-constants as exported literals, sorted by name', () => {
    const code = generate(
      withExtras({
        'x-tarol-constants': {
          ProcessingAgreementVersion: '2026-03',
          MaxChildren: 12,
          Strict: true,
          Weekdays: ['Mon', 'Tue'],
        },
      }),
    );
    expect(code).toContain(
      [
        '/** Backend constants (x-tarol-constants). */',
        'export const MaxChildren = 12 as const;',
        'export const ProcessingAgreementVersion = "2026-03" as const;',
        'export const Strict = true as const;',
        'export const Weekdays = ["Mon", "Tue"] as const;',
      ].join('\n'),
    );
    expect(
      typecheck({
        'api.ts': code,
        'usage.ts':
          "import { ProcessingAgreementVersion } from './api.js';\nexport const v: '2026-03' = ProcessingAgreementVersion;\n",
      }),
    ).toEqual([]);
  });

  it('refuses a constant that is no identifier or no JSON literal', () => {
    expect(() => generate(withExtras({ 'x-tarol-constants': { 'max-children': 1 } }))).toThrow(
      '#/x-tarol-constants/max-children: not a PascalCase identifier',
    );
    expect(() => generate(withExtras({ 'x-tarol-constants': { Limits: { a: 1 } } }))).toThrow(
      '#/x-tarol-constants/Limits: not a string, number, boolean or a list of them',
    );
    expect(() => generate(withExtras({ 'x-tarol-constants': { Rate: Number.NaN } }))).toThrow(/Rate/);
  });
});

describe('typed creations (TS-11, Tatalu FB-F02.1-8)', () => {
  const code = generate(fixture, { source: 'artflow.openapi.json' });

  it('types the request of a creation with its result, so changeForm and client.change infer it', () => {
    expect(code).toContain('createAuction: (body: CreateAuctionInput): ChangeRequest<Created> =>');
    const usage = `
import { createClient, type Created } from '@clorat/tarol-client';
import { changeForm } from '@clorat/tarol-svelte';
import { requests } from './artflow.js';

export async function screen(): Promise<string | undefined> {
  const form = changeForm(requests.createAuction, { reserve: 0 });
  const r = await form.submit();
  const created: Created | undefined = r?.ok ? r.value : undefined;
  const bid = changeForm(requests.placeBid, { auction: created?.id as never, amount: 1 });
  const placed = await bid.submit();
  // a plain change still returns nothing
  const nothing: undefined = placed?.ok ? placed.value : undefined;
  void nothing;
  const direct = await createClient({ baseUrl: '/api' }).change(requests.createAuction({ reserve: 1 }));
  return direct.ok ? direct.value.id : created?.id;
}
`;
    expect(typecheck({ 'artflow.ts': code, 'usage.ts': usage })).toEqual([]);
  });
});

describe('a form over a generated change with nothing chosen yet (TS-21, Tatalu FB-F01.1-11)', () => {
  it('type-checks allowNull(requests.x) with null in a required member, and refuses null without it', () => {
    const code = generate(fixture, { source: 'artflow.openapi.json' });
    const usage = `
import { allowNull, changeForm } from '@clorat/tarol-svelte';
import { requests, rules } from './artflow.js';

export function screen(): void {
  const form = changeForm(allowNull(requests.createAuction), { reserve: null }, { rules: rules.createAuction });
  form.values.reserve = 100;
  // @ts-expect-error without allowNull the input type has no null
  changeForm(requests.createAuction, { reserve: null });
}
`;
    expect(typecheck({ 'artflow.ts': code, 'usage.ts': usage })).toEqual([]);
  });
});

// Round 3: the nullable objects Tatalu flattened in waves 1–3, in the shapes Tarol-Net writes them (a nullable reference
// `T?` and, since TN-31, `Option<T>` of a component as `oneOf [{type: "null"}, {$ref}]` in place; the older component
// `type: ["null", "object"]`), in an input, a view, a list row and an Option<T> of a change.
describe('nullable objects in inputs, views, rows and Option<T> (TS-38 = TS-9; Tatalu FB-F06.6-1, FB-F05.8-2, FB-F06.5-1)', () => {
  const nul: Schema = { type: 'null' };
  const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
  const schemas: Record<string, Schema> = {
    AppointmentDetails: {
      type: 'object',
      required: ['title'],
      properties: { title: { type: 'string', minLength: 1 }, place: { type: ['string', 'null'] } },
    },
    // FB-F06.6-1: `AppointmentDetails? Details` in a row (null = "not shared with you")
    AppointmentRow: {
      type: 'object',
      required: ['id', 'details'],
      properties: { id: { type: 'string', format: 'uuid' }, details: { oneOf: [nul, ref('AppointmentDetails')] } },
    },
    AuthorizationInput: {
      type: 'object',
      required: ['from', 'doctor'],
      properties: { from: { type: 'string', format: 'date' }, doctor: { type: 'string', minLength: 1 } },
    },
    // FB-F05.8-2: `AuthorizationInput?` in an input, `MedicationAuthorization?` in a view
    CreateMedicationOrder: {
      type: 'object',
      required: ['name', 'authorization'],
      properties: {
        name: { type: 'string', minLength: 1 },
        authorization: { oneOf: [nul, ref('AuthorizationInput')] },
      },
    },
    MedicationOrderView: {
      type: 'object',
      required: ['name', 'authorization', 'details'],
      properties: {
        name: { type: 'string' },
        authorization: { anyOf: [nul, ref('AuthorizationInput')] },
        // the older component shape of Option<Record>
        details: { $ref: '#/components/schemas/OptionOfMedicationDetails' },
      },
    },
    OptionOfMedicationDetails: {
      type: ['null', 'object'],
      required: ['dose'],
      properties: { dose: { type: 'string' } },
    },
    ExternalSubstituteInput: {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string', minLength: 1 }, contact: { type: 'string' } },
    },
    // FB-F06.5-1: `Option<ExternalSubstituteInput>` in a change (TN-31: oneOf in place)
    AssignSubstitute: {
      type: 'object',
      required: ['external'],
      properties: { external: { oneOf: [nul, ref('ExternalSubstituteInput')] } },
    },
  };
  const listOp = {
    get: {
      operationId: 'AppointmentSearch',
      'x-tarol-kind': 'list',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: { type: 'array', items: ref('AppointmentRow') },
                  next: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
  };
  const viewOp = {
    get: {
      operationId: 'MedicationOrderView',
      'x-tarol-kind': 'view',
      responses: { '200': { content: { 'application/json': { schema: ref('MedicationOrderView') } } } },
    },
  };
  const code = generate(
    doc(schemas, {
      '/appointments': listOp,
      '/medication-orders/x': viewOp,
      '/medication-orders': post('CreateMedicationOrder', 'CreateMedicationOrder'),
      '/absences/substitute': post('AssignSubstitute', 'AssignSubstitute'),
    }),
  );

  it('generates T | null for each, and no Required rule on the nullable member', () => {
    expect(code).toContain('  details: AppointmentDetails | null;');
    expect(code).toContain('  authorization: AuthorizationInput | null;');
    expect(code).toContain('  details: OptionOfMedicationDetails;');
    expect(code).toMatch(/export type OptionOfMedicationDetails = \{\n {2}dose: string;\n\} \| null;/);
    expect(code).toContain('  external: ExternalSubstituteInput | null;');
    const r = /export const rules = (\{[\s\S]*?\}) as const;/.exec(code)?.[1] ?? '';
    expect(r).not.toContain('"authorization": [');
    expect(r).not.toContain('"external": [');
    expect(r).toContain('"external.name": [');
  });

  it('compiles, and an app can send null and read null without a placeholder', () => {
    const usage = `
import { tarol, type AppointmentRow, type MedicationOrderView } from './api.js';
import { createClient } from '@clorat/tarol-client';
const api = tarol(createClient({ baseUrl: '/api' }));
void api.changes.createMedicationOrder({ name: 'Ibuprofen', authorization: null });
void api.changes.assignSubstitute({ external: null });
export const title = (row: AppointmentRow): string => row.details?.title ?? 'hidden';
export const dose = (v: MedicationOrderView): string => (v.details?.dose ?? '') + (v.authorization?.doctor ?? '');
`;
    expect(typecheck({ 'api.ts': code, 'usage.ts': usage })).toEqual([]);
  });
});

// Owner decision 2026-11-25: a `decimal` stays a JSON number; Tarol-Net TN-53 writes `[Scale(n)]` as `multipleOf: 10^-n`.
describe('multipleOf as the client rule Scale (TS-29, Tatalu FB-F04.5-1)', () => {
  const schemas: Record<string, Schema> = {
    SetFee: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: { type: 'number', minimum: '0', maximum: '10000', multipleOf: 0.01 },
        rate: { type: ['number', 'null'], multipleOf: 0.001 },
      },
    },
  };
  const code = generate(doc(schemas, { '/fees': post('SetFee', 'SetFee') }));

  it('carries multipleOf into the rules with its step, after Range', () => {
    const r = /export const rules = (\{[\s\S]*?\}) as const;/.exec(code)?.[1] ?? '';
    expect(r).toContain(
      '"amount": [{"rule":"Required","code":"Required"}, {"rule":"Range","code":"Range","min":0,"max":10000}, {"rule":"Scale","code":"Scale","step":0.01}]',
    );
    expect(r).toContain('"rate": [{"rule":"Scale","code":"Scale","step":0.001}]');
    expect(code).toContain('  amount: number;');
  });

  it('takes Scale from x-tarol-rules as Tarol-Net e147531 writes it (code Scale, a numeric step)', () => {
    const tarol = generate(
      doc(
        {
          SetPrice: {
            type: 'object',
            properties: {
              price: {
                type: 'number',
                multipleOf: 0.01,
                'x-tarol-rules': [{ rule: 'Scale', code: 'Scale', step: 0.01 }],
              },
            },
          },
        },
        { '/prices': post('SetPrice', 'SetPrice') },
      ),
    );
    expect(tarol).toContain('"price": [{"rule":"Scale","code":"Scale","step":0.01}]');
  });
});

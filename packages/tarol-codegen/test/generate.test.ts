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

  it('compiles with strict settings, and its builders fit the Svelte runes', () => {
    const usage = `
import { createClient } from '@clorat/tarol-client';
import { changeForm, list, query } from '@clorat/tarol-svelte';
import { requests, rules, tarol } from './artflow.js';

const api = tarol(createClient({ baseUrl: '/api' }));
export async function run(): Promise<void> {
  const created = await api.changes.createAuction({ reserve: 100 });
  if (created.ok) await api.changes.placeBid({ auction: created.value.id, amount: 150 }, { expectedVersion: created.value.version });
  if (created.ok) await api.changes.settleAuction({ auction: created.value.id }); // a change whose body schema is empty
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
  query(() => requests.auctionView({ auction: 'x' }));
  changeForm(requests.createAuction, { reserve: 0 }, { rules: rules.createAuction });
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

  it('brands ids named by x-tarol-id (BC-3) and types the created id', () => {
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

  it('prefers x-tarol-rules (BC-4) over the JSON Schema keywords', () => {
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
    fails(doc({}, { '/x': { get: { responses: {} } } }), '#/paths/~1x/get');
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

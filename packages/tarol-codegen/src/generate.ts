/**
 * The OpenAPI subset the generator reads: what Tarol-Net's `AddTarolEndpoints()` emits (OpenAPI 3.1/3.2, JSON Schema
 * 2020-12 types), plus the proposed `x-tarol-*` extensions (docs/backend/changes.md BC-3, BC-4).
 */
export interface OpenApiDocument {
  /** The OpenAPI version; 3.1 or later. */
  readonly openapi: string;
  /** Path → method → operation. */
  readonly paths?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** The reusable schemas. */
  readonly components?: { readonly schemas?: Readonly<Record<string, Schema>> };
}

/** One operation of the document. */
export interface Operation {
  /** The operation name (Tarol: the C# type name); becomes the generated function name. */
  readonly operationId?: string;
  /** Short text, used as the generated doc comment. */
  readonly summary?: string;
  /** Long text, used as the doc comment when there is no summary. */
  readonly description?: string;
  /** Path, query and header parameters. */
  readonly parameters?: readonly Parameter[];
  /** The JSON body of a change. */
  readonly requestBody?: { readonly content?: Readonly<Record<string, { readonly schema?: Schema }>> };
  /** Status → content; the success schemas type the results. */
  readonly responses?: Readonly<
    Record<string, { readonly content?: Readonly<Record<string, { readonly schema?: Schema }>> }>
  >;
  /** BC-3: `creation`, `change`, `view`, `list` or `search`. */
  readonly 'x-tarol-kind'?: string;
}

/** A path, query or header parameter. */
export interface Parameter {
  /** The parameter name. */
  readonly name: string;
  /** `path`, `query` or `header`. */
  readonly in: string;
  /** Whether it must be present. */
  readonly required?: boolean;
  /** Long text, used as the doc comment when there is no summary. */
  readonly description?: string;
  /** Its JSON Schema. */
  readonly schema?: Schema;
}

/** The JSON Schema subset used by the backend. */
export interface Schema {
  /** A reference to `#/components/schemas/<name>`. */
  readonly $ref?: string;
  /** The JSON type, or several (JSON Schema 2020-12). */
  readonly type?: string | readonly string[];
  /** `uuid`, `date-time`, `email`, `int64` … */
  readonly format?: string;
  /** The allowed values. */
  readonly enum?: readonly (string | number | boolean | null)[];
  /** The members of an object. */
  readonly properties?: Readonly<Record<string, Schema>>;
  /** The members that must be present (each gets rule `Required`). */
  readonly required?: readonly string[];
  /** The element schema of an array. */
  readonly items?: Schema;
  /** The value schema of a map. */
  readonly additionalProperties?: Schema | boolean;
  /** Alternatives (a union). */
  readonly oneOf?: readonly Schema[];
  /** Alternatives (a union). */
  readonly anyOf?: readonly Schema[];
  /** Parts (an intersection). */
  readonly allOf?: readonly Schema[];
  /** OpenAPI 3.0 style nullability. */
  readonly nullable?: boolean;
  /** Long text, used as the doc comment when there is no summary. */
  readonly description?: string;
  /** Rule `Length` (or `NotEmpty` when 1 without a maximum). */
  readonly minLength?: number;
  /** Rule `Length`. */
  readonly maxLength?: number;
  /** Rule `Range` (Tarol writes it as a string). */
  readonly minimum?: number | string;
  /** Rule `Range` (Tarol writes it as a string). */
  readonly maximum?: number | string;
  /** Rule `Count`. */
  readonly minItems?: number;
  /** Rule `Count`. */
  readonly maxItems?: number;
  /** Rule `Pattern`, when it is an ECMAScript pattern. */
  readonly pattern?: string;
  /** BC-3: the aggregate an `Id<T>` belongs to, e.g. `Auction`. */
  readonly 'x-tarol-id'?: string;
  /** BC-4: the backend's rules with their codes. */
  readonly 'x-tarol-rules'?: readonly GeneratedRule[];
}

/** A rule as written into the generated file (the shape of `Rule` in `@clorat/tarol-svelte`). */
export interface GeneratedRule {
  /** The rule kind (`Required`, `NotEmpty`, `Range`, `Length`, `Pattern`, `Email`, `Count`). */
  readonly rule: string;
  /** The backend error code. */
  readonly code: string;
  /** Lower bound. */
  readonly min?: number;
  /** Upper bound. */
  readonly max?: number;
  /** Rule `Pattern`, when it is an ECMAScript pattern. */
  readonly pattern?: string;
  /** Extra regular-expression flags. */
  readonly flags?: string;
}

/** Settings of {@link generate}. */
export interface GenerateOptions {
  /** Where the document came from, written into the header comment. */
  readonly source?: string;
}

/** A construct the generator cannot translate exactly; generation stops instead of emitting `any` or `unknown`. */
export class GenerateError extends Error {
  /** The JSON pointer of the construct, e.g. `#/components/schemas/Order/properties/lines`. */
  readonly pointer: string;
  constructor(pointer: string, message: string) {
    super(`${pointer}: ${message}`);
    this.name = 'GenerateError';
    this.pointer = pointer;
  }
}

type Kind = 'creation' | 'change' | 'view' | 'list' | 'search';

interface Op {
  readonly name: string;
  readonly type: string;
  readonly method: string;
  readonly path: string;
  readonly kind: Kind;
  readonly op: Operation;
  readonly pointer: string;
}

const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
const ident = /^[A-Za-z_$][\w$]*$/;
const pascal = (s: string): string =>
  s.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, c: string) => c.toUpperCase());
const camel = (s: string): string => {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};
const key = (name: string): string => (ident.test(name) ? name : JSON.stringify(name));
const pointerPart = (s: string): string => s.replace(/~/g, '~0').replace(/\//g, '~1');

function doc(text: string | undefined, indent = ''): string {
  if (!text) return '';
  const lines = text.trim().replace(/\*\//g, '*\\/').split('\n');
  return lines.length === 1
    ? `${indent}/** ${lines[0] ?? ''} */\n`
    : `${indent}/**\n${lines.map((l) => `${indent} * ${l}`).join('\n')}\n${indent} */\n`;
}

function types(s: Schema): string[] {
  return s.type === undefined ? [] : typeof s.type === 'string' ? [s.type] : [...s.type];
}

/**
 * Generates one TypeScript module from an OpenAPI document of a Tarol backend: the schema types, request builders
 * (`requests`, for the Svelte runes), typed calls (`tarol(client)`), and the validation rules (`rules`).
 */
export function generate(document: OpenApiDocument, options: GenerateOptions = {}): string {
  if (!/^3\.[1-9]/.test(document.openapi))
    throw new GenerateError('#/openapi', `OpenAPI ${document.openapi} is not supported (3.1 or later)`);
  const schemas = document.components?.schemas ?? {};
  const ids = new Set<string>();

  const ref = (r: string, pointer: string): string => {
    const m = /^#\/components\/schemas\/(.+)$/.exec(r);
    if (!m?.[1] || !(m[1] in schemas)) throw new GenerateError(pointer, `unresolved $ref ${r}`);
    return pascal(m[1]);
  };

  /** The TypeScript type of a schema; every construct is either translated exactly or an error. */
  const ts = (s: Schema, pointer: string): string => {
    if (s.$ref) return ref(s.$ref, pointer);
    if (s.oneOf ?? s.anyOf)
      return (s.oneOf ?? s.anyOf ?? [])
        .map((x, i) => ts(x, `${pointer}/${s.oneOf ? 'oneOf' : 'anyOf'}/${String(i)}`))
        .join(' | ');
    if (s.allOf) return s.allOf.map((x, i) => wrap(ts(x, `${pointer}/allOf/${String(i)}`))).join(' & ');
    if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ');
    const t = types(s);
    const nullable = s.nullable === true || t.includes('null');
    const rest = t.filter((x) => x !== 'null');
    let out: string;
    // ASP.NET's Web defaults read numbers from strings too and say so as ["number","string"] + pattern; the backend
    // always writes numbers, and the client always sends numbers.
    if (rest.length === 2 && rest.includes('string') && (rest.includes('number') || rest.includes('integer')))
      out = 'number';
    else if (rest.length > 1) throw new GenerateError(pointer, `type ${JSON.stringify(s.type)} is not supported`);
    else
      switch (rest[0]) {
        case 'string':
          if (s.format === 'uuid' && s['x-tarol-id']) {
            const id = `${pascal(s['x-tarol-id'])}Id`;
            ids.add(s['x-tarol-id']);
            out = id;
          } else out = 'string';
          break;
        case 'number':
        case 'integer':
          out = 'number';
          break;
        case 'boolean':
          out = 'boolean';
          break;
        case 'array':
          if (!s.items) throw new GenerateError(pointer, 'array without items');
          out = `${wrap(ts(s.items, `${pointer}/items`))}[]`;
          break;
        case 'object':
        case undefined:
          if (s.properties) out = objectType(s, pointer, '');
          else if (s.additionalProperties && typeof s.additionalProperties === 'object')
            out = `Record<string, ${ts(s.additionalProperties, `${pointer}/additionalProperties`)}>`;
          else if (rest[0] === 'object') out = 'object';
          else throw new GenerateError(pointer, 'a schema without a type');
          break;
        default:
          throw new GenerateError(pointer, `type ${rest[0]} is not supported`);
      }
    return nullable ? `${out} | null` : out;
  };

  const wrap = (t: string): string => (/[|&]/.test(t) ? `(${t})` : t);

  const objectType = (s: Schema, pointer: string, indent: string): string => {
    const required = new Set(s.required ?? []);
    const props = Object.entries(s.properties ?? {});
    if (props.length === 0) return 'object';
    const lines = props.map(
      ([name, p]) =>
        `${doc(p.description, `${indent}  `)}${indent}  ${key(name)}${required.has(name) ? '' : '?'}: ${ts(p, `${pointer}/properties/${pointerPart(name)}`)};`,
    );
    return `{\n${lines.join('\n')}\n${indent}}`;
  };

  // operations
  const ops: Op[] = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of methods) {
      const op = item[method] as Operation | undefined;
      if (!op) continue;
      const pointer = `#/paths/${pointerPart(path)}/${method}`;
      if (!op.operationId)
        throw new GenerateError(pointer, 'operationId is required (Tarol names it after the C# type)');
      if (path.startsWith('/webhooks/')) continue; // server to server, not a client interface
      ops.push({
        name: camel(op.operationId),
        type: pascal(op.operationId),
        method: method.toUpperCase(),
        path,
        kind: kindOf(op, method, pointer),
        op,
        pointer,
      });
    }
  }
  ops.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const out: string[] = [];
  out.push(
    `// Generated by @clorat/tarol-codegen${options.source ? ` from ${options.source}` : ''}. Do not edit: regenerate.`,
    "import type { ChangeOptions, ChangeRequest, Created, Page, QueryValue, Result, TarolClient%IDS% } from '@clorat/tarol-client';",
    '',
    '/** A read for `query(...)` / `list(...)` of `@clorat/tarol-svelte`, or for `client.read`. */',
    'export interface ReadRequest {',
    '  readonly path: string;',
    '  readonly query?: Readonly<Record<string, QueryValue>>;',
    '}',
    '',
    'const enc = encodeURIComponent;',
    '',
  );

  // schema types
  for (const [name, s] of Object.entries(schemas)) {
    const pointer = `#/components/schemas/${pointerPart(name)}`;
    const t =
      s.properties || (types(s).includes('object') && !s.additionalProperties) ? objectType(s, pointer, '') : null;
    const decl = !t?.startsWith('{')
      ? `export type ${pascal(name)} = ${t ?? ts(s, pointer)};`
      : `export interface ${pascal(name)} ${t}`;
    out.push(doc(s.description) + decl, '');
  }

  // per operation: parameters and input types
  const requests: string[] = [];
  const changes: string[] = [];
  const queries: string[] = [];
  const rules: string[] = [];
  for (const o of ops) {
    const params = o.op.parameters ?? [];
    const pathParams = params.filter((p) => p.in === 'path');
    // offset is left out on purpose: keyset paging only (philosophy P1)
    const queryParams = params.filter((p) => p.in === 'query' && p.name !== 'offset');
    for (const p of pathParams) {
      if (!o.path.includes(`{${p.name}}`))
        throw new GenerateError(`${o.pointer}/parameters`, `path parameter ${p.name} is not in the path`);
      if (!ident.test(p.name))
        throw new GenerateError(`${o.pointer}/parameters`, `path parameter ${p.name} is not an identifier`);
    }
    const pathType = pathParams.length
      ? `{ ${pathParams.map((p, i) => `readonly ${key(p.name)}: ${ts(p.schema ?? { type: 'string' }, `${o.pointer}/parameters/${String(i)}/schema`)}`).join('; ')} }`
      : '';
    const isString = (n: string): boolean => {
      const t = types(pathParams.find((p) => p.name === n)?.schema ?? { type: 'string' });
      return t.length === 1 && t[0] === 'string';
    };
    const url =
      '`' +
      o.path.replace(/\{([^}]+)\}/g, (_, n: string) => (isString(n) ? `\${enc(${n})}` : `\${enc(String(${n}))}`)) +
      '`';
    const destructure = pathParams.length
      ? `{ ${pathParams.map((p) => p.name).join(', ')}${o.kind === 'change' || o.kind === 'creation' ? ', ...body' : ''} }`
      : '';
    const summary = doc(o.op.summary ?? o.op.description ?? `${o.method} ${o.path}`, '  ');

    if (o.kind === 'view' || o.kind === 'list' || o.kind === 'search') {
      const queryType = `${o.type}Query`;
      if (queryParams.length)
        out.push(
          `/** The query-string parameters of ${o.type}. */`,
          `export interface ${queryType} {\n${queryParams
            .map(
              (p, i) =>
                `${doc(p.description, '  ')}  readonly ${key(p.name)}?: ${ts(p.schema ?? { type: 'string' }, `${o.pointer}/parameters/${String(params.includes(p) ? params.indexOf(p) : i)}/schema`)} | undefined;`,
            )
            .join('\n')}\n}`,
          '',
        );
      const result = o.kind === 'view' ? viewType(o) : pageType(o);
      const args = [
        pathParams.length ? `${destructure}: ${pathType}` : '',
        queryParams.length ? `query: ${queryType} = {}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      const q = queryParams.length ? ', query: query as Readonly<Record<string, QueryValue>>' : '';
      requests.push(`${summary}  ${o.name}: (${args}): ReadRequest => ({ path: ${url}${q} }),`);
      const callArgs = [pathParams.length ? `p: ${pathType}` : '', queryParams.length ? `query?: ${queryType}` : '']
        .filter(Boolean)
        .join(', ');
      const forward = [pathParams.length ? 'p' : '', queryParams.length ? 'query' : ''].filter(Boolean).join(', ');
      queries.push(
        `${doc(o.op.summary ?? o.op.description ?? `${o.method} ${o.path}`, '      ')}      ${o.name}: (${callArgs}): Promise<Result<${result}>> => {\n        const r = requests.${o.name}(${forward});\n        return client.read<${result}>(r.path, r.query ? { query: r.query } : {});\n      },`,
      );
    } else {
      const body = bodySchema(o);
      const bodyType = body ? ts(body, `${o.pointer}/requestBody/content/application~1json/schema`) : '';
      if (body && pathParams.length) {
        const bodyProps = Object.keys(resolve(body).properties ?? {});
        for (const p of pathParams)
          if (bodyProps.includes(p.name))
            throw new GenerateError(o.pointer, `path parameter ${p.name} has the name of a body member`);
      }
      const inputType = [pathType, bodyType].filter(Boolean).join(' & ') || 'object';
      const input = pathParams.length ? destructure : body ? 'body' : '_';
      const bodyField = body ? ', body' : '';
      const id = createdId(o);
      const result = o.kind === 'creation' ? (id === 'string' ? 'Created' : `Created<${id}>`) : 'undefined';
      const typeArg = result === 'undefined' ? '' : `<${result}>`; // T defaults to undefined in client.change
      out.push(`/** The input of ${o.type}. */`, `export type ${o.type}Input = ${inputType};`, '');
      requests.push(
        `${summary}  ${o.name}: (${input}: ${o.type}Input): ChangeRequest => ({ method: '${o.method}', path: ${url}${bodyField} }),`,
      );
      changes.push(
        `${doc(o.op.summary ?? o.op.description ?? `${o.method} ${o.path}`, '      ')}      ${o.name}: (input: ${o.type}Input, options?: ChangeOptions): Promise<Result<${result}>> =>\n        client.change${typeArg}(requests.${o.name}(input), options),`,
      );
      const r = body ? rulesOf(resolve(body), `${o.pointer}/requestBody`, '', new Set()) : [];
      if (r.length) rules.push(`  ${o.name}: {\n${r.join('\n')}\n  },`);
    }
  }

  out.push(
    '/** Request builders: pass them to the runes (`list(() => requests.x(...))`, `changeForm(requests.y, …)`) or to the client. */',
    `export const requests = {\n${requests.join('\n')}\n};`,
    '',
    "/** Validation rules per change and field path (`lines[].quantity`), with the backend's codes: `changeForm(…, { rules })`. */",
    `export const rules = {\n${rules.join('\n')}\n} as const;`,
    '',
    '/** Typed calls over a client: `const api = tarol(client); await api.changes.createAuction({ reserve: 100 })`. */',
    'export function tarol(client: TarolClient) {',
    '  return {',
    `    changes: {\n${changes.join('\n')}\n    },`,
    `    queries: {\n${queries.join('\n')}\n    },`,
    '  };',
    '}',
    '',
  );
  const idTypes = [...ids]
    .sort()
    .map((a) => `/** The id of a ${pascal(a)} (a UUID string). */\nexport type ${pascal(a)}Id = Id<'${pascal(a)}'>;`);
  let text = out.join('\n');
  text = text.replace('%IDS%', ids.size ? ', Id' : '');
  if (idTypes.length)
    text = text.replace('const enc = encodeURIComponent;', `${idTypes.join('\n')}\n\nconst enc = encodeURIComponent;`);
  return text;

  function resolve(s: Schema): Schema {
    if (!s.$ref) return s;
    const name = /^#\/components\/schemas\/(.+)$/.exec(s.$ref)?.[1] ?? '';
    return schemas[name] ?? s;
  }

  function bodySchema(o: Op): Schema | undefined {
    return o.op.requestBody?.content?.['application/json']?.schema;
  }

  function success(o: Op): Schema | undefined {
    return (
      o.op.responses?.['200']?.content?.['application/json']?.schema ??
      o.op.responses?.['201']?.content?.['application/json']?.schema
    );
  }

  function viewType(o: Op): string {
    const s = success(o);
    if (!s) throw new GenerateError(`${o.pointer}/responses/200`, 'a view needs a JSON schema for 200');
    return ts(s, `${o.pointer}/responses/200/content/application~1json/schema`);
  }

  function pageType(o: Op): string {
    const s = resolve(success(o) ?? {});
    const items = s.properties?.['items']?.items;
    if (!items) throw new GenerateError(`${o.pointer}/responses/200`, 'a list needs {items, next}');
    return `Page<${ts(items, `${o.pointer}/responses/200/content/application~1json/schema/properties/items/items`)}>`;
  }

  function createdId(o: Op): string {
    const id = o.op.responses?.['201']?.content?.['application/json']?.schema?.properties?.['id'];
    return id ? ts(id, `${o.pointer}/responses/201/content/application~1json/schema/properties/id`) : 'string';
  }

  /** The rules of a body schema per field path, from `x-tarol-rules` (BC-4) or from the JSON Schema keywords. */
  function rulesOf(s: Schema, pointer: string, prefix: string, seen: Set<string>): string[] {
    const out: string[] = [];
    const required = new Set(s.required ?? []);
    for (const [name, raw] of Object.entries(s.properties ?? {})) {
      const path = prefix + name;
      const p = resolve(raw);
      const list = fieldRules(p, required.has(name) && !types(p).includes('null'));
      if (list.length) out.push(`    ${JSON.stringify(path)}: [${list.map((r) => JSON.stringify(r)).join(', ')}],`);
      const refName = raw.$ref ?? p.items?.$ref ?? '';
      if (refName && seen.has(refName)) continue; // a recursive schema: one level is enough for the fields of a form
      const next = new Set(seen).add(refName);
      if (p.properties) out.push(...rulesOf(p, `${pointer}/properties/${pointerPart(name)}`, `${path}.`, next));
      const item = p.items ? resolve(p.items) : undefined;
      if (item?.properties)
        out.push(...rulesOf(item, `${pointer}/properties/${pointerPart(name)}/items`, `${path}[].`, next));
    }
    return out;
  }
}

function kindOf(op: Operation, method: string, pointer: string): Kind {
  const declared = op['x-tarol-kind'];
  if (
    declared === 'creation' ||
    declared === 'change' ||
    declared === 'view' ||
    declared === 'list' ||
    declared === 'search'
  )
    return declared;
  if (declared !== undefined) throw new GenerateError(`${pointer}/x-tarol-kind`, `unknown kind ${declared}`);
  const responses = op.responses ?? {};
  if (method === 'get') {
    const props = responses['200']?.content?.['application/json']?.schema?.properties;
    return props && 'items' in props && 'next' in props ? 'list' : 'view';
  }
  if ('201' in responses) return 'creation';
  return 'change';
}

/** Rules of one field: `x-tarol-rules` when the backend emits them (BC-4), else the JSON Schema keywords. */
function fieldRules(s: Schema, required: boolean): GeneratedRule[] {
  if (s['x-tarol-rules']) return [...s['x-tarol-rules']];
  const out: GeneratedRule[] = [];
  const t = types(s).filter((x) => x !== 'null');
  const isString = t.length === 1 && t[0] === 'string';
  if (required) out.push({ rule: 'Required', code: 'Required' });
  if (isString && s.minLength === 1 && s.maxLength === undefined) out.push({ rule: 'NotEmpty', code: 'Required' });
  else if (isString && (s.minLength !== undefined || s.maxLength !== undefined))
    out.push({
      rule: 'Length',
      code: 'Length',
      ...(s.minLength === undefined ? {} : { min: s.minLength }),
      ...(s.maxLength === undefined ? {} : { max: s.maxLength }),
    });
  if (s.minimum !== undefined || s.maximum !== undefined)
    out.push({
      rule: 'Range',
      code: 'Range',
      ...(s.minimum === undefined ? {} : { min: Number(s.minimum) }),
      ...(s.maximum === undefined ? {} : { max: Number(s.maximum) }),
    });
  if (t.includes('array') && (s.minItems !== undefined || s.maxItems !== undefined))
    out.push({
      rule: 'Count',
      code: 'Count',
      ...(s.minItems === undefined ? {} : { min: s.minItems }),
      ...(s.maxItems === undefined ? {} : { max: s.maxItems }),
    });
  // a pattern only on a pure string: the ["number","string"] patterns are ASP.NET's number format, not a rule; and only
  // when it compiles as an ECMAScript pattern (the backend's are .NET regexes, BC-4)
  if (isString && s.pattern !== undefined && compiles(s.pattern))
    out.push({ rule: 'Pattern', code: 'Pattern', pattern: s.pattern });
  if (isString && s.format === 'email') out.push({ rule: 'Email', code: 'Email' });
  return out;
}

function compiles(pattern: string): boolean {
  try {
    new RegExp(pattern, 'u');
    return true;
  } catch {
    return false;
  }
}

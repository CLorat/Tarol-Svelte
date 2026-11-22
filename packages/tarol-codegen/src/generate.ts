/**
 * The OpenAPI subset the generator reads: what Tarol-Net's `AddTarolEndpoints()` emits (OpenAPI 3.1/3.2, JSON Schema
 * 2020-12 types) with its `x-tarol-*` extensions: `x-tarol-kind`, `x-tarol-errors`, `x-tarol-id`, `x-tarol-rules`,
 * `x-tarol-email`, and the `TarolProblem` schema of every problem answer.
 */
export interface OpenApiDocument {
  /** The OpenAPI version; 3.1 or later. */
  readonly openapi: string;
  /** Path → method → operation. */
  readonly paths?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** The reusable schemas. */
  readonly components?: { readonly schemas?: Readonly<Record<string, Schema>> };
  /** The UI push topics (Tarol-Net BC-25): topic name → its contract version, stream, payload schema and rules. */
  readonly 'x-tarol-topics'?: Readonly<Record<string, TopicDescription>>;
}

/** One topic of `x-tarol-topics`. */
export interface TopicDescription {
  /** The contract version the backend publishes. */
  readonly version?: number;
  /** The aggregate type whose id is the messages' `subject`. */
  readonly stream?: string;
  /** The payload's schema (usually a `$ref` to the contract record). */
  readonly schema?: Schema;
  /** Whether a rule lets someone subscribe. */
  readonly subscribe?: boolean;
  /** Whether a rule lets someone publish. */
  readonly publish?: boolean;
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
  /** The entry's kind: `creation`, `change`, `view`, `list`, `search`, `admin` or `me`. Required. */
  readonly 'x-tarol-kind'?: string;
  /** The codes the operation can answer with, where the backend knows them statically. */
  readonly 'x-tarol-errors'?: readonly string[];
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
  /** The aggregate of an `Id<T>` route value (Tarol puts it on the parameter, next to its schema). */
  readonly 'x-tarol-id'?: string;
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
  /** The aggregate an `Id<T>` belongs to, e.g. `Auction`. */
  readonly 'x-tarol-id'?: string;
  /** The backend's rules with their codes. */
  readonly 'x-tarol-rules'?: readonly GeneratedRule[];
  /** The exact semantics of the backend's e-mail check, in words (it must be the one `isEmail` implements). */
  readonly 'x-tarol-email'?: string;
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

type Kind = 'creation' | 'change' | 'view' | 'list' | 'search' | 'admin' | 'me';

/** The e-mail check `@clorat/tarol-svelte`'s `isEmail` implements (Tarol.Validations `Rules.Email`), as the backend states it. */
export const emailRule =
  'one @ with 1 to 64 characters before it; a domain of at most 253 characters that contains a dot, does not start or end with one and has no empty label; no white space; at most 254 characters';

/** The rule kinds `@clorat/tarol-svelte`'s `check` knows; another one cannot be checked in the browser. */
const knownRules = new Set(['Required', 'NotEmpty', 'Range', 'Length', 'Pattern', 'Email', 'Count']);

/** The schema of every problem answer: the client reads it as its `Violation`, so no type is generated for it. */
const problemSchema = 'TarolProblem';

interface Op {
  readonly name: string;
  readonly type: string;
  readonly method: string;
  readonly path: string;
  readonly kind: Kind;
  /** A read (`client.read`): views, lists, search, `me`, and the admin entry's GETs; everything else is a change. */
  readonly read: boolean;
  /** The codes of `x-tarol-errors`, or none. */
  readonly errors: readonly string[];
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
      const kind = kindOf(op, pointer);
      const errors = op['x-tarol-errors'] ?? [];
      if (!Array.isArray(errors) || errors.some((e) => typeof e !== 'string'))
        throw new GenerateError(`${pointer}/x-tarol-errors`, 'not a list of codes');
      ops.push({
        name: camel(op.operationId),
        type: pascal(op.operationId),
        method: method.toUpperCase(),
        path,
        kind,
        read:
          kind === 'view' ||
          kind === 'list' ||
          kind === 'search' ||
          kind === 'me' ||
          (kind === 'admin' && method === 'get'),
        errors,
        op,
        pointer,
      });
    }
  }
  ops.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const out: string[] = [];
  out.push(
    `// Generated by @clorat/tarol-codegen${options.source ? ` from ${options.source}` : ''}. Do not edit: regenerate.`,
    "import type { %IMPORTS% } from '@clorat/tarol-client';",
    '',
    '/** A read for `query(...)` / `list(...)` of `@clorat/tarol-svelte`, or for `client.read`. */',
    'export interface ReadRequest {',
    '  readonly path: string;',
    '  readonly query?: Readonly<Record<string, QueryValue>>;',
    '  /** The stream a view by id shows: its live topics skip messages of other streams. */',
    '  readonly subject?: string;',
    '  /** The aggregate type of `subject` (its `x-tarol-id`). */',
    '  readonly stream?: string;',
    '}',
    '',
    'const enc = encodeURIComponent;',
    '',
  );

  // schema types (not the problem schema: the client maps problems to its Violation)
  for (const [name, s] of Object.entries(schemas)) {
    if (name === problemSchema) continue;
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
  const errorLists: string[] = [];
  let usesQs = false;
  for (const o of ops) {
    // the operation's codes: a union for its results, and a list for checks (e.g. that a catalogue has every message)
    const code = o.errors.length ? `${o.type}Code` : '';
    if (code) {
      out.push(
        `/** The codes ${o.type} answers with, as the backend declares them (x-tarol-errors). */`,
        `export type ${code} = ${o.errors.map((e) => JSON.stringify(e)).join(' | ')};`,
        '',
      );
      errorLists.push(`  ${o.name}: [${o.errors.map((e) => JSON.stringify(e)).join(', ')}],`);
    }
    const codeArg = code ? `, ${code}` : '';
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
    const paramSchema = (p: Parameter): Schema => {
      const schema = p.schema ?? { type: 'string' };
      return p['x-tarol-id'] ? { ...schema, 'x-tarol-id': p['x-tarol-id'] } : schema;
    };
    const pathType = pathParams.length
      ? `{ ${pathParams.map((p) => `readonly ${key(p.name)}: ${ts(paramSchema(p), `${o.pointer}/parameters/${String(params.indexOf(p))}/schema`)}`).join('; ')} }`
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

    const queryRequired = queryParams.some((p) => p.required === true);
    const queryType = `${o.type}Query`;
    if (o.read) {
      if (queryParams.length)
        out.push(
          `/** The query-string parameters of ${o.type}. */`,
          // a type alias, not an interface: an object type alias is assignable to the client's Record of query values
          `export type ${queryType} = {\n${queryParams
            .map(
              (p) =>
                `${doc(p.description, '  ')}  readonly ${key(p.name)}${p.required === true ? '' : '?'}: ${ts(p.schema ?? { type: 'string' }, `${o.pointer}/parameters/${String(params.indexOf(p))}/schema`)}${p.required === true ? '' : ' | undefined'};`,
            )
            .join('\n')}\n};`,
          '',
        );
      const result = o.kind === 'list' ? pageType(o) : viewType(o);
      const args = [
        pathParams.length ? `${destructure}: ${pathType}` : '',
        queryParams.length ? `query: ${queryType}${queryRequired ? '' : ' = {}'}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      const q = queryParams.length ? ', query' : '';
      // a view of one aggregate by its id names that stream, so live messages of other streams skip it (SV-24)
      const aggregate = o.kind === 'view' && pathParams.length === 1 ? pathParams[0]?.['x-tarol-id'] : undefined;
      const id =
        aggregate && pathParams[0]
          ? `, subject: ${pathParams[0].name}, stream: ${JSON.stringify(pascal(aggregate))}`
          : '';
      requests.push(`${summary}  ${o.name}: (${args}): ReadRequest => ({ path: ${url}${q}${id} }),`);
      const callArgs = [
        pathParams.length ? `p: ${pathType}` : '',
        queryParams.length ? `query${queryRequired ? '' : '?'}: ${queryType}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      const forward = [pathParams.length ? 'p' : '', queryParams.length ? 'query' : ''].filter(Boolean).join(', ');
      queries.push(
        `${doc(o.op.summary ?? o.op.description ?? `${o.method} ${o.path}`, '      ')}      ${o.name}: (${callArgs}): Promise<Result<${result}${codeArg}>> => {\n        const r = requests.${o.name}(${forward});\n        return client.read<${result}>(r.path, r.query ? { query: r.query } : {})${code ? ` as Promise<Result<${result}${codeArg}>>` : ''};\n      },`,
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
      // a change's query values (the admin entry's `tenant`) are part of its input, next to the path values
      const queryInput = queryParams.length
        ? `{ ${queryParams.map((p) => `readonly ${key(p.name)}${p.required === true ? '' : '?'}: ${ts(p.schema ?? { type: 'string' }, `${o.pointer}/parameters/${String(params.indexOf(p))}/schema`)}${p.required === true ? '' : ' | undefined'}`).join('; ')} }`
        : '';
      if (queryParams.length && body)
        throw new GenerateError(o.pointer, 'a change with both a body and query values is not supported');
      const inputType = [pathType, queryInput, bodyType].filter(Boolean).join(' & ') || 'object';
      const names = [...pathParams, ...queryParams].map((p) => p.name);
      const input = names.length ? `{ ${names.join(', ')}${body ? ', ...body' : ''} }` : body ? 'body' : '_';
      const bodyField = body ? ', body' : '';
      const queryField = queryParams.length ? `, query: { ${queryParams.map((p) => p.name).join(', ')} }` : '';
      const id = createdId(o);
      const result =
        o.kind === 'creation'
          ? id === 'string'
            ? 'Created'
            : `Created<${id}>`
          : o.kind === 'admin' && success(o)
            ? viewType(o)
            : 'undefined';
      // T defaults to undefined; the codes narrow the result by an assertion (TarolClient stays code-agnostic)
      const typeArg = result === 'undefined' ? '' : `<${result}>`;
      out.push(`/** The input of ${o.type}. */`, `export type ${o.type}Input = ${inputType};`, '');
      if (queryParams.length) usesQs = true;
      requests.push(
        `${summary}  ${o.name}: (${input}: ${o.type}Input): ChangeRequest => ({ method: '${o.method}', path: ${queryParams.length ? `${url} + qs(${queryField.slice(', query: '.length)})` : url}${bodyField} }),`,
      );
      changes.push(
        `${doc(o.op.summary ?? o.op.description ?? `${o.method} ${o.path}`, '      ')}      ${o.name}: (input: ${o.type}Input, options?: ChangeOptions): Promise<Result<${result}${codeArg}>> =>\n        client.change${typeArg}(requests.${o.name}(input), options)${code ? ` as Promise<Result<${result}${codeArg}>>` : ''},`,
      );
      const r = body ? rulesOf(resolve(body), `${o.pointer}/requestBody`, '', new Set()) : [];
      if (r.length) rules.push(`  ${o.name}: {\n${r.join('\n')}\n  },`);
    }
  }

  // the UI push topics (BC-25): a typed name per topic, its stream for the subject filter, its payload as a type
  const topicDoc = Object.entries(document['x-tarol-topics'] ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (topicDoc.length) {
    const short = (t: string): string => camel(t.slice(t.indexOf('.') + 1));
    const clash = (t: string): boolean => topicDoc.filter(([o]) => short(o) === short(t)).length > 1;
    out.push(
      '/** The UI push topics the backend describes (x-tarol-topics): `query(…, { live: topics.x })`, typed `PushedMessage<T>`. */',
      `export const topics = {\n${topicDoc
        .map(([name, t]) => {
          const payload = t.schema ? ts(t.schema, `#/x-tarol-topics/${pointerPart(name)}/schema`) : 'unknown';
          const stream = t.stream ? pascal(t.stream) : undefined;
          const facts = [
            t.version === undefined ? '' : `version ${String(t.version)}`,
            stream ? `about a ${stream}` : '',
            t.subscribe === true ? 'subscribable' : t.subscribe === false ? 'not subscribable' : '',
            t.publish === true ? 'publishable' : '',
          ].filter(Boolean);
          return `  /** ${name}${facts.length ? ` (${facts.join(', ')})` : ''} */\n  ${clash(name) ? camel(name) : short(name)}: { topic: ${JSON.stringify(name)}${stream ? `, stream: ${JSON.stringify(stream)}` : ''} } as Topic<${payload}${stream ? `, ${JSON.stringify(stream)}` : ''}>,`;
        })
        .join('\n')}\n};`,
      '',
    );
  }

  out.push(
    '/** Request builders: pass them to the runes (`list(() => requests.x(...))`, `changeForm(requests.y, …)`) or to the client. */',
    `export const requests = {\n${requests.join('\n')}\n};`,
    '',
    "/** Validation rules per change and field path (`lines[].quantity`), with the backend's codes: `changeForm(…, { rules })`. */",
    `export const rules = {\n${rules.join('\n')}\n} as const;`,
    '',
    '/** The codes each operation answers with (x-tarol-errors), e.g. to check that a message catalogue has them all. */',
    `export const errors = {\n${errorLists.join('\n')}\n} as const;`,
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
  if (usesQs)
    text = text.replace(
      'const enc = encodeURIComponent;',
      [
        'const enc = encodeURIComponent;',
        '/** The query string of a change (the admin entry takes `tenant` there). */',
        'const qs = (q: Readonly<Record<string, QueryValue>>): string => {',
        '  const p = new URLSearchParams();',
        '  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null) p.set(k, String(v));',
        '  const s = p.toString();',
        "  return s ? `?${s}` : '';",
        '};',
      ].join('\n'),
    );
  // only the client types the module uses (an admin-only document has no creation and no list)
  const used = ['ChangeOptions', 'ChangeRequest', 'Created', 'Page', 'QueryValue', 'Result', 'TarolClient'].filter(
    (n) => new RegExp(`\\b${n}\\b`).test(text.replace('%IMPORTS%', '')),
  );
  text = text.replace('%IMPORTS%', [...used, ...(ids.size ? ['Id'] : [])].join(', '));
  if (topicDoc.length)
    text = text.replace(
      "from '@clorat/tarol-client';",
      "from '@clorat/tarol-client';\nimport type { Topic } from '@clorat/tarol-client/push';",
    );
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
    // the admin entry's subject export documents no schema (Tarol-Svelte BC-20): the only untyped answer
    if (!s && o.kind === 'admin') return 'unknown';
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

  /** The rules of a body schema per field path, from `x-tarol-rules` or from the JSON Schema keywords. */
  function rulesOf(s: Schema, pointer: string, prefix: string, seen: Set<string>): string[] {
    const out: string[] = [];
    const required = new Set(s.required ?? []);
    for (const [name, raw] of Object.entries(s.properties ?? {})) {
      const path = prefix + name;
      const p = resolve(raw);
      const list = fieldRules(
        p,
        required.has(name) && !types(p).includes('null'),
        `${pointer}/properties/${pointerPart(name)}`,
      );
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

function kindOf(op: Operation, pointer: string): Kind {
  const declared = op['x-tarol-kind'];
  if (declared === undefined)
    throw new GenerateError(
      `${pointer}/x-tarol-kind`,
      'x-tarol-kind is required (a Tarol backend emits it on every entry)',
    );
  const kinds: readonly string[] = ['creation', 'change', 'view', 'list', 'search', 'admin', 'me'];
  if (!kinds.includes(declared)) throw new GenerateError(`${pointer}/x-tarol-kind`, `unknown kind ${declared}`);
  return declared as Kind;
}

/**
 * Rules of one field: `Required` for a required member, then `x-tarol-rules` when the backend emits them (the same codes
 * as its 400s), else the JSON Schema keywords. A pattern that is no ECMAScript pattern is left to the server.
 */
function fieldRules(s: Schema, required: boolean, pointer: string): GeneratedRule[] {
  const tarol = s['x-tarol-rules'];
  const email = s['x-tarol-email'];
  if (email !== undefined && email !== emailRule)
    throw new GenerateError(
      `${pointer}/x-tarol-email`,
      `the backend's e-mail check is not the one the client implements (${emailRule}): ${email}`,
    );
  if (tarol) {
    for (const [i, r] of tarol.entries())
      if (!knownRules.has(r.rule))
        throw new GenerateError(`${pointer}/x-tarol-rules/${String(i)}`, `rule ${r.rule} is not checked by the client`);
    const head: GeneratedRule[] =
      required && !tarol.some((r) => r.rule === 'Required') ? [{ rule: 'Required', code: 'Required' }] : [];
    return [...head, ...tarol.filter((r) => r.rule !== 'Pattern' || compiles(r.pattern ?? '', r.flags))];
  }
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
  // when it compiles as an ECMAScript pattern (a .NET pattern without x-tarol-rules may not)
  if (isString && s.pattern !== undefined && compiles(s.pattern))
    out.push({ rule: 'Pattern', code: 'Pattern', pattern: s.pattern });
  if (isString && s.format === 'email') out.push({ rule: 'Email', code: 'Email' });
  return out;
}

function compiles(pattern: string, flags = ''): boolean {
  try {
    new RegExp(pattern, [...new Set(`u${flags}`)].join(''));
    return true;
  } catch {
    return false;
  }
}

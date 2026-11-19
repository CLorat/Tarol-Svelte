declare const brand: unique symbol;

/**
 * A Tarol `Id<T>` on the wire: a UUID string in "D" format (new ids are UUIDv7), branded with the aggregate's name so an
 * `Id<'Auction'>` cannot be passed where an `Id<'Bid'>` is expected.
 */
export type Id<Of extends string> = string & { readonly [brand]: Of };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `true` when the value is a UUID in "D" format, the only form the backend's JSON converter accepts. */
export function isId(value: unknown): value is Id<string> {
  return typeof value === 'string' && uuid.test(value);
}

/** Brands a UUID string; throws a `TypeError` for anything else (a programming error, not a business outcome). */
export function asId<Of extends string>(value: string): Id<Of> {
  if (!uuid.test(value)) throw new TypeError(`not an id: ${value}`);
  return value as Id<Of>;
}

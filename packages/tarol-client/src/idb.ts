import type { OfflineRecord, OfflineStore, OfflineTable } from './outbox.js';

const done = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('indexedDB'));
    };
  });

/**
 * An `OfflineStore` (from `@clorat/tarol-client/outbox`) on IndexedDB: one database (default `tarol-offline`) with the tables `outbox` and `reads`,
 * each indexed by scope. The only code of tarol-client that touches `indexedDB`; it opens the database on first use.
 * Records are stored unencrypted: keep only what is needed, and `clear()` the scope at sign-out.
 */
export function idbStore(name = 'tarol-offline'): OfflineStore {
  let db: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        for (const t of ['outbox', 'reads'] as const)
          request.result.createObjectStore(t, { keyPath: 'key' }).createIndex('scope', 'scope');
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('indexedDB'));
      };
    }));
  const table = async (t: OfflineTable, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> =>
    (await open()).transaction(t, mode).objectStore(t);
  return {
    async list<T extends OfflineRecord>(t: OfflineTable, scope: string): Promise<T[]> {
      return (await done((await table(t)).index('scope').getAll(scope))) as T[];
    },
    async get<T extends OfflineRecord>(t: OfflineTable, key: string): Promise<T | undefined> {
      return (await done((await table(t)).get(key))) as T | undefined;
    },
    async put(t, record) {
      await done((await table(t, 'readwrite')).put(record));
    },
    async delete(t, key) {
      await done((await table(t, 'readwrite')).delete(key));
    },
    async clear(t, scope) {
      const store = await table(t, 'readwrite');
      const keys = await done(store.index('scope').getAllKeys(scope));
      await Promise.all(keys.map((k) => done(store.delete(k))));
    },
  };
}

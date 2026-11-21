/**
 * Versioned IndexedDB storage for CodeQuest Pixel OS.
 *
 * Object stores are kept logically separate:
 *  - progress : completion records, current ticket (progression data)
 *  - drafts   : per-ticket code drafts
 *  - prefs    : settings + window geometry (user preferences, not progression)
 *  - chat     : chat messages and read state
 *  - fs       : reserved for the future shared project filesystem
 */
export const DB_NAME = "codequest-pixel-os";
export const DB_VERSION = 1;

export type StoreName = "progress" | "drafts" | "prefs" | "chat" | "fs";
const STORES: StoreName[] = ["progress", "drafts", "prefs", "chat", "fs"];

let dbPromise: Promise<IDBDatabase> | null = null;

export class StorageUnavailableError extends Error {}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new StorageUnavailableError("IndexedDB is not available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 schema. Future versions: add migrations keyed on event.oldVersion here.
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new StorageUnavailableError("Could not open storage."));
    req.onblocked = () => reject(new StorageUnavailableError("Storage is blocked by another tab."));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        let result: T;
        req.onsuccess = () => {
          result = req.result;
        };
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error ?? req.error);
        t.onabort = () => reject(t.error ?? new Error("Storage transaction aborted"));
      }),
  );
}

export function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function dbSet<T>(store: StoreName, key: string, value: T): Promise<void> {
  return tx(store, "readwrite", (s) => s.put(value, key)).then(() => undefined);
}

export function dbGetAll<T>(store: StoreName): Promise<Record<string, T>> {
  return openDb().then(
    (db) =>
      new Promise<Record<string, T>>((resolve, reject) => {
        const t = db.transaction(store, "readonly");
        const s = t.objectStore(store);
        const out: Record<string, T> = {};
        const req = s.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            out[String(cursor.key)] = cursor.value as T;
            cursor.continue();
          }
        };
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
      }),
  );
}

export function dbClear(store: StoreName): Promise<void> {
  return tx(store, "readwrite", (s) => s.clear()).then(() => undefined);
}

export function dbDelete(store: StoreName, key: string): Promise<void> {
  return tx(store, "readwrite", s => s.delete(key)).then(() => undefined);
}

export type DbWriteMode = "put" | "add";

export interface DbAtomicWrite {
  readonly key: string;
  readonly value: unknown;
  /** `add` fails if the key already exists, which guards one-time records. */
  readonly mode?: DbWriteMode;
}

export interface DbAtomicSuccess<T> {
  readonly ok: true;
  readonly writes: readonly DbAtomicWrite[];
  readonly result: T;
}

export type DbAtomicPlan<T> = DbAtomicSuccess<T> | { ok: false; reason: string };

export type DbAtomicResult<T> =
  | { ok: true; result: T }
  | { ok: false; reason: string; conflict: boolean };

/**
 * Read a set of keys and conditionally commit writes in one IndexedDB
 * transaction. This lets a one-time reward and its durable guard record commit
 * together: either both are saved or neither is.
 */
export function dbAtomic<T>(
  store: StoreName,
  keys: readonly string[],
  plan: (records: ReadonlyMap<string, unknown>) => DbAtomicPlan<T>,
): Promise<DbAtomicResult<T>> {
  return openDb().then(
    (db) =>
      new Promise<DbAtomicResult<T>>((resolve, reject) => {
        const transaction = db.transaction(store, "readwrite");
        const objectStore = transaction.objectStore(store);
        const records = new Map<string, unknown>();
        let remaining = keys.length;
        let lastError: DOMException | null = null;
        let successResult: { readonly value: T } | null = null;
        let settled = false;

        const finish = (result: DbAtomicResult<T>) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        const failure = (reason: string, conflict: boolean) =>
          finish({ ok: false, reason, conflict });

        transaction.onerror = () =>
          failure(
            lastError?.message ?? transaction.error?.message ?? "Storage transaction failed",
            lastError?.name === "ConstraintError",
          );
        transaction.onabort = () =>
          failure(
            lastError?.message ?? transaction.error?.message ?? "Storage transaction aborted",
            lastError?.name === "ConstraintError",
          );
        transaction.oncomplete = () => {
          if (successResult) finish({ ok: true, result: successResult.value });
          else failure("Storage transaction completed without a result", false);
        };

        const applyWrites = (planned: DbAtomicSuccess<T>) => {
          for (const write of planned.writes) {
            const writeRequest =
              write.mode === "add"
                ? objectStore.add(write.value, write.key)
                : objectStore.put(write.value, write.key);
            writeRequest.onerror = () => {
              lastError = writeRequest.error;
            };
          }
          successResult = { value: planned.result };
        };

        if (remaining === 0) {
          const planned = plan(records);
          if (!planned.ok) {
            failure(planned.reason, false);
            return;
          }
          applyWrites(planned);
          return;
        }

        keys.forEach((key) => {
          const request = objectStore.get(key) as IDBRequest<unknown>;
          request.onerror = () => {
            lastError = request.error;
          };
          request.onsuccess = () => {
            if (request.result !== undefined) records.set(key, request.result);
            remaining -= 1;
            if (remaining !== 0) return;

            let planned: DbAtomicPlan<T>;
            try {
              planned = plan(records);
            } catch (error) {
              try {
                transaction.abort();
              } catch {
                // The transaction may already have finished; report the original error.
              }
              if (!settled) {
                settled = true;
                reject(error);
              }
              return;
            }
            if (!planned.ok) {
              try {
                transaction.abort();
              } catch {
                // Resolved failure is reported even when abort is a no-op.
              }
              failure(planned.reason, false);
              return;
            }
            applyWrites(planned);
          };
        });
      }),
  );
}

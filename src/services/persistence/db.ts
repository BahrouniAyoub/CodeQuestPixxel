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

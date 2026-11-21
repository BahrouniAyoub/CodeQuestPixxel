import { create } from "zustand";
import { dbSet, type StoreName } from "./db";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveStatusStore {
  state: SaveState;
  pending: number;
  lastSavedAt: number | null;
  lastError: string | null;
  storageAvailable: boolean;
  setUnavailable: (msg: string) => void;
}

export const useSaveStatus = create<SaveStatusStore>((set) => ({
  state: "idle",
  pending: 0,
  lastSavedAt: null,
  lastError: null,
  storageAvailable: true,
  setUnavailable: (msg) => set({ storageAvailable: false, state: "error", lastError: msg }),
}));

type ErrorListener = (message: string) => void;
let errorListener: ErrorListener | null = null;
export function onSaveError(fn: ErrorListener) {
  errorListener = fn;
}

/** Track any durable write so multi-record commits share the save indicator. */
export async function trackedTransaction<T>(operation: () => Promise<T>): Promise<T> {
  useSaveStatus.setState((s) => ({ pending: s.pending + 1, state: "saving" }));
  try {
    const result = await operation();
    useSaveStatus.setState((s) => {
      const pending = s.pending - 1;
      return {
        pending,
        state: pending > 0 ? "saving" : "saved",
        lastSavedAt: Date.now(),
        lastError: null,
      };
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown storage error";
    useSaveStatus.setState((s) => ({
      pending: Math.max(0, s.pending - 1),
      state: "error",
      lastError: message,
    }));
    errorListener?.(message);
    throw err;
  }
}

/** Write through IndexedDB while tracking accurate save status. Never swallows failures. */
export async function trackedSave<T>(store: StoreName, key: string, value: T): Promise<boolean> {
  try {
    await trackedTransaction(() => dbSet(store, key, value));
    return true;
  } catch {
    return false;
  }
}

/** Debounce saves per key. */
const timers = new Map<string, ReturnType<typeof setTimeout>>();
export function debouncedSave<T>(store: StoreName, key: string, value: T, ms = 500, onDone?: (ok: boolean) => void) {
  const k = `${store}:${key}`;
  const existing = timers.get(k);
  if (existing) clearTimeout(existing);
  timers.set(
    k,
    setTimeout(() => {
      timers.delete(k);
      void trackedSave(store, key, value).then((ok) => onDone?.(ok));
    }, ms),
  );
}

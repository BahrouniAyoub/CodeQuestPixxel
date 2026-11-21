import { create } from "zustand";
import { dbGet } from "@/services/persistence/db";
import {
  CAFE_PAYMENT_STORAGE_KEY,
  CAFE_PAYMENT_STORAGE_STORE,
  validateCafePaymentSaveRecord,
  type CafePaymentRecord,
} from "./cafePayment";

export interface CafePaymentPersistence {
  load: () => Promise<unknown>;
}

export interface CafePaymentStore {
  payment: CafePaymentRecord | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  /** A raw record existed but failed validation. It is never overwritten. */
  invalidRecord: boolean;
  hydrate: () => Promise<void>;
  /** Adopt a record that was already committed atomically by the payment service. */
  adopt: (payment: CafePaymentRecord) => void;
}

const defaultPersistence: CafePaymentPersistence = {
  load: () => dbGet<unknown>(CAFE_PAYMENT_STORAGE_STORE, CAFE_PAYMENT_STORAGE_KEY),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Store factory with injectable persistence for focused tests. */
export function createCafePaymentStore(
  persistence: CafePaymentPersistence = defaultPersistence,
) {
  let hydrationPromise: Promise<void> | null = null;

  return create<CafePaymentStore>((set, get) => {
    const loadPayment = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        const result = validateCafePaymentSaveRecord(raw);
        if (!result.ok) {
          // The raw record is left untouched. A claim cannot overwrite it.
          set({
            payment: null,
            invalidRecord: raw !== undefined && raw !== null,
            hydrated: true,
            error: `Saved café payment was invalid and was not loaded: ${result.reason}.`,
          });
          return;
        }
        set({
          payment: result.payment,
          invalidRecord: false,
          hydrated: true,
          error: null,
        });
      } catch (error) {
        // Keep hydrated=false so a claim cannot overwrite a save we could not read.
        set({
          hydrated: false,
          error: `Could not load the café payment: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    return {
      payment: null,
      hydrated: false,
      loading: false,
      error: null,
      invalidRecord: false,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (!hydrationPromise) {
          hydrationPromise = loadPayment().finally(() => {
            hydrationPromise = null;
          });
        }
        return hydrationPromise;
      },

      adopt: (payment) =>
        set({ payment: { ...payment }, invalidRecord: false, hydrated: true, error: null }),
    };
  });
}

export const useCafePayment = createCafePaymentStore();

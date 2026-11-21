import { create } from "zustand";
import { dbGet } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";
import {
  applyCafeDeliveryCheck,
  applyCafeDocumentationVerification,
  createCafeDocSaveRecord,
  initialCafeDocProgress,
  isCafeDocumentationVerified,
  validateCafeDocSaveRecord,
  type CafeDocProgress,
  type CafeDocSaveRecord,
} from "./cafeDocProgress";

/**
 * Isolated record inside the existing `progress` object store. Development
 * tasks, legacy milestones, Chapter 1 quests, GigBoard applications, ticket XP,
 * and editor files live under different keys and are never touched here.
 */
export const CAFE_DOC_STORAGE_STORE = "progress";
export const CAFE_DOC_STORAGE_KEY = "chapter1-cafe-project-documentation";

export type CafeDocumentationVerificationResult =
  { ok: true; alreadyVerified: boolean } | { ok: false; reason: string };

export type CafeDeliveryRecordResult = { ok: true } | { ok: false; reason: string };

export interface CafeDocPersistence {
  load: () => Promise<unknown>;
  save: (record: CafeDocSaveRecord) => Promise<boolean>;
}

export interface CafeDocStore {
  progress: CafeDocProgress;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  /** True only when a valid documentation record was loaded from storage. */
  hasSavedRecord: boolean;
  hydrate: () => Promise<void>;
  recordDocumentationVerified: (
    readmeSignature: string,
    verifiedAt?: string,
  ) => Promise<CafeDocumentationVerificationResult>;
  recordDeliveryCheck: (input: {
    passed: boolean;
    projectSignature: string | null;
    checkedAt?: string;
  }) => Promise<CafeDeliveryRecordResult>;
}

const defaultPersistence: CafeDocPersistence = {
  load: () => dbGet<unknown>(CAFE_DOC_STORAGE_STORE, CAFE_DOC_STORAGE_KEY),
  save: (record) => trackedSave(CAFE_DOC_STORAGE_STORE, CAFE_DOC_STORAGE_KEY, record),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Store factory with injectable persistence for focused tests.
 * Production uses the shared `useCafeDoc` singleton below.
 */
export function createCafeDocStore(persistence: CafeDocPersistence = defaultPersistence) {
  let hydrationPromise: Promise<void> | null = null;
  let saveQueue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = saveQueue.then(task);
    saveQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return create<CafeDocStore>((set, get) => {
    const loadProgress = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        if (raw === undefined) {
          set({
            progress: initialCafeDocProgress,
            hydrated: true,
            hasSavedRecord: false,
          });
          return;
        }

        const result = validateCafeDocSaveRecord(raw);
        if (!result.ok) {
          set({
            progress: initialCafeDocProgress,
            hydrated: true,
            hasSavedRecord: false,
            error: `Saved café documentation progress was invalid and was not loaded: ${result.reason}. Start by verifying README.md again.`,
          });
          return;
        }

        set({ progress: result.progress, hydrated: true, hasSavedRecord: true });
      } catch (error) {
        // Keep hydrated=false so a player action cannot overwrite a save we
        // could not read. hydrate() may be retried later.
        set({
          hydrated: false,
          hasSavedRecord: false,
          error: `Could not load café documentation progress: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    return {
      progress: initialCafeDocProgress,
      hydrated: false,
      loading: false,
      error: null,
      hasSavedRecord: false,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (!hydrationPromise) {
          hydrationPromise = loadProgress().finally(() => {
            hydrationPromise = null;
          });
        }
        return hydrationPromise;
      },

      recordDocumentationVerified: (readmeSignature, verifiedAt) =>
        enqueue(async () => {
          // A queued action always waits for hydration, so an early call can
          // never save initial state over an existing documentation record.
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason:
                "Your saved documentation progress could not be loaded. Reload and try again.",
            };
          }

          const current = get().progress;
          if (
            isCafeDocumentationVerified(current) &&
            current.documentation.readmeSignature === readmeSignature
          ) {
            return { ok: true, alreadyVerified: true };
          }

          const next = applyCafeDocumentationVerification(current, readmeSignature, verifiedAt);
          if (next === current) {
            return {
              ok: false,
              reason: "The README verification could not be recorded. Try verifying it again.",
            };
          }

          try {
            const saved = await persistence.save(createCafeDocSaveRecord(next));
            if (!saved) {
              set({
                error:
                  "Could not save your documentation progress. Nothing was verified; try again.",
              });
              return {
                ok: false,
                reason:
                  "Could not save your documentation verification. Try verifying the README again.",
              };
            }
          } catch (error) {
            const message = `Could not save café documentation progress: ${errorMessage(error)}`;
            set({ error: message });
            return {
              ok: false,
              reason: "Could not save your documentation verification. Try again.",
            };
          }

          set({ progress: next, error: null, hasSavedRecord: true });
          return { ok: true, alreadyVerified: false };
        }),

      recordDeliveryCheck: (input) =>
        enqueue(async () => {
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason:
                "Your saved documentation progress could not be loaded. Reload and try again.",
            };
          }

          const current = get().progress;
          const next = applyCafeDeliveryCheck(current, {
            passed: input.passed,
            projectSignature: input.projectSignature,
            checkedAt: input.checkedAt ?? new Date().toISOString(),
          });
          if (next === current) {
            return {
              ok: false,
              reason: "The final project check result could not be recorded. Run the check again.",
            };
          }

          try {
            const saved = await persistence.save(createCafeDocSaveRecord(next));
            if (!saved) {
              set({
                error:
                  "Could not save the final project check result. Nothing was marked ready; run the check again.",
              });
              return {
                ok: false,
                reason:
                  "Could not save the final project check result. Run the check again to retry.",
              };
            }
          } catch (error) {
            const message = `Could not save café delivery progress: ${errorMessage(error)}`;
            set({ error: message });
            return {
              ok: false,
              reason:
                "Could not save the final project check result. Run the check again to retry.",
            };
          }

          set({ progress: next, error: null, hasSavedRecord: true });
          return { ok: true };
        }),
    };
  });
}

export const useCafeDoc = createCafeDocStore();

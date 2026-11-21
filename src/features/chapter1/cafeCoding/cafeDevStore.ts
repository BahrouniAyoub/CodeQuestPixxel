import { create } from "zustand";
import { dbGet } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";
import type { CafeDevTaskId } from "./cafeDevTasks";
import {
  completeCafeDevTask,
  createCafeDevSaveRecord,
  initialCafeDevProgress,
  isCafeDevTaskComplete,
  validateCafeDevSaveRecord,
  type CafeDevProgress,
  type CafeDevSaveRecord,
} from "./cafeDevProgress";

/**
 * Isolated record inside the existing `progress` object store. The legacy
 * milestone record, Chapter 1 quests, GigBoard applications, ticket XP, and
 * editor files live under different keys and are never touched by this store.
 */
export const CAFE_DEV_STORAGE_STORE = "progress";
export const CAFE_DEV_STORAGE_KEY = "chapter1-cafe-development-project";

export type CafeDevCompletionResult =
  { ok: true; alreadyCompleted: boolean } | { ok: false; reason: string };

export interface CafeDevPersistence {
  load: () => Promise<unknown>;
  save: (record: CafeDevSaveRecord) => Promise<boolean>;
}

export interface CafeDevStore {
  progress: CafeDevProgress;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  /** Set when development progress saved but CH1-05 could not be updated. */
  questSyncError: string | null;
  /** True only when a valid development record was loaded from storage. */
  hasSavedRecord: boolean;
  hydrate: () => Promise<void>;
  completeTask: (taskId: CafeDevTaskId, completedAt?: string) => Promise<CafeDevCompletionResult>;
  setQuestSyncError: (message: string) => void;
  clearQuestSyncError: () => void;
}

const defaultPersistence: CafeDevPersistence = {
  load: () => dbGet<unknown>(CAFE_DEV_STORAGE_STORE, CAFE_DEV_STORAGE_KEY),
  save: (record) => trackedSave(CAFE_DEV_STORAGE_STORE, CAFE_DEV_STORAGE_KEY, record),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Store factory with injectable persistence for focused tests.
 * Production uses the shared `useCafeDev` singleton below.
 */
export function createCafeDevStore(persistence: CafeDevPersistence = defaultPersistence) {
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

  return create<CafeDevStore>((set, get) => {
    const loadProgress = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        if (raw === undefined) {
          set({
            progress: initialCafeDevProgress,
            hydrated: true,
            hasSavedRecord: false,
          });
          return;
        }

        const result = validateCafeDevSaveRecord(raw);
        if (!result.ok) {
          set({
            progress: initialCafeDevProgress,
            hydrated: true,
            hasSavedRecord: false,
            error: `Saved café development progress was invalid and was not loaded: ${result.reason}. Starting from Task 1.`,
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
          error: `Could not load café development progress: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    return {
      progress: initialCafeDevProgress,
      hydrated: false,
      loading: false,
      error: null,
      questSyncError: null,
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

      completeTask: (taskId, completedAt) =>
        enqueue(async () => {
          // A queued action always waits for hydration, so an early call can
          // never save initial state over an existing development record.
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason: "Your saved development progress could not be loaded. Reload and try again.",
            };
          }

          const current = get().progress;
          if (isCafeDevTaskComplete(current, taskId)) {
            return { ok: true, alreadyCompleted: true };
          }

          const next = completeCafeDevTask(current, taskId, completedAt);
          if (next === current) {
            return {
              ok: false,
              reason:
                "Development tasks must be completed in order. Finish the current task first.",
            };
          }

          try {
            const saved = await persistence.save(createCafeDevSaveRecord(next));
            if (!saved) {
              set({
                error:
                  "Could not save your development progress. Nothing was completed; run the tests again to retry.",
              });
              return {
                ok: false,
                reason:
                  "Could not save your development progress. Your tests were not applied; run the tests again to retry.",
              };
            }
          } catch (error) {
            const message = `Could not save café development progress: ${errorMessage(error)}`;
            set({ error: message });
            return {
              ok: false,
              reason: "Could not save your development progress. Run the tests again to retry.",
            };
          }

          // Commit only after a successful write so the UI cannot claim a task
          // that storage rejected.
          set({ progress: next, error: null, questSyncError: null, hasSavedRecord: true });
          return { ok: true, alreadyCompleted: false };
        }),

      setQuestSyncError: (message) => set({ questSyncError: message }),
      clearQuestSyncError: () => set({ questSyncError: null }),
    };
  });
}

export const useCafeDev = createCafeDevStore();

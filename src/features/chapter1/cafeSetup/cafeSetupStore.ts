import { create } from "zustand";
import { dbGet } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";
import type { CafeSetupTaskId } from "./cafeSetupTasks";
import {
  completeCafeSetupTask,
  createCafeSetupSaveRecord,
  initialCafeSetupProgress,
  isCafeSetupTaskComplete,
  markCafeSetupWorkflow,
  validateCafeSetupSaveRecord,
  type CafeSetupProgress,
  type CafeSetupSaveRecord,
} from "./cafeSetupProgress";

/**
 * Isolated record inside the existing `progress` object store. Chapter 1
 * quests, GigBoard applications, café milestones, ticket XP, and editor files
 * live under different keys and are never touched by setup saves.
 */
export const CAFE_SETUP_STORAGE_STORE = "progress";
export const CAFE_SETUP_STORAGE_KEY = "chapter1-cafe-project-setup";

export type CafeSetupCompletionResult =
  { ok: true; alreadyCompleted: boolean } | { ok: false; reason: string };

export interface CafeSetupPersistence {
  load: () => Promise<unknown>;
  save: (record: CafeSetupSaveRecord) => Promise<boolean>;
}

export interface CafeSetupStore {
  progress: CafeSetupProgress;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  /** True only when a valid setup record was loaded from storage. */
  hasSavedRecord: boolean;
  hydrate: () => Promise<void>;
  completeTask: (
    taskId: CafeSetupTaskId,
    completedAt?: string,
  ) => Promise<CafeSetupCompletionResult>;
}

const defaultPersistence: CafeSetupPersistence = {
  load: () => dbGet<unknown>(CAFE_SETUP_STORAGE_STORE, CAFE_SETUP_STORAGE_KEY),
  save: (record) => trackedSave(CAFE_SETUP_STORAGE_STORE, CAFE_SETUP_STORAGE_KEY, record),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Store factory with injectable persistence for focused tests.
 * Production uses the shared `useCafeSetup` singleton below.
 */
export function createCafeSetupStore(persistence: CafeSetupPersistence = defaultPersistence) {
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

  return create<CafeSetupStore>((set, get) => {
    const loadProgress = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        if (raw === undefined) {
          set({
            progress: initialCafeSetupProgress,
            hydrated: true,
            hasSavedRecord: false,
          });
          return;
        }

        const result = validateCafeSetupSaveRecord(raw);
        if (!result.ok) {
          set({
            progress: initialCafeSetupProgress,
            hydrated: true,
            hasSavedRecord: false,
            error: `Saved café project setup was invalid and was not loaded: ${result.reason}. Starting from Task 1.`,
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
          error: `Could not load café project setup: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    return {
      progress: initialCafeSetupProgress,
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

      completeTask: (taskId, completedAt) =>
        enqueue(async () => {
          // A queued action always waits for hydration, so an early call can
          // never save initial state over an existing setup record.
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason: "Your saved project setup could not be loaded. Reload and try again.",
            };
          }

          const current = get().progress;
          if (isCafeSetupTaskComplete(current, taskId)) {
            return { ok: true, alreadyCompleted: true };
          }

          const advanced = completeCafeSetupTask(current, taskId, completedAt);
          if (advanced === current) {
            return {
              ok: false,
              reason: "Setup tasks must be completed in order. Finish the current task first.",
            };
          }

          // Finishing setup in the real flow opts this save into the four-task
          // development project. Pure fixtures and older saves keep no marker.
          const next = markCafeSetupWorkflow(advanced, "development");

          try {
            const saved = await persistence.save(createCafeSetupSaveRecord(next));
            if (!saved) {
              set({
                error:
                  "Could not save your project setup progress. Nothing was completed; try checking the task again.",
              });
              return {
                ok: false,
                reason:
                  "Could not save your project setup progress. The task was not completed; try again.",
              };
            }
          } catch (error) {
            const message = `Could not save café project setup: ${errorMessage(error)}`;
            set({ error: message });
            return {
              ok: false,
              reason: "Could not save your project setup progress. Try checking the task again.",
            };
          }

          // Commit only after a successful write.
          set({
            progress: next,
            error: null,
            hasSavedRecord: true,
          });
          return { ok: true, alreadyCompleted: false };
        }),
    };
  });
}

export const useCafeSetup = createCafeSetupStore();

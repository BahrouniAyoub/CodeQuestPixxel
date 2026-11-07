import { create } from "zustand";
import { dbGet } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";
import type { CafeMilestoneId } from "./cafeMilestones";
import {
  completeCafeMilestone,
  createCafeMilestoneSaveRecord,
  initialCafeMilestoneProgress,
  isCafeMilestoneComplete,
  validateCafeMilestoneSaveRecord,
  type CafeMilestoneProgress,
  type CafeMilestoneSaveRecord,
} from "./cafeMilestoneProgress";

/**
 * Isolated record inside the existing `progress` object store. Chapter 1
 * quests, GigBoard applications, ticket XP, and editor files live under
 * different keys and are never touched by milestone saves.
 */
export const CAFE_MILESTONE_STORAGE_STORE = "progress";
export const CAFE_MILESTONE_STORAGE_KEY = "chapter1-cafe-milestones";

export type CafeMilestoneCompletionResult =
  { ok: true; alreadyCompleted: boolean } | { ok: false; reason: string };

export interface CafeMilestonePersistence {
  load: () => Promise<unknown>;
  save: (record: CafeMilestoneSaveRecord) => Promise<boolean>;
}

export interface CafeMilestoneStore {
  progress: CafeMilestoneProgress;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  /** Set when milestone progress saved but CH1-05 could not be updated. */
  questSyncError: string | null;
  hydrate: () => Promise<void>;
  completeMilestone: (
    milestoneId: CafeMilestoneId,
    completedAt?: string,
  ) => Promise<CafeMilestoneCompletionResult>;
  setQuestSyncError: (message: string) => void;
  clearQuestSyncError: () => void;
}

const defaultPersistence: CafeMilestonePersistence = {
  load: () => dbGet<unknown>(CAFE_MILESTONE_STORAGE_STORE, CAFE_MILESTONE_STORAGE_KEY),
  save: (record) => trackedSave(CAFE_MILESTONE_STORAGE_STORE, CAFE_MILESTONE_STORAGE_KEY, record),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Store factory with injectable persistence for focused tests.
 * Production uses the shared `useCafeMilestones` singleton below.
 */
export function createCafeMilestoneStore(
  persistence: CafeMilestonePersistence = defaultPersistence,
) {
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

  return create<CafeMilestoneStore>((set, get) => {
    const loadProgress = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        if (raw === undefined) {
          set({ progress: initialCafeMilestoneProgress, hydrated: true });
          return;
        }

        const result = validateCafeMilestoneSaveRecord(raw);
        if (!result.ok) {
          set({
            progress: initialCafeMilestoneProgress,
            hydrated: true,
            error: `Saved café milestone progress was invalid and was not loaded: ${result.reason}. Starting from milestone 1.`,
          });
          return;
        }

        set({ progress: result.progress, hydrated: true });
      } catch (error) {
        // Keep hydrated=false so a player action cannot overwrite a save we
        // could not read. hydrate() may be retried later.
        set({
          hydrated: false,
          error: `Could not load café milestone progress: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    return {
      progress: initialCafeMilestoneProgress,
      hydrated: false,
      loading: false,
      error: null,
      questSyncError: null,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (!hydrationPromise) {
          hydrationPromise = loadProgress().finally(() => {
            hydrationPromise = null;
          });
        }
        return hydrationPromise;
      },

      completeMilestone: (milestoneId, completedAt) =>
        enqueue(async () => {
          // A queued action always waits for hydration, so an early call can
          // never save initial state over an existing milestone record.
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason: "Your saved milestone progress could not be loaded. Reload and try again.",
            };
          }

          const current = get().progress;
          if (isCafeMilestoneComplete(current, milestoneId)) {
            return { ok: true, alreadyCompleted: true };
          }

          const next = completeCafeMilestone(current, milestoneId, completedAt);
          if (next === current) {
            return {
              ok: false,
              reason: "Milestones must be completed in order. Finish the current milestone first.",
            };
          }

          try {
            const saved = await persistence.save(createCafeMilestoneSaveRecord(next));
            if (!saved) {
              set({
                error:
                  "Could not save your milestone progress. Nothing was completed; run the tests again to retry.",
              });
              return {
                ok: false,
                reason:
                  "Could not save your milestone progress. Your tests were not applied; run the tests again to retry.",
              };
            }
          } catch (error) {
            const message = `Could not save café milestone progress: ${errorMessage(error)}`;
            set({ error: message });
            return {
              ok: false,
              reason: "Could not save your milestone progress. Run the tests again to retry.",
            };
          }

          // Commit only after a successful write so the UI cannot claim a
          // milestone that storage rejected.
          set({ progress: next, error: null, questSyncError: null });
          return { ok: true, alreadyCompleted: false };
        }),

      setQuestSyncError: (message) => set({ questSyncError: message }),
      clearQuestSyncError: () => set({ questSyncError: null }),
    };
  });
}

export const useCafeMilestones = createCafeMilestoneStore();

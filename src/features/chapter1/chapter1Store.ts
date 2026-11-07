import { create } from "zustand";
import { dbGet } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";
import {
  completeChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "./chapter1Progress";
import type { Chapter1QuestId } from "./chapter1Quests";
import {
  createChapter1SaveRecord,
  validateChapter1SaveRecord,
  type Chapter1SaveRecord,
} from "./chapter1Validation";

/** Use the existing progress store, but a Chapter 1-specific record key. */
export const CHAPTER1_STORAGE_STORE = "progress";
export const CHAPTER1_STORAGE_KEY = "chapter1";

export interface Chapter1Persistence {
  load: () => Promise<unknown>;
  save: (record: Chapter1SaveRecord) => Promise<boolean>;
}

export interface Chapter1Store {
  progress: Chapter1Progress;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  /** Returns true only when a valid transition was saved successfully. */
  completeQuest: (questId: Chapter1QuestId) => Promise<boolean>;
}

const defaultPersistence: Chapter1Persistence = {
  load: () => dbGet<unknown>(CHAPTER1_STORAGE_STORE, CHAPTER1_STORAGE_KEY),
  save: (record) => trackedSave(CHAPTER1_STORAGE_STORE, CHAPTER1_STORAGE_KEY, record),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Store factory with injectable persistence for focused tests.
 * Production uses the shared `useChapter1` singleton below.
 */
export function createChapter1Store(persistence: Chapter1Persistence = defaultPersistence) {
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

  return create<Chapter1Store>((set, get) => {
    const loadProgress = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        if (raw === undefined) {
          set({ progress: initialChapter1Progress, hydrated: true });
          return;
        }

        const result = validateChapter1SaveRecord(raw);
        if (!result.ok) {
          set({
            progress: initialChapter1Progress,
            hydrated: true,
            error: `Saved Chapter 1 progress was invalid and was not loaded: ${result.reason}. Starting from the beginning of Chapter 1.`,
          });
          return;
        }

        set({ progress: result.progress, hydrated: true });
      } catch (error) {
        // Keep hydrated=false so a player action cannot overwrite a save we
        // could not read. hydrate() may be retried later.
        set({
          hydrated: false,
          error: `Could not load Chapter 1 progress: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    return {
      progress: initialChapter1Progress,
      hydrated: false,
      loading: false,
      error: null,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (!hydrationPromise) {
          hydrationPromise = loadProgress().finally(() => {
            hydrationPromise = null;
          });
        }
        return hydrationPromise;
      },

      completeQuest: (questId) =>
        enqueue(async () => {
          // A queued action always waits for hydration, so an early call can
          // never save initial state over an existing Chapter 1 record.
          await get().hydrate();
          if (!get().hydrated) return false;

          const current = get().progress;
          const next = completeChapter1Quest(current, questId);
          if (next === current) return false;

          let saved = false;
          try {
            saved = await persistence.save(createChapter1SaveRecord(next));
          } catch (error) {
            set({ error: `Could not save Chapter 1 progress: ${errorMessage(error)}` });
            return false;
          }

          if (!saved) {
            set({
              error:
                "Could not save Chapter 1 progress. Your last quest completion was not applied; you can retry it.",
            });
            return false;
          }

          // Commit only after a successful write. On failure the previous
          // in-memory state remains, so retrying the same quest is valid.
          set({ progress: next, error: null });
          return true;
        }),
    };
  });
}

export const useChapter1 = createChapter1Store();

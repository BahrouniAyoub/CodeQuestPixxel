import { create } from "zustand";
import { dbGet } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";
import {
  approveCafeSubmission,
  createCafeSubmissionSaveRecord,
  validateCafeSubmissionSaveRecord,
  type CafeSubmissionRecord,
  type CafeSubmissionSaveRecord,
} from "./cafeSubmission";

/**
 * Isolated record inside the existing `progress` object store. Café development,
 * documentation, Chapter 1 quests, GigBoard applications, ticket XP, and Mail
 * live under different keys and are never touched here.
 */
export const CAFE_SUBMISSION_STORAGE_STORE = "progress";
export const CAFE_SUBMISSION_STORAGE_KEY = "chapter1-cafe-project-submission";

export type CafeSubmissionMutationResult =
  | { ok: true; created: boolean }
  | { ok: false; reason: string };

export type CafeApprovalMutationResult =
  | { ok: true; created: boolean }
  | { ok: false; reason: string };

export interface CafeSubmissionPersistence {
  load: () => Promise<unknown>;
  save: (record: CafeSubmissionSaveRecord) => Promise<boolean>;
}

export interface CafeSubmissionStore {
  submission: CafeSubmissionRecord | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  /** Persist the first snapshot. A second submission never overwrites it. */
  submit: (record: CafeSubmissionRecord) => Promise<CafeSubmissionMutationResult>;
  /** Mark the stored snapshot approved. Idempotent across reloads and retries. */
  approve: (reviewedAt?: string) => Promise<CafeApprovalMutationResult>;
}

const defaultPersistence: CafeSubmissionPersistence = {
  load: () => dbGet<unknown>(CAFE_SUBMISSION_STORAGE_STORE, CAFE_SUBMISSION_STORAGE_KEY),
  save: (record) => trackedSave(CAFE_SUBMISSION_STORAGE_STORE, CAFE_SUBMISSION_STORAGE_KEY, record),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Store factory with injectable persistence for focused tests. Production uses
 * the shared `useCafeSubmission` singleton.
 */
export function createCafeSubmissionStore(
  persistence: CafeSubmissionPersistence = defaultPersistence,
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

  return create<CafeSubmissionStore>((set, get) => {
    const persist = async (record: CafeSubmissionRecord | null): Promise<boolean> => {
      try {
        return await persistence.save(createCafeSubmissionSaveRecord(record));
      } catch (error) {
        set({ error: `Could not save the café submission: ${errorMessage(error)}` });
        return false;
      }
    };

    const loadSubmission = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        const result = validateCafeSubmissionSaveRecord(raw);
        if (!result.ok) {
          // Keep hydrated=true so a player can submit again, but never load a
          // snapshot whose fingerprints or lifecycle fields are inconsistent.
          set({
            submission: null,
            hydrated: true,
            error: `Saved café submission was invalid and was not loaded: ${result.reason}.`,
          });
          return;
        }
        set({ submission: result.record, hydrated: true, error: null });
      } catch (error) {
        // Keep hydrated=false so an action cannot overwrite a save we could not
        // read. hydrate() may be retried later.
        set({
          hydrated: false,
          error: `Could not load the café submission: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    return {
      submission: null,
      hydrated: false,
      loading: false,
      error: null,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (!hydrationPromise) {
          hydrationPromise = loadSubmission().finally(() => {
            hydrationPromise = null;
          });
        }
        return hydrationPromise;
      },

      submit: (record) =>
        enqueue(async () => {
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false as const,
              reason: "Your saved submission could not be loaded. Reload and try again.",
            };
          }

          // Duplicate prevention happens before any write. The immutable first
          // snapshot wins even if the player confirms the flow a second time.
          if (get().submission !== null) return { ok: true as const, created: false };

          if (!(await persist(record))) {
            set({
              error: "Could not save your submission. Nothing was sent; confirm again to retry.",
            });
            return {
              ok: false as const,
              reason: "Could not save your submission. Confirm again to retry.",
            };
          }

          set({ submission: record, error: null });
          return { ok: true as const, created: true };
        }),

      approve: (reviewedAt) =>
        enqueue(async () => {
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false as const,
              reason: "Your saved submission could not be loaded. Reload and try again.",
            };
          }

          const current = get().submission;
          if (current === null) {
            return { ok: false as const, reason: "There is no submitted project to approve." };
          }
          if (current.reviewStatus === "approved") return { ok: true as const, created: false };

          const approved = approveCafeSubmission(current, reviewedAt);
          if (approved === null) {
            return { ok: false as const, reason: "The review timestamp was invalid. Try again." };
          }
          if (!(await persist(approved))) {
            set({
              error: "Could not save the client approval. Check the client response again to retry.",
            });
            return {
              ok: false as const,
              reason: "Could not save the client approval. Check the response again to retry.",
            };
          }

          set({ submission: approved, error: null });
          return { ok: true as const, created: true };
        }),
    };
  });
}

export const useCafeSubmission = createCafeSubmissionStore();

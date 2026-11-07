import { create } from "zustand";
import { dbGet } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";
import {
  ALEX_ACCEPTANCE_MESSAGE,
  createApplicationSaveRecord,
  validateApplicationSaveRecord,
  validateProposal,
  type GigboardApplication,
  type GigboardApplicationSaveRecord,
} from "./data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "./data/gigboardJobs";

/**
 * The café application lives in the existing `progress` object store under an
 * isolated key. Ticket/XP (`progress/state`) and Chapter 1 (`progress/chapter1`)
 * records are never touched.
 */
export const GIGBOARD_APPLICATION_STORAGE_STORE = "progress";
export const GIGBOARD_APPLICATION_STORAGE_KEY = "gigboard-application-cafe-calculator";

export type GigboardApplicationMutationResult = { ok: true } | { ok: false; reason: string };

export interface GigboardApplicationPersistence {
  load: () => Promise<unknown>;
  save: (record: GigboardApplicationSaveRecord) => Promise<boolean>;
}

export interface GigboardApplicationStore {
  application: GigboardApplication | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  /** Save one proposal for the café job. Resolves ok only after IndexedDB accepts it. */
  submitApplication: (proposal: string) => Promise<GigboardApplicationMutationResult>;
  /** Deterministic scripted client acceptance. Idempotent once accepted. */
  acceptApplication: () => Promise<GigboardApplicationMutationResult>;
}

const defaultPersistence: GigboardApplicationPersistence = {
  load: () => dbGet<unknown>(GIGBOARD_APPLICATION_STORAGE_STORE, GIGBOARD_APPLICATION_STORAGE_KEY),
  save: (record) =>
    trackedSave(GIGBOARD_APPLICATION_STORAGE_STORE, GIGBOARD_APPLICATION_STORAGE_KEY, record),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function submittedApplication(proposal: string): GigboardApplication {
  return {
    jobId: CAFE_CALCULATOR_JOB_ID,
    proposal,
    status: "submitted",
    submittedAt: new Date().toISOString(),
    acceptedAt: null,
    acceptanceMessage: null,
  };
}

function acceptedApplication(application: GigboardApplication): GigboardApplication {
  return {
    ...application,
    status: "accepted",
    acceptedAt: new Date().toISOString(),
    acceptanceMessage: ALEX_ACCEPTANCE_MESSAGE,
  };
}

/**
 * Store factory with injectable persistence for focused tests.
 * Production uses the shared `useGigboardApplication` singleton below.
 */
export function createGigboardApplicationStore(
  persistence: GigboardApplicationPersistence = defaultPersistence,
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

  return create<GigboardApplicationStore>((set, get) => {
    const loadApplication = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        if (raw === undefined) {
          set({ application: null, hydrated: true });
          return;
        }

        const result = validateApplicationSaveRecord(raw);
        if (!result.ok) {
          set({
            application: null,
            hydrated: true,
            error: `Saved GigBoard application was invalid and was not loaded: ${result.reason}. You can submit a fresh application.`,
          });
          return;
        }

        set({ application: result.application, hydrated: true });
      } catch (error) {
        // Keep hydrated=false so a player action cannot overwrite a save we
        // could not read. hydrate() can be retried later.
        set({
          hydrated: false,
          error: `Could not load your GigBoard application: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    const saveApplication = async (
      next: GigboardApplication,
    ): Promise<GigboardApplicationMutationResult> => {
      try {
        const saved = await persistence.save(createApplicationSaveRecord(next));
        if (!saved) {
          set({
            error:
              "Could not save your GigBoard application. Nothing was submitted; you can try again.",
          });
          return { ok: false, reason: "Could not save your application. Please try again." };
        }
      } catch (error) {
        set({ error: `Could not save your GigBoard application: ${errorMessage(error)}` });
        return { ok: false, reason: "Could not save your application. Please try again." };
      }

      // Commit only after a successful write so UI cannot claim a save that
      // storage rejected.
      set({ application: next, error: null });
      return { ok: true };
    };

    return {
      application: null,
      hydrated: false,
      loading: false,
      error: null,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (!hydrationPromise) {
          hydrationPromise = loadApplication().finally(() => {
            hydrationPromise = null;
          });
        }
        return hydrationPromise;
      },

      submitApplication: (proposal) =>
        enqueue(async () => {
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason: "Your saved GigBoard data could not be loaded. Reload and try again.",
            };
          }
          if (get().application) {
            return {
              ok: false,
              reason: "You have already applied to the café calculator project.",
            };
          }

          const validation = validateProposal(proposal);
          if (!validation.ok) return { ok: false, reason: validation.reason };

          return saveApplication(submittedApplication(validation.proposal));
        }),

      acceptApplication: () =>
        enqueue(async () => {
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason: "Your saved GigBoard data could not be loaded. Reload and try again.",
            };
          }

          const current = get().application;
          if (!current) {
            return {
              ok: false,
              reason: "There is no application to update. Submit a proposal first.",
            };
          }
          if (current.status === "accepted") return { ok: true };

          return saveApplication(acceptedApplication(current));
        }),
    };
  });
}

export const useGigboardApplication = createGigboardApplicationStore();

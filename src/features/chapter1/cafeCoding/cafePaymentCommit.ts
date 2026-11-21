/**
 * Production storage adapter for the café payment.
 *
 * The payment guard record and the Chapter 1 wallet/quest record share the
 * existing `progress` IndexedDB object store, so they are written in one
 * read/modify/write transaction. A valid existing payment is never replaced.
 */
import {
  CHAPTER1_STORAGE_KEY,
  CHAPTER1_STORAGE_STORE,
} from "@/features/chapter1/chapter1Store";
import {
  dbAtomic,
  type DbAtomicWrite,
  type DbAtomicSuccess,
} from "@/services/persistence/db";
import { trackedTransaction } from "@/services/persistence/saveStatus";
import {
  CAFE_PAYMENT_STORAGE_KEY,
  CAFE_PAYMENT_STORAGE_STORE,
  createCafePaymentSaveRecord,
  evaluateCafePaymentEligibility,
  planCafePaymentCommit,
  readCommittedChapterProgress,
  validateCafePaymentSaveRecord,
  type CafePaymentRecord,
} from "./cafePayment";
import type { CafeWorkflow } from "./cafeWorkflow";
import type { CafeSubmissionRecord } from "./cafeSubmission";
import type { Chapter1Progress } from "@/features/chapter1/chapter1Progress";

type CommitPlanResult =
  | {
      readonly ok: true;
      readonly status: "committed";
      readonly payment: CafePaymentRecord;
      readonly chapter: Chapter1Progress;
    }
  | {
      readonly ok: true;
      readonly status: "duplicate";
      readonly payment: CafePaymentRecord;
      readonly chapter: Chapter1Progress | null;
    };

export type CafePaymentCommitResult =
  | CommitPlanResult
  | { readonly ok: false; readonly reason: string; readonly conflict: boolean };

export interface CafePaymentCommitInput {
  readonly payment: CafePaymentRecord;
  readonly submission: CafeSubmissionRecord;
  readonly applicationAccepted: boolean;
  readonly workflow: CafeWorkflow;
}

function failure(reason: string, conflict = false): CafePaymentCommitResult {
  return { ok: false, reason, conflict };
}

/** Use the same object store for both records so the credit is truly atomic. */
export async function commitCafePaymentToStorage(
  input: CafePaymentCommitInput,
): Promise<CafePaymentCommitResult> {
  let outcome;
  try {
    outcome = await trackedTransaction(() =>
      dbAtomic<CommitPlanResult>(
        CAFE_PAYMENT_STORAGE_STORE,
        [CAFE_PAYMENT_STORAGE_KEY, CHAPTER1_STORAGE_KEY],
        (records): DbAtomicSuccess<CommitPlanResult> | { ok: false; reason: string } => {
          const rawPayment = records.get(CAFE_PAYMENT_STORAGE_KEY);
          if (rawPayment !== undefined) {
            const existing = validateCafePaymentSaveRecord(rawPayment);
            if (!existing.ok) {
              return { ok: false, reason: `Saved payment is invalid: ${existing.reason}` };
            }
            if (existing.payment === null) {
              return { ok: false, reason: "The saved payment record is empty and was not changed." };
            }
            if (existing.payment.transactionId !== input.payment.transactionId) {
              return { ok: false, reason: "A different payment is already recorded for this save." };
            }
            return {
              ok: true,
              writes: [],
              result: {
                ok: true,
                status: "duplicate",
                payment: existing.payment,
                chapter: readCommittedChapterProgress(records.get(CHAPTER1_STORAGE_KEY)),
              },
            };
          }

          const rawChapter = records.get(CHAPTER1_STORAGE_KEY);
          if (rawChapter === undefined) {
            return { ok: false, reason: "Chapter 1 progress is missing and could not be updated." };
          }
          const chapter = readCommittedChapterProgress(rawChapter);
          if (chapter === null) {
            return {
              ok: false,
              reason: "Saved Chapter 1 progress was invalid and was not changed.",
            };
          }

          const eligibility = evaluateCafePaymentEligibility({
            applicationHydrated: true,
            applicationAccepted: input.applicationAccepted,
            chapterHydrated: true,
            chapter,
            submissionHydrated: true,
            submission: input.submission,
            paymentHydrated: true,
            payment: null,
            paymentInvalid: false,
            workflow: input.workflow,
          });
          if (!eligibility.eligible) return { ok: false, reason: eligibility.reason };

          const planned = planCafePaymentCommit(chapter, input.payment);
          if (planned === null) {
            return { ok: false, reason: "The payment could not be planned from this save." };
          }

          const writes: DbAtomicWrite[] = [
            {
              key: CAFE_PAYMENT_STORAGE_KEY,
              value: createCafePaymentSaveRecord(planned.payment),
              mode: "add",
            },
            { key: CHAPTER1_STORAGE_KEY, value: planned.chapterSave, mode: "put" },
          ];
          return {
            ok: true,
            writes,
            result: {
              ok: true,
              status: "committed",
              payment: planned.payment,
              chapter: planned.chapter,
            },
          };
        },
      ),
    );
  } catch (error) {
    return failure(
      `Could not save the café payment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!outcome.ok) return failure(outcome.reason, outcome.conflict);
  return outcome.result;
}

/**
 * Pure café payment record and eligibility rules for Step 8F.
 *
 * The only in-game wallet in this build is `Chapter1Progress.money`, persisted
 * with Chapter 1 progress. A payment is usable only when an approved, immutable
 * submission exists and the player is explicitly on CH1-07. The peer store and
 * IndexedDB wiring live in `cafePaymentStore.ts` and `cafePaymentCommit.ts`.
 */
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import type { Chapter1QuestId } from "@/features/chapter1/chapter1Quests";
import {
  createChapter1SaveRecord,
  validateChapter1SaveRecord,
  type Chapter1SaveRecord,
} from "@/features/chapter1/chapter1Validation";
import type { CafeWorkflow } from "./cafeWorkflow";
import {
  CAFE_SUBMISSION_SAVE_VERSION,
  validateCafeSubmissionSaveRecord,
  type CafeSubmissionRecord,
} from "./cafeSubmission";

export const CAFE_PAYMENT_SAVE_VERSION = 1;
export const CAFE_PAYMENT_STORAGE_STORE = "progress";
export const CAFE_PAYMENT_STORAGE_KEY = "chapter1-cafe-project-payment";
export const CAFE_PAYMENT_AMOUNT = 50;
export const CAFE_PAYMENT_CURRENCY = "USD";
export const CAFE_PAYMENT_STATUS = "paid" as const;

export type CafePaymentStatus = typeof CAFE_PAYMENT_STATUS;

export interface CafePaymentRecord {
  readonly paymentId: string;
  readonly jobId: string;
  readonly submissionId: string;
  readonly amount: number;
  readonly currency: string;
  readonly claimedAt: string;
  readonly status: CafePaymentStatus;
  /** Stable one-time transaction ID derived from the approved submission. */
  readonly transactionId: string;
}

export interface CafePaymentSaveRecord {
  readonly version: typeof CAFE_PAYMENT_SAVE_VERSION;
  readonly payment: CafePaymentRecord | null;
}

export type CafePaymentValidationResult =
  | { ok: true; payment: CafePaymentRecord | null }
  | { ok: false; reason: string };

export interface CafePaymentRecordInput {
  readonly jobId: string;
  readonly submissionId: string;
  readonly claimedAt: string;
}

function invalid(reason: string): CafePaymentValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown, maxLength = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

/** Stable identifiers derived from the approved submission, never from time. */
export function cafePaymentTransactionId(submissionId: string): string {
  return `cafe-payment-${submissionId}`;
}

export function cafePaymentId(submissionId: string): string {
  return `pay-${submissionId}`;
}

/** Build the one $50 record associated with an approved submission. */
export function createCafePaymentRecord(
  input: CafePaymentRecordInput,
): CafePaymentRecord | null {
  if (input.jobId !== CAFE_CALCULATOR_JOB_ID) return null;
  if (!isNonEmptyString(input.submissionId)) return null;
  if (!isIsoTimestamp(input.claimedAt)) return null;

  return {
    paymentId: cafePaymentId(input.submissionId),
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: input.submissionId,
    amount: CAFE_PAYMENT_AMOUNT,
    currency: CAFE_PAYMENT_CURRENCY,
    claimedAt: input.claimedAt,
    status: CAFE_PAYMENT_STATUS,
    transactionId: cafePaymentTransactionId(input.submissionId),
  };
}

export function createCafePaymentSaveRecord(
  payment: CafePaymentRecord | null,
): CafePaymentSaveRecord {
  return {
    version: CAFE_PAYMENT_SAVE_VERSION,
    payment: payment === null ? null : { ...payment },
  };
}

function validatePayment(raw: unknown): CafePaymentValidationResult {
  if (!isRecord(raw)) return invalid("payment is not an object");
  if (raw["paymentId"] !== cafePaymentId(String(raw["submissionId"] ?? ""))) {
    return invalid("payment has an invalid ID");
  }
  if (raw["jobId"] !== CAFE_CALCULATOR_JOB_ID) return invalid("payment has an invalid job ID");
  if (!isNonEmptyString(raw["submissionId"])) return invalid("payment has an invalid submission ID");
  if (raw["amount"] !== CAFE_PAYMENT_AMOUNT) return invalid("payment amount is not $50");
  if (raw["currency"] !== CAFE_PAYMENT_CURRENCY) return invalid("payment currency is not USD");
  if (!isIsoTimestamp(raw["claimedAt"])) return invalid("payment has an invalid claimed timestamp");
  if (raw["status"] !== CAFE_PAYMENT_STATUS) return invalid("payment has an invalid status");
  if (raw["transactionId"] !== cafePaymentTransactionId(raw["submissionId"])) {
    return invalid("payment has a mismatched transaction ID");
  }

  return {
    ok: true,
    payment: {
      paymentId: raw["paymentId"] as string,
      jobId: CAFE_CALCULATOR_JOB_ID,
      submissionId: raw["submissionId"] as string,
      amount: CAFE_PAYMENT_AMOUNT,
      currency: CAFE_PAYMENT_CURRENCY,
      claimedAt: raw["claimedAt"] as string,
      status: CAFE_PAYMENT_STATUS,
      transactionId: raw["transactionId"] as string,
    },
  };
}

/** Validate untrusted IndexedDB data before it can become payment state. */
export function validateCafePaymentSaveRecord(raw: unknown): CafePaymentValidationResult {
  if (raw === undefined || raw === null) return { ok: true, payment: null };
  if (!isRecord(raw)) return invalid("save record is not an object");
  if (raw["version"] !== CAFE_PAYMENT_SAVE_VERSION) return invalid("unsupported save version");

  const payment = raw["payment"];
  if (payment === undefined || payment === null) return { ok: true, payment: null };
  return validatePayment(payment);
}

export interface CafePaymentEligibilityInput {
  readonly applicationHydrated: boolean;
  readonly applicationAccepted: boolean;
  readonly chapterHydrated: boolean;
  readonly chapter: Chapter1Progress;
  readonly submissionHydrated: boolean;
  readonly submission: CafeSubmissionRecord | null;
  readonly paymentHydrated: boolean;
  readonly payment: CafePaymentRecord | null;
  /** A raw payment record existed but could not be validated. Never overwrite it. */
  readonly paymentInvalid: boolean;
  readonly workflow: CafeWorkflow;
}

export interface CafePaymentEligibility {
  readonly eligible: boolean;
  readonly reason: string;
}

function ineligible(reason: string): CafePaymentEligibility {
  return { eligible: false, reason };
}

/**
 * All payment guards in one pure check. Submission validity is recomputed here
 * so an in-memory tamper cannot authorize the $50 credit.
 */
export function evaluateCafePaymentEligibility(
  input: CafePaymentEligibilityInput,
): CafePaymentEligibility {
  if (
    !input.applicationHydrated ||
    !input.chapterHydrated ||
    !input.submissionHydrated ||
    !input.paymentHydrated
  ) {
    return ineligible("Your saved progress is still loading. Try again in a moment.");
  }
  if (input.paymentInvalid) {
    return ineligible(
      "A saved café payment record could not be validated. It was not changed or paid again.",
    );
  }
  if (input.payment !== null) {
    return ineligible("The $50 café payment has already been claimed.");
  }
  if (!input.applicationAccepted) {
    return ineligible("Only the accepted café project can be paid.");
  }
  if (input.workflow !== "development") {
    return ineligible("This payment is only available for the four-task café project.");
  }

  const submissionValidation = validateCafeSubmissionSaveRecord({
    version: CAFE_SUBMISSION_SAVE_VERSION,
    submission: input.submission,
  });
  if (!submissionValidation.ok || submissionValidation.record === null) {
    return ineligible(
      submissionValidation.ok
        ? "Submit the café project before claiming payment."
        : `The submitted snapshot failed validation: ${submissionValidation.reason}`,
    );
  }
  if (submissionValidation.record.reviewStatus !== "approved") {
    return ineligible("Alex Morgan has not approved the submitted project yet.");
  }

  if (!input.chapter.completedQuestIds.includes("CH1-06")) {
    return ineligible("Finish delivering the approved project (CH1-06) before claiming payment.");
  }
  if (getCurrentChapter1Quest(input.chapter)?.id !== "CH1-07") {
    return ineligible("The first paycheck quest is not active.");
  }
  if (input.chapter.paymentClaimed || input.chapter.money !== 0) {
    return ineligible("Chapter 1 already records a payment. Reload and check the payment status.");
  }

  return { eligible: true, reason: "The approved café project is ready for payment." };
}

export interface CafePaymentCommitPlan {
  readonly payment: CafePaymentRecord;
  readonly paymentSave: CafePaymentSaveRecord;
  readonly chapter: Chapter1Progress;
  readonly chapterSave: Chapter1SaveRecord;
}

/**
 * Compute the single state transition that credits the wallet and completes
 * CH1-07. The caller must commit the two records atomically.
 */
export function planCafePaymentCommit(
  chapter: Chapter1Progress,
  payment: CafePaymentRecord,
): CafePaymentCommitPlan | null {
  if (chapter.paymentClaimed || chapter.money !== 0) return null;
  if (
    getCurrentChapter1Quest(chapter)?.id !== "CH1-07" ||
    !chapter.completedQuestIds.includes("CH1-06")
  ) {
    return null;
  }

  const next = completeChapter1Quest(chapter, "CH1-07");
  if (next === chapter) return null;
  if (
    next.money !== CAFE_PAYMENT_AMOUNT ||
    !next.paymentClaimed ||
    !next.completedQuestIds.includes("CH1-07") ||
    getCurrentChapter1Quest(next)?.id !== "CH1-08"
  ) {
    return null;
  }

  return {
    payment,
    paymentSave: createCafePaymentSaveRecord(payment),
    chapter: next,
    chapterSave: createChapter1SaveRecord(next),
  };
}

/** Re-read a committed chapter record without trusting caller-owned arrays. */
export function readCommittedChapterProgress(raw: unknown): Chapter1Progress | null {
  const validation = validateChapter1SaveRecord(raw);
  return validation.ok ? validation.progress : null;
}

export function chapterPaymentQuestComplete(chapter: Chapter1Progress): boolean {
  return chapter.completedQuestIds.includes("CH1-07");
}

export type CafePaymentQuestState = "complete" | "active" | "invalid";

export function cafePaymentQuestState(
  chapter: Chapter1Progress,
): CafePaymentQuestState {
  if (chapterPaymentQuestComplete(chapter)) return "complete";
  const current: Chapter1QuestId | null = getCurrentChapter1Quest(chapter)?.id ?? null;
  return current === "CH1-07" ? "active" : "invalid";
}

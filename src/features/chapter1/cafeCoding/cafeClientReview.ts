/**
 * Deterministic café client review.
 *
 * Alex Morgan's approval is decided from the immutable submitted snapshot — no
 * AI, network call, timer, or later edit to the working files. The approval is
 * an explicit player action ("Check Client Response") and is safe to retry:
 * the status transition, the Mail message, and the CH1-06 quest step are each
 * idempotent.
 */
import { useChapter1, type Chapter1Store } from "@/features/chapter1/chapter1Store";
import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import {
  ALEX_PARTY,
  CAFE_MAIL_PROJECT_ID,
  CAFE_MAIL_THREAD_ID,
  PLAYER_PARTY,
  type MailMessage,
} from "@/features/mail/mailTypes";
import { useMail, type MailStore } from "@/features/mail/mailStore";
import {
  syncCafeDeliveryQuest,
  type CafeDeliveryQuestSyncInput,
  type CafeQuestSyncResult,
} from "./cafeQuestSync";
import {
  CAFE_SUBMISSION_SAVE_VERSION,
  cafeSubmittedFile,
  validateCafeSubmissionSaveRecord,
  type CafeSubmissionRecord,
} from "./cafeSubmission";
import { useCafeSubmission, type CafeSubmissionStore } from "./cafeSubmissionStore";

export const CAFE_APPROVAL_MESSAGE_ID = "mail-cafe-approval";
export const CAFE_APPROVAL_SUBJECT = "Café Calculator Approved";
export const CAFE_APPROVAL_BODY = `Hi! I've reviewed the café calculator and tested the application. The order totals, discount, and receipt all work as requested. Great job! I've approved your project.

Alex Morgan`;

export interface CafeReviewDecision {
  readonly approved: boolean;
  readonly reason: string;
}

/** Pure review: the submitted snapshot alone decides the deterministic result. */
export function evaluateCafeSubmissionReview(
  record: CafeSubmissionRecord | null,
): CafeReviewDecision {
  if (record === null) {
    return { approved: false, reason: "Submit your project before checking the client response." };
  }

  const validation = validateCafeSubmissionSaveRecord({
    version: CAFE_SUBMISSION_SAVE_VERSION,
    submission: record,
  });
  if (!validation.ok || validation.record === null) {
    return {
      approved: false,
      reason: validation.ok
        ? "The submitted snapshot could not be read."
        : `The submitted snapshot failed validation: ${validation.reason}`,
    };
  }

  const snapshot = validation.record;
  if (
    snapshot.reviewStatus === "awaiting-review" &&
    (cafeSubmittedFile(snapshot, "README.md") === undefined ||
      cafeSubmittedFile(snapshot, "calculator.py") === undefined ||
      cafeSubmittedFile(snapshot, "main.py") === undefined ||
      cafeSubmittedFile(snapshot, "PLAN.md") === undefined)
  ) {
    return { approved: false, reason: "The submitted snapshot is incomplete." };
  }

  return {
    approved: true,
    reason: "Alex Morgan approved the submitted café calculator snapshot.",
  };
}

/** The one deterministic approval email, with a stable ID for deduplication. */
export function createCafeApprovalMessage(createdAt: string): MailMessage {
  return {
    id: CAFE_APPROVAL_MESSAGE_ID,
    threadId: CAFE_MAIL_THREAD_ID,
    from: ALEX_PARTY,
    to: PLAYER_PARTY,
    subject: CAFE_APPROVAL_SUBJECT,
    body: CAFE_APPROVAL_BODY,
    createdAt,
    read: false,
    direction: "incoming",
    projectId: CAFE_MAIL_PROJECT_ID,
    scriptedResponseKind: "approval",
  };
}

interface SubmissionStoreLike {
  getState: () => Pick<
    CafeSubmissionStore,
    "submission" | "hydrated" | "error" | "hydrate" | "approve"
  >;
}

interface MailStoreLike {
  getState: () => Pick<MailStore, "messages" | "hydrated" | "error" | "hydrate" | "ensureMessage">;
}

interface ChapterStoreLike {
  getState: () => Pick<
    Chapter1Store,
    "progress" | "hydrated" | "error" | "hydrate" | "completeQuest"
  >;
}

export interface CafeClientReviewOptions {
  submissionStore?: SubmissionStoreLike;
  mailStore?: MailStoreLike;
  chapterStore?: ChapterStoreLike;
  now?: () => Date;
  syncQuest?: (input: CafeDeliveryQuestSyncInput) => Promise<CafeQuestSyncResult>;
}

export interface CafeClientReviewResult {
  readonly ok: boolean;
  readonly approved: boolean;
  readonly emailCreated: boolean;
  readonly questCompleted: boolean;
  readonly questRetryAvailable: boolean;
  readonly reason: string;
}

function failure(
  reason: string,
  options: Partial<CafeClientReviewResult> = {},
): CafeClientReviewResult {
  return {
    ok: false,
    approved: false,
    emailCreated: false,
    questCompleted: false,
    questRetryAvailable: false,
    reason,
    ...options,
  };
}

/**
 * Production review action. Each write is idempotent, so a failed Mail or quest
 * step can be retried without creating a second submission, email, or reward.
 */
export async function checkCafeClientResponse(
  options: CafeClientReviewOptions = {},
): Promise<CafeClientReviewResult> {
  const submissionStore = options.submissionStore ?? useCafeSubmission;
  const mailStore = options.mailStore ?? useMail;
  const chapterStore = options.chapterStore ?? useChapter1;

  await submissionStore.getState().hydrate();
  await mailStore.getState().hydrate();
  await chapterStore.getState().hydrate();

  if (!submissionStore.getState().hydrated) {
    return failure(
      submissionStore.getState().error ?? "Your submission could not be loaded. Reload and try again.",
    );
  }
  if (!mailStore.getState().hydrated) {
    return failure(mailStore.getState().error ?? "Mail could not be loaded. Reload and try again.");
  }
  if (!chapterStore.getState().hydrated) {
    return failure(
      chapterStore.getState().error ?? "Chapter 1 could not be loaded. Reload and try again.",
    );
  }

  const submitted = submissionStore.getState().submission;
  const decision = evaluateCafeSubmissionReview(submitted);
  if (!decision.approved) return failure(decision.reason);

  const now = options.now ?? (() => new Date());
  const reviewedAt = submitted?.reviewedAt ?? now().toISOString();
  const approval = await submissionStore.getState().approve(reviewedAt);
  if (!approval.ok) {
    return failure(approval.reason, { approved: submitted?.reviewStatus === "approved" });
  }

  const mailResult = await mailStore
    .getState()
    .ensureMessage(createCafeApprovalMessage(reviewedAt));
  if (!mailResult.ok) {
    return failure(mailResult.reason, {
      approved: true,
      questRetryAvailable: true,
    });
  }

  const chapter = chapterStore.getState();
  const questResult = await (options.syncQuest ?? syncCafeDeliveryQuest)({
    submissionApproved: submissionStore.getState().submission?.reviewStatus === "approved",
    chapterHydrated: chapter.hydrated,
    currentQuestId: getCurrentChapter1Quest(chapter.progress)?.id ?? null,
    completedQuestIds: chapter.progress.completedQuestIds,
    completeQuest: chapter.completeQuest,
    readCurrentQuestId: () =>
      getCurrentChapter1Quest(chapterStore.getState().progress)?.id ?? null,
  });

  if (!questResult.ok) {
    return failure(questResult.reason ?? "Chapter 1 could not be updated.", {
      approved: true,
      emailCreated: mailResult.created,
      questRetryAvailable: true,
    });
  }

  return {
    ok: true,
    approved: true,
    emailCreated: mailResult.created,
    questCompleted: questResult.completed,
    questRetryAvailable: false,
    reason: questResult.completed
      ? "Alex Morgan approved your project. Your work was delivered and Chapter 1 advanced."
      : "Alex Morgan approved your project. Chapter 1 was already up to date.",
  };
}

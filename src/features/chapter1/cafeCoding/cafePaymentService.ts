/**
 * Step 8F orchestration: explicit claim, atomic wallet credit, one email, and
 * retry-safe quest reconciliation. No timer, AI, network, or second wallet.
 */
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  useGigboardApplication,
  type GigboardApplicationStore,
} from "@/features/browser/gigboardApplicationStore";
import {
  getCurrentChapter1Quest,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { useChapter1, type Chapter1Store } from "@/features/chapter1/chapter1Store";
import {
  ALEX_PARTY,
  CAFE_MAIL_PROJECT_ID,
  CAFE_MAIL_THREAD_ID,
  PLAYER_PARTY,
  type MailMessage,
} from "@/features/mail/mailTypes";
import { useMail, type MailStore } from "@/features/mail/mailStore";
import { commitCafePaymentToStorage, type CafePaymentCommitResult } from "./cafePaymentCommit";
import {
  CAFE_PAYMENT_AMOUNT,
  cafePaymentQuestState,
  chapterPaymentQuestComplete,
  createCafePaymentRecord,
  evaluateCafePaymentEligibility,
  type CafePaymentRecord,
} from "./cafePayment";
import { useCafePayment, type CafePaymentStore } from "./cafePaymentStore";
import { useCafeSubmission, type CafeSubmissionStore } from "./cafeSubmissionStore";

export const CAFE_PAYMENT_MESSAGE_ID = "mail-cafe-payment";
export const CAFE_PAYMENT_SUBJECT = "Café Calculator Payment Sent";
export const CAFE_PAYMENT_BODY = `Hi! Thank you for the great work on the Café Order Calculator. I've approved the project and sent your $50 payment.

Alex Morgan`;

/** The single payment email, deduplicated by Mail's stable message ID. */
export function createCafePaymentMessage(createdAt: string): MailMessage {
  return {
    id: CAFE_PAYMENT_MESSAGE_ID,
    threadId: CAFE_MAIL_THREAD_ID,
    from: ALEX_PARTY,
    to: PLAYER_PARTY,
    subject: CAFE_PAYMENT_SUBJECT,
    body: CAFE_PAYMENT_BODY,
    createdAt,
    read: false,
    direction: "incoming",
    projectId: CAFE_MAIL_PROJECT_ID,
    scriptedResponseKind: "payment",
  };
}

interface PaymentStoreLike {
  getState: () => Pick<
    CafePaymentStore,
    "payment" | "hydrated" | "error" | "invalidRecord" | "hydrate" | "adopt"
  >;
}

interface SubmissionStoreLike {
  getState: () => Pick<CafeSubmissionStore, "submission" | "hydrated" | "error" | "hydrate">;
}

interface ChapterStoreLike {
  getState: () => Pick<
    Chapter1Store,
    "progress" | "hydrated" | "error" | "hydrate" | "adopt" | "completeQuest"
  >;
}

interface ApplicationStoreLike {
  getState: () => Pick<GigboardApplicationStore, "application" | "hydrated" | "hydrate">;
}

interface MailStoreLike {
  getState: () => Pick<MailStore, "messages" | "hydrated" | "error" | "hydrate" | "ensureMessage">;
}

export interface CafePaymentOptions {
  readonly paymentStore?: PaymentStoreLike;
  readonly submissionStore?: SubmissionStoreLike;
  readonly chapterStore?: ChapterStoreLike;
  readonly applicationStore?: ApplicationStoreLike;
  readonly mailStore?: MailStoreLike;
  readonly now?: () => Date;
  readonly commit?: (input: Parameters<typeof commitCafePaymentToStorage>[0]) => Promise<CafePaymentCommitResult>;
}

export interface CafePaymentResult {
  readonly ok: boolean;
  readonly created: boolean;
  readonly emailCreated: boolean;
  readonly mailRetryAvailable: boolean;
  readonly questSynced: boolean;
  readonly balance: number;
  readonly reason: string;
}

function result(options: Partial<CafePaymentResult> & Pick<CafePaymentResult, "ok" | "reason">): CafePaymentResult {
  return {
    created: false,
    emailCreated: false,
    mailRetryAvailable: false,
    questSynced: false,
    balance: 0,
    ...options,
  };
}

function balanceOf(progress: Chapter1Progress): number {
  return progress.money;
}

function mailAlreadyPresent(mailStore: MailStoreLike): boolean {
  return mailStore.getState().messages.some((message) => message.id === CAFE_PAYMENT_MESSAGE_ID);
}

/**
 * Claim the $50 exactly once. The durable guard and the wallet/quest credit are
 * committed atomically; Mail is a separate idempotent follow-up so a failed
 * email never causes a second payment.
 */
export async function claimCafePayment(options: CafePaymentOptions = {}): Promise<CafePaymentResult> {
  const paymentStore = options.paymentStore ?? useCafePayment;
  const submissionStore = options.submissionStore ?? useCafeSubmission;
  const chapterStore = options.chapterStore ?? useChapter1;
  const applicationStore = options.applicationStore ?? useGigboardApplication;
  const mailStore = options.mailStore ?? useMail;

  await Promise.all([
    paymentStore.getState().hydrate(),
    submissionStore.getState().hydrate(),
    chapterStore.getState().hydrate(),
    applicationStore.getState().hydrate(),
    mailStore.getState().hydrate(),
  ]);

  const paymentState = paymentStore.getState();
  const submissionState = submissionStore.getState();
  const chapterState = chapterStore.getState();
  const applicationState = applicationStore.getState();
  const mailState = mailStore.getState();

  if (!paymentState.hydrated) {
    return result({
      ok: false,
      reason: paymentState.error ?? "Your saved payment could not be loaded. Reload and try again.",
      balance: balanceOf(chapterState.progress),
    });
  }
  if (!submissionState.hydrated) {
    return result({
      ok: false,
      reason:
        submissionState.error ?? "Your saved submission could not be loaded. Reload and try again.",
      balance: balanceOf(chapterState.progress),
    });
  }
  if (!chapterState.hydrated) {
    return result({
      ok: false,
      reason: chapterState.error ?? "Chapter 1 could not be loaded. Reload and try again.",
      balance: balanceOf(chapterState.progress),
    });
  }
  if (!applicationState.hydrated) {
    return result({
      ok: false,
      reason: "Your GigBoard application could not be loaded. Reload and try again.",
      balance: balanceOf(chapterState.progress),
    });
  }
  if (!mailState.hydrated) {
    return result({
      ok: false,
      reason: mailState.error ?? "Mail could not be loaded. Reload and try again.",
      balance: balanceOf(chapterState.progress),
    });
  }

  // An existing valid payment is an idempotent no-op, even after CH1-07 has
  // advanced and the quest is no longer active.
  if (paymentState.payment !== null) {
    const hasEmail = mailAlreadyPresent(mailStore);
    return result({
      ok: true,
      created: false,
      mailRetryAvailable: !hasEmail,
      questSynced: chapterPaymentQuestComplete(chapterState.progress),
      balance: balanceOf(chapterState.progress),
      reason: "This payment was already claimed. No money was added again.",
    });
  }

  const submission = submissionState.submission;
  const eligibility = evaluateCafePaymentEligibility({
    applicationHydrated: true,
    applicationAccepted: applicationState.application?.status === "accepted",
    chapterHydrated: true,
    chapter: chapterState.progress,
    submissionHydrated: true,
    submission,
    paymentHydrated: true,
    payment: paymentState.payment,
    paymentInvalid: paymentState.invalidRecord,
    workflow: "development",
  });
  if (!eligibility.eligible || submission === null) {
    return result({
      ok: false,
      reason: eligibility.reason,
      balance: balanceOf(chapterState.progress),
      questSynced: chapterPaymentQuestComplete(chapterState.progress),
    });
  }

  const now = options.now ?? (() => new Date());
  const payment = createCafePaymentRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: submission.submissionId,
    claimedAt: now().toISOString(),
  });
  if (payment === null) {
    return result({
      ok: false,
      reason: "The payment details could not be created. Try again.",
      balance: balanceOf(chapterState.progress),
    });
  }

  const commit =
    options.commit ??
    (() =>
      commitCafePaymentToStorage({
        payment,
        submission,
        applicationAccepted: true,
        workflow: "development",
      }));
  const committed = await commit({
    payment,
    submission,
    applicationAccepted: true,
    workflow: "development",
  });

  if ("ok" in committed && committed.ok === false) {
    return result({
      ok: false,
      reason: committed.reason,
      balance: balanceOf(chapterStore.getState().progress),
    });
  }

  if (committed.status === "duplicate") {
    paymentStore.getState().adopt(committed.payment);
    if (committed.chapter !== null) chapterStore.getState().adopt(committed.chapter);
    const chapter = chapterStore.getState().progress;
    const hasEmail = mailAlreadyPresent(mailStore);
    return result({
      ok: true,
      created: false,
      emailCreated: false,
      mailRetryAvailable: !hasEmail,
      questSynced: chapterPaymentQuestComplete(chapter),
      balance: balanceOf(chapter),
      reason: "This payment was already claimed. No money was added again.",
    });
  }

  paymentStore.getState().adopt(committed.payment);
  chapterStore.getState().adopt(committed.chapter);

  const email = await mailStore
    .getState()
    .ensureMessage(createCafePaymentMessage(committed.payment.claimedAt));
  if (!email.ok) {
    return result({
      ok: true,
      created: true,
      emailCreated: false,
      mailRetryAvailable: true,
      questSynced: chapterPaymentQuestComplete(committed.chapter),
      balance: balanceOf(committed.chapter),
      reason: "Your $50 payment is saved. The confirmation email could not be saved yet.",
    });
  }

  return result({
    ok: true,
    created: true,
    emailCreated: email.created,
    mailRetryAvailable: false,
    questSynced: chapterPaymentQuestComplete(committed.chapter),
    balance: balanceOf(committed.chapter),
    reason: "Alex Morgan paid you $50 for the Café Order Calculator.",
  });
}

/** Retry only the idempotent email after a durable claim with a failed Mail write. */
export async function retryCafePaymentMail(
  options: Pick<CafePaymentOptions, "paymentStore" | "mailStore"> = {},
): Promise<{ ok: boolean; created: boolean; reason: string }> {
  const paymentStore = options.paymentStore ?? useCafePayment;
  const mailStore = options.mailStore ?? useMail;
  await Promise.all([paymentStore.getState().hydrate(), mailStore.getState().hydrate()]);

  const payment = paymentStore.getState().payment;
  if (payment === null) {
    return { ok: false, created: false, reason: "There is no saved payment to confirm." };
  }
  const email = await mailStore
    .getState()
    .ensureMessage(createCafePaymentMessage(payment.claimedAt));
  if (!email.ok) return { ok: false, created: false, reason: email.reason };
  return { ok: true, created: email.created, reason: "Payment confirmation is in your mail." };
}

/**
 * Repair a restored save where the payment record exists but CH1-07 was not
 * advanced. The record proves the $50 was already issued, so this never adds a
 * second credit and never creates another payment or email.
 */
export async function reconcileCafePaymentQuest(
  options: Pick<CafePaymentOptions, "paymentStore" | "chapterStore"> = {},
): Promise<{ ok: boolean; completed: boolean; balance: number; reason: string }> {
  const paymentStore = options.paymentStore ?? useCafePayment;
  const chapterStore = options.chapterStore ?? useChapter1;
  await Promise.all([paymentStore.getState().hydrate(), chapterStore.getState().hydrate()]);

  const paymentState = paymentStore.getState();
  const chapterState = chapterStore.getState();
  const fallback = {
    balance: balanceOf(chapterState.progress),
  };
  if (!paymentState.hydrated || !chapterState.hydrated) {
    return {
      ok: false,
      completed: false,
      ...fallback,
      reason: "Saved progress could not be loaded. Reload and try again.",
    };
  }
  if (paymentState.payment === null || paymentState.invalidRecord) {
    return {
      ok: false,
      completed: false,
      ...fallback,
      reason: "There is no valid payment to reconcile.",
    };
  }

  const questState = cafePaymentQuestState(chapterState.progress);
  if (questState === "complete") {
    return {
      ok: true,
      completed: false,
      ...fallback,
      reason: "The paycheck quest is already complete.",
    };
  }
  if (questState !== "active") {
    return {
      ok: false,
      completed: false,
      ...fallback,
      reason: "The first paycheck quest is not active, so it cannot be repaired here.",
    };
  }

  const completed = await chapterStore.getState().completeQuest("CH1-07");
  const after = chapterStore.getState().progress;
  const valid =
    chapterPaymentQuestComplete(after) &&
    after.money === CAFE_PAYMENT_AMOUNT &&
    after.paymentClaimed &&
    getCurrentChapter1Quest(after)?.id === "CH1-08";
  if (!valid) {
    return {
      ok: false,
      completed: false,
      balance: balanceOf(after),
      reason: completed
        ? "Chapter 1 did not reach the expected paid state. Retry the Chapter 1 update."
        : "Chapter 1 could not be updated. Your payment remains saved; retry the Chapter 1 update.",
    };
  }

  return {
    ok: true,
    completed: true,
    balance: balanceOf(after),
    reason: "The first paycheck quest was restored without another payment.",
  };
}

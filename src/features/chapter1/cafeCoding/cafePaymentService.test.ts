import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { createGigboardApplicationStore } from "@/features/browser/gigboardApplicationStore";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import {
  CHAPTER1_STORAGE_KEY,
  createChapter1Store,
} from "@/features/chapter1/chapter1Store";
import {
  createChapter1SaveRecord,
  validateChapter1SaveRecord,
} from "@/features/chapter1/chapter1Validation";
import { notify } from "@/features/notifications/notificationStore";
import { createMailStore } from "@/features/mail/mailStore";
import {
  createMailSaveRecord,
  type MailMessage,
} from "@/features/mail/mailTypes";
import {
  CAFE_PAYMENT_STORAGE_KEY,
  createCafePaymentRecord,
  createCafePaymentSaveRecord,
  evaluateCafePaymentEligibility,
  planCafePaymentCommit,
  validateCafePaymentSaveRecord,
} from "./cafePayment";
import type { CafePaymentCommitResult } from "./cafePaymentCommit";
import {
  CAFE_PAYMENT_MESSAGE_ID,
  claimCafePayment,
  createCafePaymentMessage,
  reconcileCafePaymentQuest,
  retryCafePaymentMail,
} from "./cafePaymentService";
import { createCafePaymentStore } from "./cafePaymentStore";
import { createCafeSubmissionStore } from "./cafeSubmissionStore";
import { createCafeSubmissionRecord, type CafeSubmissionRecord } from "./cafeSubmission";
import { CAFE_SUBMISSION_STORAGE_KEY } from "./cafeSubmissionStore";

vi.mock("@/features/notifications/notificationStore", () => ({ notify: vi.fn() }));
const notifier = vi.mocked(notify);

const NOW = "2026-01-02T16:00:00.000Z";
const MAIL_KEY = "mail-state";
const FILES = {
  "PLAN.md": "Plan the calculator.",
  "calculator.py": "def calculate_total(c, s): return c * 3 + s * 5\n",
  "main.py": "import calculator\nprint(calculator.calculate_total(2, 3))\n",
  "README.md": "# Café Order Calculator\nCoffee $3, sandwiches $5, discount at $20.\n",
} as const;

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function approvedSubmission(): CafeSubmissionRecord {
  const record = createCafeSubmissionRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: "sub-service-test",
    submittedAt: "2026-01-02T12:00:00.000Z",
    files: (Object.keys(FILES) as (keyof typeof FILES)[]).map((name) => ({
      name,
      content: FILES[name],
    })),
  });
  if (!record) throw new Error("submission fixture was rejected");
  return { ...record, reviewStatus: "approved", reviewedAt: "2026-01-02T15:00:00.000Z" };
}

function storePersistence(map: Map<string, unknown>, key: string) {
  return {
    load: vi.fn(async () => map.get(key)),
    save: vi.fn(async (record: unknown) => {
      map.set(key, record);
      return true;
    }),
  };
}

interface Harness {
  readonly storage: Map<string, unknown>;
  readonly paymentStore: ReturnType<typeof createCafePaymentStore>;
  readonly submissionStore: ReturnType<typeof createCafeSubmissionStore>;
  readonly chapterStore: ReturnType<typeof createChapter1Store>;
  readonly mailStore: ReturnType<typeof createMailStore>;
  readonly applicationStore: ReturnType<typeof createGigboardApplicationStore>;
  readonly commitCalls: () => number;
  readonly failCommit: (failed: boolean) => void;
  readonly options: Parameters<typeof claimCafePayment>[0];
}

function harness(submission = approvedSubmission(), chapter = progressAfter(6)): Harness {
  const storage = new Map<string, unknown>();
  storage.set(CHAPTER1_STORAGE_KEY, createChapter1SaveRecord(chapter));
  storage.set(CAFE_SUBMISSION_STORAGE_KEY, {
    version: 1,
    submission,
  });
  storage.set(MAIL_KEY, createMailSaveRecord([]));

  let commitCount = 0;
  let fail = false;

  const commit = async (input: {
    payment: ReturnType<typeof createCafePaymentRecord>;
    submission: CafeSubmissionRecord;
  }): Promise<CafePaymentCommitResult> => {
    commitCount += 1;
    if (fail) return { ok: false, reason: "Storage write failed.", conflict: false };

    const rawPayment = storage.get(CAFE_PAYMENT_STORAGE_KEY);
    if (rawPayment !== undefined) {
      const existing = validateCafePaymentSaveRecord(rawPayment);
      if (!existing.ok || existing.payment === null) {
        return { ok: false, reason: "Saved payment is invalid.", conflict: false };
      }
      const rawChapter = storage.get(CHAPTER1_STORAGE_KEY);
      const chapterValidation = validateChapter1SaveRecord(rawChapter);
      return {
        ok: true,
        status: "duplicate",
        payment: existing.payment,
        chapter: chapterValidation.ok ? chapterValidation.progress : null,
      };
    }

    const chapterValidation = validateChapter1SaveRecord(storage.get(CHAPTER1_STORAGE_KEY));
    if (!chapterValidation.ok) {
      return { ok: false, reason: chapterValidation.reason, conflict: false };
    }
    const eligibility = evaluateCafePaymentEligibility({
      applicationHydrated: true,
      applicationAccepted: true,
      chapterHydrated: true,
      chapter: chapterValidation.progress,
      submissionHydrated: true,
      submission: input.submission,
      paymentHydrated: true,
      payment: null,
      paymentInvalid: false,
      workflow: "development",
    });
    if (!eligibility.eligible) {
      return { ok: false, reason: eligibility.reason, conflict: false };
    }
    const planned = planCafePaymentCommit(chapterValidation.progress, input.payment!);
    if (!planned) {
      return { ok: false, reason: "Payment plan failed.", conflict: false };
    }
    storage.set(CAFE_PAYMENT_STORAGE_KEY, planned.paymentSave);
    storage.set(CHAPTER1_STORAGE_KEY, planned.chapterSave);
    return {
      ok: true,
      status: "committed",
      payment: planned.payment,
      chapter: planned.chapter,
    };
  };

  const paymentStore = createCafePaymentStore(storePersistence(storage, CAFE_PAYMENT_STORAGE_KEY));
  const submissionStore = createCafeSubmissionStore(
    storePersistence(storage, CAFE_SUBMISSION_STORAGE_KEY),
  );
  const chapterStore = createChapter1Store(storePersistence(storage, CHAPTER1_STORAGE_KEY));
  const mailStore = createMailStore(storePersistence(storage, MAIL_KEY));
  const applicationStore = createGigboardApplicationStore();
  applicationStore.setState({
    application: {
      jobId: CAFE_CALCULATOR_JOB_ID,
      proposal: "A clean Python café calculator.",
      status: "accepted",
      submittedAt: "2026-01-02T09:00:00.000Z",
      acceptedAt: "2026-01-02T10:00:00.000Z",
      acceptanceMessage: "Hired.",
    },
    hydrated: true,
  });

  return {
    storage,
    paymentStore,
    submissionStore,
    chapterStore,
    mailStore,
    applicationStore,
    commitCalls: () => commitCount,
    failCommit: (failed) => {
      fail = failed;
    },
    options: {
      paymentStore,
      submissionStore,
      chapterStore,
      mailStore,
      applicationStore,
      now: () => new Date(NOW),
      commit,
    },
  };
}

function seedExistingMail(h: Harness, messages: MailMessage[]): void {
  h.storage.set(MAIL_KEY, createMailSaveRecord(messages));
}

beforeEach(() => {
  notifier.mockClear();
});

describe("café payment service", () => {
  it("claims exactly $50, completes CH1-07, unlocks CH1-08, and sends one email", async () => {
    const h = harness();
    const result = await claimCafePayment(h.options);

    expect(result).toMatchObject({
      ok: true,
      created: true,
      emailCreated: true,
      questSynced: true,
      balance: 50,
    });
    expect(h.chapterStore.getState().progress.money).toBe(50);
    expect(h.chapterStore.getState().progress.paymentClaimed).toBe(true);
    expect(getCurrentChapter1Quest(h.chapterStore.getState().progress)?.id).toBe("CH1-08");
    expect(h.chapterStore.getState().progress.completedQuestIds).not.toContain("CH1-08");
    expect(h.paymentStore.getState().payment?.transactionId).toBe("cafe-payment-sub-service-test");
    expect(h.mailStore.getState().messages.filter((m) => m.id === CAFE_PAYMENT_MESSAGE_ID)).toHaveLength(1);
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("rejects ineligible claims without writing or notifying", async () => {
    const unapproved = harness({
      ...approvedSubmission(),
      reviewStatus: "awaiting-review",
      reviewedAt: null,
    });
    const result = await claimCafePayment(unapproved.options);
    expect(result.ok).toBe(false);
    expect(unapproved.commitCalls()).toBe(0);
    expect(unapproved.mailStore.getState().messages).toHaveLength(0);
    expect(notifier).not.toHaveBeenCalled();

    const h = harness();
    const legacy = await claimCafePayment({
      ...h.options,
      applicationStore: {
        getState: () => ({
          application: {
            jobId: CAFE_CALCULATOR_JOB_ID,
            proposal: "Legacy",
            status: "submitted" as const,
            submittedAt: "2026-01-01T00:00:00.000Z",
            acceptedAt: null,
            acceptanceMessage: null,
          },
          hydrated: true,
          hydrate: vi.fn(async () => undefined),
        }),
      },
    });
    expect(legacy.ok).toBe(false);
    expect(h.commitCalls()).toBe(0);
  });

  it("never credits twice for repeated clicks, reloads, or concurrent claims", async () => {
    const h = harness();
    const [first, second] = await Promise.all([
      claimCafePayment(h.options),
      claimCafePayment(h.options),
    ]);

    expect([first.ok, second.ok]).toEqual([true, true]);
    expect([first.created, second.created].filter(Boolean)).toHaveLength(1);
    expect(h.commitCalls()).toBe(2);
    expect(h.chapterStore.getState().progress.money).toBe(50);
    expect(h.mailStore.getState().messages.filter((m) => m.id === CAFE_PAYMENT_MESSAGE_ID)).toHaveLength(1);
    expect(notifier).toHaveBeenCalledTimes(1);

    const reloaded = harness();
    // Reuse the already-paid storage from the first claim.
    reloaded.storage.clear();
    for (const [key, value] of h.storage) reloaded.storage.set(key, value);
    const afterReload = await claimCafePayment(reloaded.options);
    expect(afterReload.ok).toBe(true);
    expect(afterReload.created).toBe(false);
    expect(reloaded.chapterStore.getState().progress.money).toBe(50);
    expect(reloaded.mailStore.getState().messages.filter((m) => m.id === CAFE_PAYMENT_MESSAGE_ID)).toHaveLength(1);
  });

  it("keeps the wallet and payment untouched when the atomic write fails", async () => {
    const h = harness();
    h.failCommit(true);

    const result = await claimCafePayment(h.options);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Storage write failed/);
    expect(h.storage.has(CAFE_PAYMENT_STORAGE_KEY)).toBe(false);
    expect(h.chapterStore.getState().progress.money).toBe(0);
    expect(h.mailStore.getState().messages).toHaveLength(0);
    expect(notifier).not.toHaveBeenCalled();

    h.failCommit(false);
    const retry = await claimCafePayment(h.options);
    expect(retry).toMatchObject({ ok: true, created: true, balance: 50 });
    expect(h.chapterStore.getState().progress.money).toBe(50);
  });

  it("preserves existing mail and never creates a duplicate payment email", async () => {
    const h = harness();
    const existing: MailMessage = {
      id: "mail-cafe-approval",
      threadId: "cafe-calculator-thread",
      from: { name: "Alex Morgan", address: "alex.morgan@morgancafe.example" },
      to: { name: "You", address: "you@codequest.dev" },
      subject: "Café Calculator Approved",
      body: "Approved.",
      createdAt: "2026-01-02T15:00:00.000Z",
      read: false,
      direction: "incoming",
      projectId: CAFE_CALCULATOR_JOB_ID,
      scriptedResponseKind: "approval",
    };
    seedExistingMail(h, [existing]);

    await claimCafePayment(h.options);
    await claimCafePayment(h.options);

    const ids = h.mailStore.getState().messages.map((message) => message.id);
    expect(ids).toEqual(expect.arrayContaining(["mail-cafe-approval", CAFE_PAYMENT_MESSAGE_ID]));
    expect(ids.filter((id) => id === CAFE_PAYMENT_MESSAGE_ID)).toHaveLength(1);
    expect(h.mailStore.getState().messages.find((m) => m.id === "mail-cafe-approval")?.body).toBe(
      "Approved.",
    );
  });

  it("keeps a durable claim when Mail saving fails, then retries the email only", async () => {
    const h = harness();
    const save = vi
      .spyOn(h.mailStore.getState(), "ensureMessage")
      .mockResolvedValueOnce({ ok: false, reason: "Mail storage failed." });

    const result = await claimCafePayment(h.options);
    expect(result).toMatchObject({
      ok: true,
      created: true,
      emailCreated: false,
      mailRetryAvailable: true,
      balance: 50,
    });
    expect(h.chapterStore.getState().progress.money).toBe(50);
    expect(h.storage.has(CAFE_PAYMENT_STORAGE_KEY)).toBe(true);

    save.mockRestore();
    const retried = await retryCafePaymentMail({
      paymentStore: h.paymentStore,
      mailStore: h.mailStore,
    });
    expect(retried).toMatchObject({ ok: true, created: true });
    expect(h.mailStore.getState().messages.filter((m) => m.id === CAFE_PAYMENT_MESSAGE_ID)).toHaveLength(1);
    expect(h.chapterStore.getState().progress.money).toBe(50);
  });

  it("repairs an interrupted quest sync from the payment record without a second credit", async () => {
    const h = harness();
    const payment = createCafePaymentRecord({
      jobId: CAFE_CALCULATOR_JOB_ID,
      submissionId: "sub-service-test",
      claimedAt: NOW,
    });
    if (!payment) throw new Error("payment fixture was rejected");

    // Simulate a restored save where the payment record is durable but the
    // Chapter 1 quest record was not advanced.
    h.storage.set(CAFE_PAYMENT_STORAGE_KEY, createCafePaymentSaveRecord(payment));
    h.storage.set(MAIL_KEY, createMailSaveRecord([createCafePaymentMessage(NOW)]));

    const first = await reconcileCafePaymentQuest({
      paymentStore: h.paymentStore,
      chapterStore: h.chapterStore,
    });
    expect(first).toMatchObject({ ok: true, completed: true, balance: 50 });
    expect(getCurrentChapter1Quest(h.chapterStore.getState().progress)?.id).toBe("CH1-08");

    const second = await reconcileCafePaymentQuest({
      paymentStore: h.paymentStore,
      chapterStore: h.chapterStore,
    });
    expect(second).toMatchObject({ ok: true, completed: false, balance: 50 });
    expect(h.chapterStore.getState().progress.money).toBe(50);
    await h.mailStore.getState().hydrate();
    expect(h.mailStore.getState().messages.filter((m) => m.id === CAFE_PAYMENT_MESSAGE_ID)).toHaveLength(1);
    expect(notifier).not.toHaveBeenCalled();
  });

  it("does not mutate a legacy save with no approved submission", async () => {
    const legacyChapter = progressAfter(5);
    const h = harness(approvedSubmission(), legacyChapter);
    const original = h.storage.get(CHAPTER1_STORAGE_KEY);

    const result = await claimCafePayment(h.options);

    expect(result.ok).toBe(false);
    expect(h.storage.get(CHAPTER1_STORAGE_KEY)).toEqual(original);
    expect(h.chapterStore.getState().progress.money).toBe(0);
  });
});

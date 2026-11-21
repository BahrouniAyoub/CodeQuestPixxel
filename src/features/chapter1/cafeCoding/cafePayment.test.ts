import { describe, expect, it } from "vitest";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import {
  CAFE_PAYMENT_AMOUNT,
  CAFE_PAYMENT_CURRENCY,
  CAFE_PAYMENT_SAVE_VERSION,
  CAFE_PAYMENT_STATUS,
  cafePaymentId,
  cafePaymentQuestState,
  cafePaymentTransactionId,
  chapterPaymentQuestComplete,
  createCafePaymentRecord,
  createCafePaymentSaveRecord,
  evaluateCafePaymentEligibility,
  planCafePaymentCommit,
  validateCafePaymentSaveRecord,
} from "./cafePayment";
import { createCafeSubmissionRecord, type CafeSubmissionRecord } from "./cafeSubmission";

const FILES = {
  "PLAN.md": "Plan the calculator.",
  "calculator.py": "def calculate_total(c, s): return c * 3 + s * 5\n",
  "main.py": "import calculator\nprint(calculator.calculate_total(2, 3))\n",
  "README.md": "# Café Order Calculator\nCoffee $3, sandwich $5, discount at $20.\n",
} as const;

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function submission(status: "awaiting-review" | "approved" = "approved"): CafeSubmissionRecord {
  const record = createCafeSubmissionRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: "sub-payment-test",
    submittedAt: "2026-01-02T12:00:00.000Z",
    files: (Object.keys(FILES) as (keyof typeof FILES)[]).map((name) => ({
      name,
      content: FILES[name],
    })),
  });
  if (!record) throw new Error("submission fixture was rejected");
  return status === "approved"
    ? { ...record, reviewStatus: "approved", reviewedAt: "2026-01-02T15:00:00.000Z" }
    : record;
}

function payment(submissionId = "sub-payment-test") {
  const record = createCafePaymentRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId,
    claimedAt: "2026-01-02T16:00:00.000Z",
  });
  if (!record) throw new Error("payment fixture was rejected");
  return record;
}

function eligibility(overrides: Partial<Parameters<typeof evaluateCafePaymentEligibility>[0]> = {}) {
  return evaluateCafePaymentEligibility({
    applicationHydrated: true,
    applicationAccepted: true,
    chapterHydrated: true,
    chapter: progressAfter(6),
    submissionHydrated: true,
    submission: submission(),
    paymentHydrated: true,
    payment: null,
    paymentInvalid: false,
    workflow: "development",
    ...overrides,
  });
}

describe("café payment record", () => {
  it("creates and validates one stable $50 USD record", () => {
    const record = payment();
    expect(record).toMatchObject({
      paymentId: cafePaymentId("sub-payment-test"),
      jobId: CAFE_CALCULATOR_JOB_ID,
      submissionId: "sub-payment-test",
      amount: 50,
      currency: "USD",
      status: CAFE_PAYMENT_STATUS,
      transactionId: cafePaymentTransactionId("sub-payment-test"),
    });

    const saved = createCafePaymentSaveRecord(record);
    expect(saved.version).toBe(CAFE_PAYMENT_SAVE_VERSION);
    const validated = validateCafePaymentSaveRecord(saved);
    expect(validated.ok).toBe(true);
    expect(validated.ok && validated.payment).toEqual(record);
    expect(validateCafePaymentSaveRecord(undefined)).toEqual({ ok: true, payment: null });
  });

  it("rejects tampered amounts, currencies, versions, and transaction IDs", () => {
    const record = payment();
    const save = createCafePaymentSaveRecord(record);
    expect(validateCafePaymentSaveRecord({ ...save, version: 99 }).ok).toBe(false);
    expect(
      validateCafePaymentSaveRecord({
        ...save,
        payment: { ...record, amount: 100 },
      }).ok,
    ).toBe(false);
    expect(
      validateCafePaymentSaveRecord({
        ...save,
        payment: { ...record, currency: "EUR" },
      }).ok,
    ).toBe(false);
    expect(
      validateCafePaymentSaveRecord({
        ...save,
        payment: { ...record, transactionId: "forged" },
      }).ok,
    ).toBe(false);
  });

  it("uses the expected constant amount and currency", () => {
    expect(CAFE_PAYMENT_AMOUNT).toBe(50);
    expect(CAFE_PAYMENT_CURRENCY).toBe("USD");
  });
});

describe("café payment eligibility", () => {
  it("allows only an approved four-task submission at CH1-07", () => {
    expect(eligibility()).toEqual({
      eligible: true,
      reason: "The approved café project is ready for payment.",
    });
  });

  it("rejects ready-for-delivery, awaiting review, unapproved, and invalid submissions", () => {
    expect(eligibility({ submission: null }).eligible).toBe(false);
    expect(eligibility({ submission: submission("awaiting-review") }).eligible).toBe(false);
    expect(eligibility({ submission: { ...submission(), projectFingerprint: "deadbeef" } }).eligible)
      .toBe(false);
  });

  it("rejects legacy workflow, unaccepted jobs, and missing CH1-06", () => {
    expect(eligibility({ workflow: "legacy" }).eligible).toBe(false);
    expect(eligibility({ applicationAccepted: false }).eligible).toBe(false);
    expect(eligibility({ chapter: progressAfter(5) }).eligible).toBe(false);
  });

  it("rejects a completed payment, an invalid stored payment, and unfydrated stores", () => {
    expect(eligibility({ payment: payment() }).eligible).toBe(false);
    expect(eligibility({ paymentInvalid: true }).eligible).toBe(false);
    expect(eligibility({ paymentHydrated: false }).eligible).toBe(false);
    expect(eligibility({ chapterHydrated: false }).eligible).toBe(false);
  });
});

describe("café payment commit plan", () => {
  it("credits $50 once, completes CH1-07, and activates CH1-08", () => {
    const planned = planCafePaymentCommit(progressAfter(6), payment());
    expect(planned).not.toBeNull();
    if (!planned) return;

    expect(planned.chapter.money).toBe(50);
    expect(planned.chapter.paymentClaimed).toBe(true);
    expect(planned.chapter.completedQuestIds).toEqual([
      "CH1-01",
      "CH1-02",
      "CH1-03",
      "CH1-04",
      "CH1-05",
      "CH1-06",
      "CH1-07",
    ]);
    expect(getCurrentChapter1Quest(planned.chapter)?.id).toBe("CH1-08");
    expect(chapterPaymentQuestComplete(planned.chapter)).toBe(true);
    expect(cafePaymentQuestState(planned.chapter)).toBe("complete");
    expect(planned.paymentSave.payment?.transactionId).toBe(payment().transactionId);
  });

  it("cannot plan a second credit or a payment from the wrong quest", () => {
    const planned = planCafePaymentCommit(progressAfter(6), payment());
    expect(planned).not.toBeNull();
    if (!planned) return;
    expect(planCafePaymentCommit(planned.chapter, payment())).toBeNull();
    expect(planCafePaymentCommit(progressAfter(5), payment())).toBeNull();
  });
});

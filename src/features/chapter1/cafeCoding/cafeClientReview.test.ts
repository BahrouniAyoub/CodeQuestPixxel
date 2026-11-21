import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { createChapter1Store } from "@/features/chapter1/chapter1Store";
import { notify } from "@/features/notifications/notificationStore";
import { createMailStore } from "@/features/mail/mailStore";
import { CAFE_MAIL_THREAD_ID, CAFE_WELCOME_MESSAGE_ID } from "@/features/mail/mailTypes";
import {
  CAFE_APPROVAL_BODY,
  CAFE_APPROVAL_MESSAGE_ID,
  CAFE_APPROVAL_SUBJECT,
  checkCafeClientResponse,
  createCafeApprovalMessage,
  evaluateCafeSubmissionReview,
} from "./cafeClientReview";
import {
  createCafeSubmissionRecord,
  type CafeSubmissionRecord,
} from "./cafeSubmission";
import { createCafeSubmissionStore } from "./cafeSubmissionStore";

vi.mock("@/features/notifications/notificationStore", () => ({ notify: vi.fn() }));

const notifier = vi.mocked(notify);
const NOW = "2026-01-02T15:00:00.000Z";
const FILES = {
  "PLAN.md": "Plan the calculator.",
  "calculator.py": "def calculate_total(c, s): return c * 3 + s * 5\n",
  "main.py": "import calculator\nprint(calculator.calculate_total(2, 3))\n",
  "README.md": "# Café Order Calculator\nCoffee $3, sandwich $5, 10% off at $20.\n",
} as const;

function makeSubmission(overrides: Partial<CafeSubmissionRecord> = {}): CafeSubmissionRecord {
  const record = createCafeSubmissionRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: "sub-approval-test",
    submittedAt: "2026-01-02T12:00:00.000Z",
    files: (Object.keys(FILES) as (keyof typeof FILES)[]).map((name) => ({
      name,
      content: FILES[name],
    })),
  });
  if (!record) throw new Error("submission fixture was rejected");
  return { ...record, ...overrides };
}

function memory(initial?: unknown) {
  let stored = initial;
  return {
    load: vi.fn(async () => stored),
    save: vi.fn(async (record: unknown) => {
      stored = record;
      return true;
    }),
    peek: () => stored,
  };
}

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

interface Harness {
  readonly submissionStore: ReturnType<typeof createCafeSubmissionStore>;
  readonly mailStore: ReturnType<typeof createMailStore>;
  readonly chapterStore: ReturnType<typeof createChapter1Store>;
  readonly options: Parameters<typeof checkCafeClientResponse>[0];
}

function harness(submission = makeSubmission(), chapter = progressAfter(5)): Harness {
  const submissionPersistence = memory();
  const mailPersistence = memory();
  const chapterPersistence = memory();
  const submissionStore = createCafeSubmissionStore(submissionPersistence);
  const mailStore = createMailStore(mailPersistence);
  const chapterStore = createChapter1Store(chapterPersistence);

  submissionStore.setState({ submission, hydrated: true });
  mailStore.setState({ messages: [], hydrated: true });
  chapterStore.setState({ progress: chapter, hydrated: true });

  return {
    submissionStore,
    mailStore,
    chapterStore,
    options: {
      submissionStore,
      mailStore,
      chapterStore,
      now: () => new Date(NOW),
    },
  };
}

beforeEach(() => {
  notifier.mockClear();
});

describe("deterministic café client review", () => {
  it("approves a correctly verified snapshot without any AI or working-file read", () => {
    const decision = evaluateCafeSubmissionReview(makeSubmission());
    expect(decision.approved).toBe(true);
    expect(decision.reason).toMatch(/approved/i);

    const tampered = makeSubmission();
    const bad = evaluateCafeSubmissionReview({ ...tampered, projectFingerprint: "deadbeef" });
    expect(bad.approved).toBe(false);
    expect(evaluateCafeSubmissionReview(null).approved).toBe(false);
  });

  it("creates the single unread approval email in the café thread", () => {
    const message = createCafeApprovalMessage(NOW);
    expect(message).toMatchObject({
      id: CAFE_APPROVAL_MESSAGE_ID,
      threadId: CAFE_MAIL_THREAD_ID,
      read: false,
      direction: "incoming",
      projectId: CAFE_CALCULATOR_JOB_ID,
      scriptedResponseKind: "approval",
      subject: CAFE_APPROVAL_SUBJECT,
      body: CAFE_APPROVAL_BODY,
    });
    expect(message.from.name).toBe("Alex Morgan");
  });

  it("approves the submission, sends one email, and completes only CH1-06", async () => {
    const h = harness();

    const result = await checkCafeClientResponse(h.options);
    expect(result).toMatchObject({
      ok: true,
      approved: true,
      emailCreated: true,
      questCompleted: true,
    });

    expect(h.submissionStore.getState().submission?.reviewStatus).toBe("approved");
    expect(h.submissionStore.getState().submission?.reviewedAt).toBe(NOW);

    const approvals = h.mailStore
      .getState()
      .messages.filter((message) => message.id === CAFE_APPROVAL_MESSAGE_ID);
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.read).toBe(false);
    expect(notifier).toHaveBeenCalledTimes(1);

    const progress = h.chapterStore.getState().progress;
    expect(getCurrentChapter1Quest(progress)?.id).toBe("CH1-07");
    expect(progress.completedQuestIds).toEqual(
      expect.arrayContaining(["CH1-05", "CH1-06"]),
    );
    expect(progress.completedQuestIds).not.toContain("CH1-07");
    expect(progress.completedQuestIds).not.toContain("CH1-08");
    expect(progress.money).toBe(0);
    expect(progress.paymentClaimed).toBe(false);
  });

  it("never duplicates the email, notification, XP, or money across retries and reloads", async () => {
    const h = harness();
    const first = await checkCafeClientResponse(h.options);
    expect(first.ok).toBe(true);

    const second = await checkCafeClientResponse(h.options);
    expect(second).toMatchObject({ ok: true, emailCreated: false, questCompleted: false });
    expect(h.mailStore.getState().messages).toHaveLength(1);
    expect(notifier).toHaveBeenCalledTimes(1);
    expect(h.chapterStore.getState().progress.completedQuestIds.filter((id) => id === "CH1-06"))
      .toHaveLength(1);
    expect(h.chapterStore.getState().progress.money).toBe(0);
    expect(h.chapterStore.getState().progress.paymentClaimed).toBe(false);

    // A fresh page reload rehydrates the same persisted records.
    const reloadedMail = createMailStore(memory());
    const approval = h.mailStore.getState().messages[0];
    if (!approval) throw new Error("approval email was missing");
    reloadedMail.setState({ messages: [approval], hydrated: true });
    const reloadedChapter = createChapter1Store(memory());
    reloadedChapter.setState({ progress: h.chapterStore.getState().progress, hydrated: true });
    const reloadedSubmission = createCafeSubmissionStore(memory());
    reloadedSubmission.setState({
      submission: h.submissionStore.getState().submission,
      hydrated: true,
    });

    const third = await checkCafeClientResponse({
      submissionStore: reloadedSubmission,
      mailStore: reloadedMail,
      chapterStore: reloadedChapter,
      now: () => new Date(NOW),
    });
    expect(third).toMatchObject({ ok: true, emailCreated: false, questCompleted: false });
    expect(reloadedMail.getState().messages).toHaveLength(1);
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("keeps the approval and email when quest sync fails, then retries safely", async () => {
    const h = harness();
    const failed = await checkCafeClientResponse({
      ...h.options,
      syncQuest: async () => ({
        ok: false,
        completed: false,
        reason: "Chapter 1 could not be updated.",
      }),
    });

    expect(failed).toMatchObject({
      ok: false,
      approved: true,
      emailCreated: true,
      questRetryAvailable: true,
    });
    expect(h.submissionStore.getState().submission?.reviewStatus).toBe("approved");
    expect(h.mailStore.getState().messages).toHaveLength(1);
    expect(h.chapterStore.getState().progress.completedQuestIds).not.toContain("CH1-06");

    const retried = await checkCafeClientResponse(h.options);
    expect(retried).toMatchObject({ ok: true, emailCreated: false, questCompleted: true });
    expect(h.mailStore.getState().messages).toHaveLength(1);
    expect(notifier).toHaveBeenCalledTimes(1);
    expect(h.chapterStore.getState().progress.completedQuestIds).toContain("CH1-06");
    expect(h.chapterStore.getState().progress.money).toBe(0);
  });

  it("does not touch Mail, quests, or wallet without a submitted snapshot", async () => {
    const h = harness();
    h.submissionStore.setState({ submission: null });

    const result = await checkCafeClientResponse(h.options);
    expect(result.ok).toBe(false);
    expect(h.mailStore.getState().messages).toHaveLength(0);
    expect(h.chapterStore.getState().progress).toEqual(progressAfter(5));
    expect(notifier).not.toHaveBeenCalled();
  });

  it("preserves an existing café thread and the welcome email", async () => {
    const h = harness();
    h.mailStore.setState({
      messages: [
        {
          id: CAFE_WELCOME_MESSAGE_ID,
          threadId: CAFE_MAIL_THREAD_ID,
          from: {
            name: "Alex Morgan",
            address: "alex.morgan@morgancafe.example",
          },
          to: { name: "You", address: "you@codequest.dev" },
          subject: "Welcome to the Café Calculator Project",
          body: "Welcome to the project.",
          createdAt: "2026-01-02T09:00:00.000Z",
          read: true,
          direction: "incoming",
          projectId: CAFE_CALCULATOR_JOB_ID,
        },
      ],
    });

    await checkCafeClientResponse(h.options);
    const messages = h.mailStore.getState().messages;
    expect(messages.map((message) => message.id)).toEqual(
      expect.arrayContaining([CAFE_WELCOME_MESSAGE_ID, CAFE_APPROVAL_MESSAGE_ID]),
    );
    expect(messages).toHaveLength(2);
  });
});

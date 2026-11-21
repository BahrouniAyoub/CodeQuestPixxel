import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  CAFE_PAYMENT_SAVE_VERSION,
  CAFE_PAYMENT_STATUS,
  createCafePaymentRecord,
  createCafePaymentSaveRecord,
  type CafePaymentRecord,
} from "./cafeCoding/cafePayment";
import {
  createCafePaymentStore,
  type CafePaymentStore,
} from "./cafeCoding/cafePaymentStore";
import { CHAPTER1_SAVE_VERSION, type Chapter1SaveRecord } from "./chapter1Validation";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "./chapter1Progress";
import {
  CHAPTER1_COMPLETE_MESSAGE,
  CHAPTER1_COMPLETE_TITLE,
  CHAPTER1_QUESTS,
} from "./chapter1Quests";
import {
  createChapter1Store,
  type Chapter1Store,
} from "./chapter1Store";
import {
  CHAPTER1_STORAGE_KEY,
  CHAPTER1_STORAGE_STORE,
} from "./chapter1Store";
import {
  createCodeQuestChapterState,
  createFatherDialogueCompletionHandler,
  FATHER_DIALOGUE_COMPLETION_PAYLOAD,
  GODOT_COMPLETE_EVENT_TYPE,
  isFatherDialogueCompletionMessage,
  isFatherDialogueCompletionPayload,
} from "./godotBridge";

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

const payment: CafePaymentRecord = createCafePaymentRecord({
  jobId: CAFE_CALCULATOR_JOB_ID,
  submissionId: "submission-1",
  claimedAt: "2026-11-19T12:00:00.000Z",
})!;

interface Harness {
  chapterStore: ReturnType<typeof createChapter1Store>;
  paymentStore: ReturnType<typeof createCafePaymentStore>;
  notify: Mock;
  save: Mock<(record: Chapter1SaveRecord) => Promise<boolean>>;
  saved: Chapter1SaveRecord[];
}

function makeHarness(options: {
  chapterIndex?: number;
  money?: number;
  paymentClaimed?: boolean;
  paymentRecord?: CafePaymentRecord | null;
  saveOk?: (record: Chapter1SaveRecord) => boolean;
} = {}): Harness {
  const {
    chapterIndex = 7,
    money = 50,
    paymentClaimed = true,
    paymentRecord = payment,
    saveOk = () => true,
  } = options;

  const rawProgress: Chapter1SaveRecord = {
    version: CHAPTER1_SAVE_VERSION,
    progress: { ...progressAfter(chapterIndex), money, paymentClaimed },
  };
  const saved: Chapter1SaveRecord[] = [];
  const save = vi.fn(async (record: Chapter1SaveRecord) => {
    const ok = saveOk(record);
    if (ok) saved.push(record);
    return ok;
  });

  const chapterStore = createChapter1Store({ load: async () => rawProgress, save });
  const paymentStore = createCafePaymentStore({
    load: async () => ({ version: CAFE_PAYMENT_SAVE_VERSION, payment: paymentRecord }),
  });
  const notify = vi.fn();

  return { chapterStore, paymentStore, notify, save, saved };
}

function makeHandler(h: Harness) {
  return createFatherDialogueCompletionHandler({
    chapterStore: {
      hydrate: () => h.chapterStore.getState().hydrate(),
      completeQuest: (questId) => h.chapterStore.getState().completeQuest(questId),
      getState: () => h.chapterStore.getState(),
    },
    paymentStore: {
      hydrate: () => h.paymentStore.getState().hydrate(),
      getState: () => h.paymentStore.getState(),
    },
    notify: h.notify,
  });
}

describe("Godot chapter bridge validation", () => {
  it("accepts only the exact father-dialogue completion payload", () => {
    expect(isFatherDialogueCompletionPayload(FATHER_DIALOGUE_COMPLETION_PAYLOAD)).toBe(true);
    expect(isFatherDialogueCompletionPayload(null)).toBe(false);
    expect(isFatherDialogueCompletionPayload({ ...FATHER_DIALOGUE_COMPLETION_PAYLOAD, type: "codequest:open-os" })).toBe(false);
    expect(isFatherDialogueCompletionPayload({ ...FATHER_DIALOGUE_COMPLETION_PAYLOAD, source: "browser" })).toBe(false);
    expect(isFatherDialogueCompletionPayload({ ...FATHER_DIALOGUE_COMPLETION_PAYLOAD, questId: "CH1-07" })).toBe(false);
    expect(isFatherDialogueCompletionPayload({ ...FATHER_DIALOGUE_COMPLETION_PAYLOAD, dialogueId: "father-v1" })).toBe(false);
    expect(isFatherDialogueCompletionPayload({ ...FATHER_DIALOGUE_COMPLETION_PAYLOAD, eventId: "guess" })).toBe(false);
  });

  it("rejects messages from another origin or another frame", () => {
    const origin = "http://localhost:5199";
    const source = { name: "godot-iframe" };
    const message = { origin, source, data: FATHER_DIALOGUE_COMPLETION_PAYLOAD };

    expect(isFatherDialogueCompletionMessage(message, origin, source)).toBe(true);
    expect(isFatherDialogueCompletionMessage(message, "https://evil.example", source)).toBe(false);
    expect(isFatherDialogueCompletionMessage(message, origin, { name: "other" })).toBe(false);
    expect(
      isFatherDialogueCompletionMessage(
        { origin, source, data: { ...FATHER_DIALOGUE_COMPLETION_PAYLOAD, type: "codequest:open-os" } },
        origin,
        source,
      ),
    ).toBe(false);
  });

  it("mirrors the active quest, wallet, payment flag, and chapter-complete state", () => {
    expect(createCodeQuestChapterState(progressAfter(7))).toEqual({
      schema: 1,
      questId: "CH1-08",
      chapterComplete: false,
      money: 50,
      paymentClaimed: true,
    });
    expect(createCodeQuestChapterState(progressAfter(8))).toEqual({
      schema: 1,
      questId: null,
      chapterComplete: true,
      money: 50,
      paymentClaimed: true,
    });
  });
});

describe("Father dialogue completion", () => {
  it("keeps CH1-08 active after payment and does not save before the father event", async () => {
    const h = makeHarness();
    await h.chapterStore.getState().hydrate();

    expect(getCurrentChapter1Quest(h.chapterStore.getState().progress)?.id).toBe("CH1-08");
    expect(h.chapterStore.getState().progress.completedQuestIds).not.toContain("CH1-08");
    expect(h.save).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("completes CH1-08 only through a valid father event and notifies once", async () => {
    const h = makeHarness();
    const handle = makeHandler(h);

    const result = await handle(FATHER_DIALOGUE_COMPLETION_PAYLOAD);

    expect(result).toEqual({ status: "completed" });
    expect(h.chapterStore.getState().progress.currentQuestIndex).toBe(CHAPTER1_QUESTS.length);
    expect(h.chapterStore.getState().progress.completedQuestIds).toEqual(
      CHAPTER1_QUESTS.map((quest) => quest.id),
    );
    expect(h.saved).toHaveLength(1);
    expect(h.saved[0]?.progress.money).toBe(50);
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.notify).toHaveBeenCalledWith({
      kind: "success",
      title: CHAPTER1_COMPLETE_TITLE,
      message: CHAPTER1_COMPLETE_MESSAGE,
    });
  });

  it("does not require money === 50 and preserves a larger wallet", async () => {
    const h = makeHarness({ money: 75 });
    const handle = makeHandler(h);

    const result = await handle(FATHER_DIALOGUE_COMPLETION_PAYLOAD);

    expect(result.status).toBe("completed");
    expect(h.chapterStore.getState().progress.money).toBe(75);
    expect(h.saved[0]?.progress.money).toBe(75);
    expect(h.saved[0]?.progress.paymentClaimed).toBe(true);
  });

  it("does not complete before CH1-07 or without the paid payment record", async () => {
    const early = makeHarness({ chapterIndex: 6, money: 0, paymentClaimed: false, paymentRecord: null });
    const earlyResult = await makeHandler(early)(FATHER_DIALOGUE_COMPLETION_PAYLOAD);
    expect(earlyResult.status).toBe("blocked");
    expect(early.save).not.toHaveBeenCalled();

    const unclaimed = makeHarness({ paymentClaimed: false });
    const unclaimedResult = await makeHandler(unclaimed)(FATHER_DIALOGUE_COMPLETION_PAYLOAD);
    expect(unclaimedResult.status).toBe("blocked");
    expect(unclaimed.save).not.toHaveBeenCalled();

    const noRecord = makeHarness({ paymentRecord: null });
    const noRecordResult = await makeHandler(noRecord)(FATHER_DIALOGUE_COMPLETION_PAYLOAD);
    expect(noRecordResult.status).toBe("blocked");
    expect(noRecord.save).not.toHaveBeenCalled();
  });

  it("rejects malformed events without touching progress", async () => {
    const h = makeHarness();
    const handle = makeHandler(h);

    const invalid = {
      ...FATHER_DIALOGUE_COMPLETION_PAYLOAD,
      type: "codequest:player-moved",
    };
    const result = await handle(invalid);

    expect(result.status).toBe("invalid-event");
    expect(h.save).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("deduplicates repeated events without duplicate completion or notification", async () => {
    const h = makeHarness();
    const handle = makeHandler(h);

    expect((await handle(FATHER_DIALOGUE_COMPLETION_PAYLOAD)).status).toBe("completed");
    expect((await handle(FATHER_DIALOGUE_COMPLETION_PAYLOAD)).status).toBe("duplicate");

    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.notify).toHaveBeenCalledTimes(1);
  });

  it("allows a safe retry after a failed save without double completion", async () => {
    let attempt = 0;
    const h = makeHarness({
      saveOk: () => {
        attempt += 1;
        return attempt > 1;
      },
    });
    const handle = makeHandler(h);

    const failed = await handle(FATHER_DIALOGUE_COMPLETION_PAYLOAD);
    expect(failed.status).toBe("retry");
    expect(h.chapterStore.getState().progress.currentQuestIndex).toBe(7);
    expect(h.notify).not.toHaveBeenCalled();

    const retried = await handle(FATHER_DIALOGUE_COMPLETION_PAYLOAD);
    expect(retried.status).toBe("completed");
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.chapterStore.getState().progress.currentQuestIndex).toBe(8);
  });

  it("persists completion across reload and never pays again", async () => {
    const first = makeHarness({ money: 75 });
    const firstHandler = makeHandler(first);
    expect((await firstHandler(FATHER_DIALOGUE_COMPLETION_PAYLOAD)).status).toBe("completed");

    const savedRecord = first.saved[0]!;
    const reloadedSave = vi.fn(async (_record: Chapter1SaveRecord) => true);
    const reloadedChapter = createChapter1Store({
      load: async () => savedRecord,
      save: reloadedSave,
    });
    const reloadedPayment = createCafePaymentStore({
      load: async () => createCafePaymentSaveRecord(payment),
    });
    const reloadedNotify = vi.fn();
    const reloadedHandler = createFatherDialogueCompletionHandler({
      chapterStore: {
        hydrate: () => reloadedChapter.getState().hydrate(),
        completeQuest: (questId) => reloadedChapter.getState().completeQuest(questId),
        getState: () => reloadedChapter.getState(),
      },
      paymentStore: {
        hydrate: () => reloadedPayment.getState().hydrate(),
        getState: () => reloadedPayment.getState(),
      },
      notify: reloadedNotify,
    });

    await reloadedChapter.getState().hydrate();
    expect(reloadedChapter.getState().progress.currentQuestIndex).toBe(CHAPTER1_QUESTS.length);
    expect(reloadedChapter.getState().progress.money).toBe(75);
    expect(reloadedChapter.getState().progress.completedQuestIds).toHaveLength(CHAPTER1_QUESTS.length);

    expect((await reloadedHandler(FATHER_DIALOGUE_COMPLETION_PAYLOAD)).status).toBe("already-complete");
    expect(reloadedSave).not.toHaveBeenCalled();
    expect(reloadedNotify).not.toHaveBeenCalled();
  });

  it("preserves the Step 8F payment and storage record shape", async () => {
    const h = makeHarness();
    const handle = makeHandler(h);
    const originalPayment = JSON.parse(JSON.stringify(payment)) as CafePaymentRecord;

    expect((await handle(FATHER_DIALOGUE_COMPLETION_PAYLOAD)).status).toBe("completed");

    expect(h.saved[0]).toEqual({
      version: CHAPTER1_SAVE_VERSION,
      progress: {
        ...progressAfter(8),
        money: 50,
        paymentClaimed: true,
      },
    });
    expect(payment).toEqual(originalPayment);
    expect(h.saved[0]?.progress.money).toBe(50);
    expect(h.saved[0]?.progress.paymentClaimed).toBe(true);
    expect(CHAPTER1_STORAGE_STORE).toBe("progress");
    expect(CHAPTER1_STORAGE_KEY).toBe("chapter1");
    expect(CAFE_PAYMENT_STATUS).toBe("paid");
  });
});

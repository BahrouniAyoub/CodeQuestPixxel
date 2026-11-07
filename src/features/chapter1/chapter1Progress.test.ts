import { describe, expect, it } from "vitest";
import {
  CHAPTER1_PAYMENT_REWARD,
  CHAPTER1_QUESTS,
  CHAPTER1_QUEST_IDS,
  isChapter1QuestId,
  type Chapter1QuestId,
} from "./chapter1Quests";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "./chapter1Progress";

const INVALID_QUEST_ID = "CH1-99" as Chapter1QuestId;

/** Build a state with the first `count` quests completed, using only the public API. */
function withCompletedQuestCount(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

describe("Chapter 1 quest definitions", () => {
  it("defines the eight quests once, in story order", () => {
    // This expected list is an executable specification for the canonical order.
    expect(CHAPTER1_QUEST_IDS).toEqual([
      "CH1-01",
      "CH1-02",
      "CH1-03",
      "CH1-04",
      "CH1-05",
      "CH1-06",
      "CH1-07",
      "CH1-08",
    ]);
    expect(new Set(CHAPTER1_QUEST_IDS).size).toBe(CHAPTER1_QUEST_IDS.length);
  });

  it("only recognises valid quest IDs at runtime", () => {
    expect(isChapter1QuestId("CH1-04")).toBe(true);
    expect(isChapter1QuestId("CH1-99")).toBe(false);
    expect(isChapter1QuestId("")).toBe(false);
    expect(isChapter1QuestId(undefined)).toBe(false);
  });
});

describe("Chapter 1 quest progression", () => {
  it("starts at CH1-01 with no completed quests", () => {
    expect(initialChapter1Progress.currentQuestIndex).toBe(0);
    expect(initialChapter1Progress.completedQuestIds).toEqual([]);
    expect(getCurrentChapter1Quest(initialChapter1Progress)?.id).toBe("CH1-01");
  });

  it("starts with $0 and no claimed payment", () => {
    expect(initialChapter1Progress.money).toBe(0);
    expect(initialChapter1Progress.paymentClaimed).toBe(false);
  });

  it("completing CH1-01 unlocks CH1-02", () => {
    const next = completeChapter1Quest(initialChapter1Progress, "CH1-01");

    expect(next).not.toBe(initialChapter1Progress);
    expect(next.currentQuestIndex).toBe(1);
    expect(next.completedQuestIds).toEqual(["CH1-01"]);
    expect(getCurrentChapter1Quest(next)?.id).toBe("CH1-02");
    expect(next.money).toBe(0);
  });

  it("does nothing when an inactive quest is completed", () => {
    expect(completeChapter1Quest(initialChapter1Progress, "CH1-02")).toBe(initialChapter1Progress);

    const afterFirst = completeChapter1Quest(initialChapter1Progress, "CH1-01");
    expect(completeChapter1Quest(afterFirst, "CH1-03")).toBe(afterFirst);
    expect(completeChapter1Quest(afterFirst, "CH1-08")).toBe(afterFirst);
  });

  it("does nothing when an already completed quest is repeated", () => {
    const afterFirst = completeChapter1Quest(initialChapter1Progress, "CH1-01");
    const repeated = completeChapter1Quest(afterFirst, "CH1-01");

    expect(repeated).toBe(afterFirst);
    expect(repeated.completedQuestIds).toEqual(["CH1-01"]);
  });

  it("does not mutate the original progress object", () => {
    const progress: Chapter1Progress = {
      currentQuestIndex: 0,
      completedQuestIds: [],
      money: 0,
      paymentClaimed: false,
    };
    const snapshot = { ...progress, completedQuestIds: [...progress.completedQuestIds] };

    const next = completeChapter1Quest(progress, "CH1-01");

    expect(progress).toEqual(snapshot);
    expect(next.completedQuestIds).not.toBe(progress.completedQuestIds);
  });

  it("does not grant money for the first six quests", () => {
    const progress = withCompletedQuestCount(6);

    expect(progress.currentQuestIndex).toBe(6);
    expect(progress.completedQuestIds).toEqual([
      "CH1-01",
      "CH1-02",
      "CH1-03",
      "CH1-04",
      "CH1-05",
      "CH1-06",
    ]);
    expect(progress.money).toBe(0);
    expect(progress.paymentClaimed).toBe(false);
    expect(getCurrentChapter1Quest(progress)?.id).toBe("CH1-07");
  });

  it("grants exactly $50 when CH1-07 is completed", () => {
    const beforePayment = withCompletedQuestCount(6);
    const paid = completeChapter1Quest(beforePayment, "CH1-07");

    expect(CHAPTER1_PAYMENT_REWARD).toBe(50);
    expect(paid.money).toBe(50);
    expect(paid.paymentClaimed).toBe(true);
    expect(paid.completedQuestIds).toContain("CH1-07");
    expect(getCurrentChapter1Quest(paid)?.id).toBe("CH1-08");
  });

  it("does not grant a second $50 when CH1-07 is repeated", () => {
    const paid = completeChapter1Quest(withCompletedQuestCount(6), "CH1-07");
    const repeated = completeChapter1Quest(paid, "CH1-07");

    expect(repeated).toBe(paid);
    expect(repeated.money).toBe(50);
    expect(repeated.completedQuestIds.filter((id) => id === "CH1-07")).toHaveLength(1);
  });

  it("does not allow the payment to be claimed early", () => {
    const attempt = completeChapter1Quest(initialChapter1Progress, "CH1-07");

    expect(attempt).toBe(initialChapter1Progress);
    expect(attempt.money).toBe(0);
    expect(attempt.paymentClaimed).toBe(false);
  });

  it("completing CH1-08 ends the chapter", () => {
    const finished = completeChapter1Quest(withCompletedQuestCount(7), "CH1-08");

    expect(finished.currentQuestIndex).toBe(CHAPTER1_QUESTS.length);
    expect(finished.completedQuestIds).toHaveLength(CHAPTER1_QUESTS.length);
    expect(finished.completedQuestIds.at(-1)).toBe("CH1-08");
    expect(finished.money).toBe(50);
  });

  it("returns null for the active quest after the chapter is complete", () => {
    const finished = withCompletedQuestCount(CHAPTER1_QUESTS.length);

    expect(getCurrentChapter1Quest(finished)).toBeNull();
  });

  it("does nothing when quests are completed after the chapter ends", () => {
    const finished = withCompletedQuestCount(CHAPTER1_QUESTS.length);

    expect(completeChapter1Quest(finished, "CH1-08")).toBe(finished);
    expect(completeChapter1Quest(finished, "CH1-01")).toBe(finished);
    expect(completeChapter1Quest(finished, INVALID_QUEST_ID)).toBe(finished);
  });

  it("ignores invalid quest IDs and corrupt quest indexes without corrupting state", () => {
    expect(completeChapter1Quest(initialChapter1Progress, INVALID_QUEST_ID)).toBe(
      initialChapter1Progress,
    );

    const outOfRange: Chapter1Progress = { ...initialChapter1Progress, currentQuestIndex: 99 };
    expect(getCurrentChapter1Quest(outOfRange)).toBeNull();
    expect(completeChapter1Quest(outOfRange, "CH1-01")).toBe(outOfRange);

    const negative: Chapter1Progress = { ...initialChapter1Progress, currentQuestIndex: -1 };
    expect(getCurrentChapter1Quest(negative)).toBeNull();
    expect(completeChapter1Quest(negative, "CH1-01")).toBe(negative);
  });
});

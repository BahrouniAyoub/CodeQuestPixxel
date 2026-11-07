import { describe, expect, it, vi } from "vitest";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { evaluateCafeCodingAccess, syncCafeProjectQuest } from "./cafeQuestSync";

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

const COMPLETE_CAFE_INPUT = {
  milestoneHydrated: true,
  allMilestonesComplete: true,
  chapterHydrated: true,
  currentQuestId: "CH1-05" as const,
  completedQuestIds: ["CH1-01", "CH1-02", "CH1-03", "CH1-04"] as const,
  applicationStatus: "accepted" as const,
};

describe("café coding access", () => {
  it("blocks the project before client acceptance", () => {
    expect(
      evaluateCafeCodingAccess({
        chapterHydrated: true,
        milestoneHydrated: true,
        applicationStatus: "submitted",
        currentQuestId: "CH1-04",
      }),
    ).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/accepts your proposal/i),
    });
  });

  it("blocks verification outside CH1-05", () => {
    expect(
      evaluateCafeCodingAccess({
        chapterHydrated: true,
        milestoneHydrated: true,
        applicationStatus: "accepted",
        currentQuestId: "CH1-04",
      }),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/CH1-05/) });
  });

  it("allows verification for an accepted project while CH1-05 is active", () => {
    expect(
      evaluateCafeCodingAccess({
        chapterHydrated: true,
        milestoneHydrated: true,
        applicationStatus: "accepted",
        currentQuestId: "CH1-05",
      }),
    ).toMatchObject({ allowed: true });
  });
});

describe("café Chapter 1 quest sync", () => {
  it("does not complete CH1-05 before all three milestones pass", async () => {
    const completeQuest = vi.fn(async () => true);

    const result = await syncCafeProjectQuest({
      ...COMPLETE_CAFE_INPUT,
      allMilestonesComplete: false,
      completeQuest,
    });

    expect(result.ok).toBe(false);
    expect(completeQuest).not.toHaveBeenCalled();
  });

  it("does not complete CH1-05 for a submitted application", async () => {
    const completeQuest = vi.fn(async () => true);

    const result = await syncCafeProjectQuest({
      ...COMPLETE_CAFE_INPUT,
      currentQuestId: null,
      completedQuestIds: ["CH1-01", "CH1-02", "CH1-03"],
      applicationStatus: "submitted",
      completeQuest,
    });

    expect(result.ok).toBe(false);
    expect(completeQuest).not.toHaveBeenCalled();
  });

  it("does not complete CH1-05 when another quest is active", async () => {
    const completeQuest = vi.fn(async () => true);

    const result = await syncCafeProjectQuest({
      ...COMPLETE_CAFE_INPUT,
      currentQuestId: "CH1-06",
      completedQuestIds: ["CH1-01", "CH1-02", "CH1-03", "CH1-04"],
      completeQuest,
    });

    expect(result.ok).toBe(false);
    expect(completeQuest).not.toHaveBeenCalled();
  });

  it("completes CH1-05 exactly once after 3/3 verified milestones", async () => {
    const completeQuest = vi.fn(async () => true);

    const result = await syncCafeProjectQuest({ ...COMPLETE_CAFE_INPUT, completeQuest });

    expect(result).toEqual({ ok: true, completed: true });
    expect(completeQuest).toHaveBeenCalledTimes(1);
    expect(completeQuest).toHaveBeenCalledWith("CH1-05");
  });

  it("does not duplicate completion when CH1-05 is already recorded", async () => {
    const completeQuest = vi.fn(async () => true);

    const result = await syncCafeProjectQuest({
      ...COMPLETE_CAFE_INPUT,
      currentQuestId: "CH1-06",
      completedQuestIds: ["CH1-01", "CH1-02", "CH1-03", "CH1-04", "CH1-05"],
      completeQuest,
    });

    expect(result).toEqual({ ok: true, completed: false });
    expect(completeQuest).not.toHaveBeenCalled();
  });

  it("returns a retryable quest-sync error and preserves milestone verification", async () => {
    const completeQuest = vi.fn(async () => false);

    const first = await syncCafeProjectQuest({ ...COMPLETE_CAFE_INPUT, completeQuest });

    expect(first.ok).toBe(false);
    expect(first.completed).toBe(false);
    expect(first.reason).toMatch(/milestones are saved/i);
    expect(first.reason).toMatch(/do not run the milestone tests again/i);

    const retry = await syncCafeProjectQuest({
      ...COMPLETE_CAFE_INPUT,
      completeQuest: vi.fn(async () => true),
    });

    expect(retry).toEqual({ ok: true, completed: true });
  });

  it("treats an already-advanced Chapter 1 state as synced", async () => {
    const completeQuest = vi.fn(async () => false);

    const result = await syncCafeProjectQuest({
      ...COMPLETE_CAFE_INPUT,
      completeQuest,
      readCurrentQuestId: () => "CH1-06",
    });

    expect(result).toEqual({ ok: true, completed: false });
    expect(completeQuest).toHaveBeenCalledTimes(1);
  });

  it("advances to CH1-06 without granting the $50 payment or completing CH1-06", () => {
    const afterBuild = completeChapter1Quest(progressAfter(4), "CH1-05");

    expect(getCurrentChapter1Quest(afterBuild)?.id).toBe("CH1-06");
    expect(afterBuild.completedQuestIds).toContain("CH1-05");
    expect(afterBuild.completedQuestIds).not.toContain("CH1-06");
    expect(afterBuild.completedQuestIds).not.toContain("CH1-07");
    expect(afterBuild.money).toBe(0);
    expect(afterBuild.paymentClaimed).toBe(false);
  });
});

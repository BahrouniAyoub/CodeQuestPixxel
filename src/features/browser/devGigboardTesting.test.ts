import { describe, expect, it, vi, type Mock } from "vitest";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { createChapter1Store } from "@/features/chapter1/chapter1Store";
import {
  createChapter1SaveRecord,
  type Chapter1SaveRecord,
} from "@/features/chapter1/chapter1Validation";
import {
  GIGBOARD_DEV_TEST_QUEST_IDS,
  isDevTestingEnabled,
  unlockCafeApplicationForTesting,
} from "./devGigboardTesting";

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

interface Harness {
  store: ReturnType<typeof createChapter1Store>;
  load: Mock<() => Promise<unknown>>;
  save: Mock<(record: Chapter1SaveRecord) => Promise<boolean>>;
  saved: Chapter1SaveRecord[];
}

function makeStore(
  raw: unknown = undefined,
  saveResult: () => Promise<boolean> = async () => true,
): Harness {
  const saved: Chapter1SaveRecord[] = [];
  const load = vi.fn(async () => raw);
  const save = vi.fn(async (record: Chapter1SaveRecord) => {
    const ok = await saveResult();
    if (ok) saved.push(record);
    return ok;
  });
  return { store: createChapter1Store({ load, save }), load, save, saved };
}

describe("GigBoard development testing controls", () => {
  it("advances only CH1-01 through CH1-03 and stops at CH1-04", async () => {
    const h = makeStore();

    const result = await unlockCafeApplicationForTesting(h.store, true);

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/CH1-04/);
    expect(h.save).toHaveBeenCalledTimes(3);
    expect(h.saved.map((record) => record.progress.completedQuestIds)).toEqual([
      ["CH1-01"],
      ["CH1-01", "CH1-02"],
      ["CH1-01", "CH1-02", "CH1-03"],
    ]);
    expect(getCurrentChapter1Quest(h.store.getState().progress)?.id).toBe("CH1-04");
    expect(h.store.getState().progress.money).toBe(0);
    expect(h.store.getState().progress.paymentClaimed).toBe(false);
  });

  it("uses the canonical CH1-01..CH1-03 testing sequence", () => {
    expect(GIGBOARD_DEV_TEST_QUEST_IDS).toEqual(["CH1-01", "CH1-02", "CH1-03"]);
  });

  it("does not re-complete quests that are already finished", async () => {
    const h = makeStore(createChapter1SaveRecord(progressAfter(2)));

    const result = await unlockCafeApplicationForTesting(h.store, true);

    expect(result.ok).toBe(true);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.saved[0]?.progress.completedQuestIds).toEqual(["CH1-01", "CH1-02", "CH1-03"]);
    expect(getCurrentChapter1Quest(h.store.getState().progress)?.id).toBe("CH1-04");
  });

  it("does nothing when CH1-04 is already active", async () => {
    const h = makeStore(createChapter1SaveRecord(progressAfter(3)));

    const result = await unlockCafeApplicationForTesting(h.store, true);

    expect(result.ok).toBe(true);
    expect(h.save).not.toHaveBeenCalled();
    expect(getCurrentChapter1Quest(h.store.getState().progress)?.id).toBe("CH1-04");
  });

  it("does not regress a Chapter 1 that is already past CH1-04", async () => {
    const h = makeStore(createChapter1SaveRecord(progressAfter(4)));

    const result = await unlockCafeApplicationForTesting(h.store, true);

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/already past CH1-04/i);
    expect(h.save).not.toHaveBeenCalled();
    expect(getCurrentChapter1Quest(h.store.getState().progress)?.id).toBe("CH1-05");
  });

  it("cannot be enabled or run outside development", async () => {
    const h = makeStore();

    expect(isDevTestingEnabled(false)).toBe(false);
    expect(isDevTestingEnabled(true)).toBe(true);

    const result = await unlockCafeApplicationForTesting(h.store, false);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/disabled/i);
    expect(h.load).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
    expect(h.store.getState().progress).toEqual(initialChapter1Progress);
  });

  it("reports a save failure without unlocking the job", async () => {
    const h = makeStore(undefined, async () => false);

    const result = await unlockCafeApplicationForTesting(h.store, true);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/could not save/i);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.store.getState().progress).toEqual(initialChapter1Progress);
    expect(getCurrentChapter1Quest(h.store.getState().progress)?.id).toBe("CH1-01");
  });

  it("reports a hydration failure instead of advancing quests", async () => {
    const h = makeStore();
    h.load.mockRejectedValue(new Error("IndexedDB unavailable"));

    const result = await unlockCafeApplicationForTesting(h.store, true);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/could not load/i);
    expect(h.save).not.toHaveBeenCalled();
    expect(h.store.getState().hydrated).toBe(false);
  });
});

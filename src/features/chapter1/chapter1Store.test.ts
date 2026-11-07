import { describe, expect, it, vi, type Mock } from "vitest";
import { CHAPTER1_QUESTS, type Chapter1QuestId } from "./chapter1Quests";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "./chapter1Progress";
import { CHAPTER1_STORAGE_KEY, CHAPTER1_STORAGE_STORE, createChapter1Store } from "./chapter1Store";
import { createChapter1SaveRecord, type Chapter1SaveRecord } from "./chapter1Validation";

const INVALID_QUEST_ID = "CH1-99" as Chapter1QuestId;

interface Harness {
  store: ReturnType<typeof createChapter1Store>;
  load: Mock<() => Promise<unknown>>;
  save: Mock<(record: Chapter1SaveRecord) => Promise<boolean>>;
  saved: Chapter1SaveRecord[];
}

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function recordAfter(count: number): Chapter1SaveRecord {
  return createChapter1SaveRecord(progressAfter(count));
}

function makeStore(
  raw: unknown,
  saveResult: (record: Chapter1SaveRecord) => Promise<boolean> = async () => true,
): Harness {
  const saved: Chapter1SaveRecord[] = [];
  const load = vi.fn(async () => raw);
  const save = vi.fn(async (record: Chapter1SaveRecord) => {
    const ok = await saveResult(record);
    if (ok) saved.push(record);
    return ok;
  });
  const store = createChapter1Store({ load, save });
  return { store, load, save, saved };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function expectMalformedFallback(raw: unknown): Promise<void> {
  const h = makeStore(raw);
  await h.store.getState().hydrate();
  const state = h.store.getState();

  expect(state.progress).toEqual(initialChapter1Progress);
  expect(state.hydrated).toBe(true);
  expect(state.loading).toBe(false);
  expect(state.error).toContain("invalid");
  expect(h.save).not.toHaveBeenCalled();
}

describe("Chapter 1 store", () => {
  it("starts with initial progress and is not hydrated", () => {
    const { store } = makeStore(undefined);
    const state = store.getState();

    expect(state.progress).toEqual(initialChapter1Progress);
    expect(state.hydrated).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("uses initial progress when no save exists", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.store.getState().progress).toEqual(initialChapter1Progress);
    expect(h.store.getState().hydrated).toBe(true);
    expect(h.store.getState().error).toBeNull();
  });

  it("hydrates valid saved progress", async () => {
    const savedProgress = progressAfter(2);
    const h = makeStore(createChapter1SaveRecord(savedProgress));

    await h.store.getState().hydrate();

    expect(h.store.getState().progress).toEqual(savedProgress);
    expect(getCurrentChapter1Quest(h.store.getState().progress)?.id).toBe("CH1-03");
    expect(h.store.getState().hydrated).toBe(true);
    expect(h.save).not.toHaveBeenCalled();
  });

  it("saves a valid quest completion with all progress fields", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const saved = await h.store.getState().completeQuest("CH1-01");

    expect(saved).toBe(true);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.saved[0]).toEqual(createChapter1SaveRecord(progressAfter(1)));
    expect(h.store.getState().progress).toEqual(progressAfter(1));
  });

  it("does not write when a completed quest is repeated", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();
    await h.store.getState().completeQuest("CH1-01");

    const repeated = await h.store.getState().completeQuest("CH1-01");

    expect(repeated).toBe(false);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.store.getState().progress).toEqual(progressAfter(1));
  });

  it("does not write when a quest is skipped", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const skipped = await h.store.getState().completeQuest("CH1-02");

    expect(skipped).toBe(false);
    expect(h.save).not.toHaveBeenCalled();
    expect(h.store.getState().progress).toEqual(initialChapter1Progress);
  });

  it("keeps the $50 payment after reload and preserves it on the next save", async () => {
    const h = makeStore(recordAfter(7));
    await h.store.getState().hydrate();

    expect(h.store.getState().progress.money).toBe(50);
    expect(h.store.getState().progress.paymentClaimed).toBe(true);

    const saved = await h.store.getState().completeQuest("CH1-08");

    expect(saved).toBe(true);
    expect(h.saved[0]?.progress.money).toBe(50);
    expect(h.saved[0]?.progress.paymentClaimed).toBe(true);
    expect(h.store.getState().progress.money).toBe(50);
  });

  it("does not pay twice when CH1-07 is repeated", async () => {
    const h = makeStore(recordAfter(6));
    await h.store.getState().hydrate();

    expect(await h.store.getState().completeQuest("CH1-07")).toBe(true);
    expect(await h.store.getState().completeQuest("CH1-07")).toBe(false);

    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.store.getState().progress.money).toBe(50);
    expect(h.saved[0]?.progress.money).toBe(50);

    const paid = makeStore(recordAfter(7));
    await paid.store.getState().hydrate();
    expect(await paid.store.getState().completeQuest("CH1-07")).toBe(false);
    expect(paid.save).not.toHaveBeenCalled();
  });

  it("rejects invalid quest IDs without writing", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const saved = await h.store.getState().completeQuest(INVALID_QUEST_ID);

    expect(saved).toBe(false);
    expect(h.save).not.toHaveBeenCalled();
    expect(h.store.getState().progress).toEqual(initialChapter1Progress);
  });

  it("rejects malformed saved data and reports recovery", async () => {
    await expectMalformedFallback({
      version: 1,
      progress: {
        currentQuestIndex: 2,
        completedQuestIds: ["CH1-01"],
        money: 0,
        paymentClaimed: false,
      },
    });
  });

  it("rejects saved quests that are not the canonical prefix", async () => {
    await expectMalformedFallback({
      version: 1,
      progress: {
        currentQuestIndex: 2,
        completedQuestIds: ["CH1-02", "CH1-01"],
        money: 0,
        paymentClaimed: false,
      },
    });
  });

  it("rejects inconsistent payment flags and money", async () => {
    await expectMalformedFallback({
      version: 1,
      progress: {
        currentQuestIndex: 6,
        completedQuestIds: ["CH1-01", "CH1-02", "CH1-03", "CH1-04", "CH1-05", "CH1-06"],
        money: 0,
        paymentClaimed: true,
      },
    });

    await expectMalformedFallback({
      version: 1,
      progress: {
        currentQuestIndex: 6,
        completedQuestIds: ["CH1-01", "CH1-02", "CH1-03", "CH1-04", "CH1-05", "CH1-06"],
        money: 50,
        paymentClaimed: false,
      },
    });
  });

  it("applies rapid completions in order without losing progress", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const first = h.store.getState().completeQuest("CH1-01");
    const second = h.store.getState().completeQuest("CH1-02");

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.saved.map((record) => record.progress.currentQuestIndex)).toEqual([1, 2]);
    expect(h.store.getState().progress).toEqual(progressAfter(2));
  });

  it("serializes overlapping saves so an older write cannot overwrite newer state", async () => {
    let saveCalls = 0;
    const firstSaveStarted = deferred<void>();
    const firstSaveGate = deferred<boolean>();
    const saved: Chapter1SaveRecord[] = [];
    const save = vi.fn(async (record: Chapter1SaveRecord) => {
      saveCalls += 1;
      saved.push(record);
      if (saveCalls === 1) {
        firstSaveStarted.resolve(undefined);
        return firstSaveGate.promise;
      }
      return true;
    });
    const store = createChapter1Store({ load: vi.fn(async () => undefined), save });
    await store.getState().hydrate();

    const first = store.getState().completeQuest("CH1-01");
    const second = store.getState().completeQuest("CH1-02");
    await firstSaveStarted.promise;

    expect(save).toHaveBeenCalledTimes(1);
    expect(store.getState().progress.currentQuestIndex).toBe(0);

    firstSaveGate.resolve(true);
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);

    expect(save).toHaveBeenCalledTimes(2);
    expect(saved[0]?.progress.currentQuestIndex).toBe(1);
    expect(saved[1]?.progress.completedQuestIds).toEqual(["CH1-01", "CH1-02"]);
    expect(store.getState().progress).toEqual(progressAfter(2));
  });

  it("handles repeated hydration calls and does not reset in-memory progress", async () => {
    const h = makeStore(undefined);

    await Promise.all([
      h.store.getState().hydrate(),
      h.store.getState().hydrate(),
      h.store.getState().hydrate(),
    ]);
    expect(h.load).toHaveBeenCalledTimes(1);

    await h.store.getState().completeQuest("CH1-01");
    await h.store.getState().hydrate();

    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.store.getState().progress).toEqual(progressAfter(1));
  });

  it("reports load failures, blocks pre-hydration saves, and allows retry", async () => {
    const h = makeStore(undefined);
    h.load.mockRejectedValue(new Error("IndexedDB unavailable"));

    await h.store.getState().hydrate();

    expect(h.store.getState().hydrated).toBe(false);
    expect(h.store.getState().loading).toBe(false);
    expect(h.store.getState().error).toContain("Could not load");
    expect(await h.store.getState().completeQuest("CH1-01")).toBe(false);
    expect(h.save).not.toHaveBeenCalled();

    h.load.mockResolvedValue(undefined);
    await h.store.getState().hydrate();
    expect(h.store.getState().hydrated).toBe(true);
    expect(h.store.getState().error).toBeNull();
    expect(await h.store.getState().completeQuest("CH1-01")).toBe(true);
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it("reports save failures, keeps prior state, and allows a retry", async () => {
    let allowSave = false;
    const h = makeStore(undefined, async () => allowSave);
    await h.store.getState().hydrate();

    expect(await h.store.getState().completeQuest("CH1-01")).toBe(false);
    expect(h.store.getState().progress).toEqual(initialChapter1Progress);
    expect(h.store.getState().error).toContain("Could not save");

    allowSave = true;
    expect(await h.store.getState().completeQuest("CH1-01")).toBe(true);
    expect(h.store.getState().progress).toEqual(progressAfter(1));
    expect(h.store.getState().error).toBeNull();
    expect(h.saved).toHaveLength(1);
  });

  it("uses a Chapter 1-specific record and leaves ticket progress untouched", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();
    await h.store.getState().completeQuest("CH1-01");

    expect(CHAPTER1_STORAGE_STORE).toBe("progress");
    expect(CHAPTER1_STORAGE_KEY).toBe("chapter1");
    expect(CHAPTER1_STORAGE_KEY).not.toBe("state");
    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it("does not reject Pixel OS startup when Chapter 1 storage is unavailable", async () => {
    const h = makeStore(undefined);
    h.load.mockRejectedValueOnce(new Error("no storage"));

    await expect(
      Promise.all([h.store.getState().hydrate(), Promise.resolve("tickets-restored")]),
    ).resolves.toEqual([undefined, "tickets-restored"]);
  });
});

import { describe, expect, it, vi, type Mock } from "vitest";
import {
  CAFE_MILESTONE_STORAGE_KEY,
  CAFE_MILESTONE_STORAGE_STORE,
  createCafeMilestoneStore,
} from "./cafeMilestoneStore";
import {
  createCafeMilestoneSaveRecord,
  initialCafeMilestoneProgress,
  completeCafeMilestone,
  type CafeMilestoneProgress,
  type CafeMilestoneSaveRecord,
} from "./cafeMilestoneProgress";
import { CAFE_MILESTONES } from "./cafeMilestones";

const TIMES = ["2026-01-02T09:00:00.000Z", "2026-01-02T09:10:00.000Z", "2026-01-02T09:20:00.000Z"];

function progressAfter(count: number): CafeMilestoneProgress {
  return CAFE_MILESTONES.slice(0, count).reduce(
    (progress, milestone) => completeCafeMilestone(progress, milestone.id, TIMES[milestone.index]),
    initialCafeMilestoneProgress,
  );
}

interface Harness {
  store: ReturnType<typeof createCafeMilestoneStore>;
  load: Mock<() => Promise<unknown>>;
  save: Mock<(record: CafeMilestoneSaveRecord) => Promise<boolean>>;
  saved: CafeMilestoneSaveRecord[];
}

function makeStore(
  raw: unknown,
  saveResult: (record: CafeMilestoneSaveRecord) => Promise<boolean> = async () => true,
): Harness {
  const saved: CafeMilestoneSaveRecord[] = [];
  const load = vi.fn(async () => raw);
  const save = vi.fn(async (record: CafeMilestoneSaveRecord) => {
    const ok = await saveResult(record);
    if (ok) saved.push(record);
    return ok;
  });
  const store = createCafeMilestoneStore({ load, save });
  return { store, load, save, saved };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("café milestone store", () => {
  it("starts unhydrated at 0/3", () => {
    const h = makeStore(undefined);
    const state = h.store.getState();

    expect(state.progress).toEqual(initialCafeMilestoneProgress);
    expect(state.hydrated).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.questSyncError).toBeNull();
  });

  it("hydrates to milestone 1 when no save exists", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.store.getState().progress).toEqual(initialCafeMilestoneProgress);
    expect(h.store.getState().hydrated).toBe(true);
    expect(h.store.getState().error).toBeNull();
  });

  it("restores a valid saved milestone prefix after reload", async () => {
    const savedProgress = progressAfter(2);
    const h = makeStore(createCafeMilestoneSaveRecord(savedProgress));

    await h.store.getState().hydrate();

    expect(h.store.getState().progress).toEqual(savedProgress);
    expect(h.store.getState().progress.currentMilestoneIndex).toBe(2);
    expect(h.store.getState().hydrated).toBe(true);
    expect(h.save).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong version", { version: 9, progress: progressAfter(1) }],
    [
      "skipped milestone",
      {
        version: 1,
        progress: {
          currentMilestoneIndex: 1,
          completedMilestones: [{ milestoneId: "arithmetic-functions", completedAt: TIMES[1] }],
        },
      },
    ],
    ["not an object", "garbage"],
  ])("recovers safely from malformed saved data: %s", async (_label, raw) => {
    const h = makeStore(raw);

    await h.store.getState().hydrate();

    expect(h.store.getState().progress).toEqual(initialCafeMilestoneProgress);
    expect(h.store.getState().hydrated).toBe(true);
    expect(h.store.getState().error).toContain("invalid");
    expect(h.save).not.toHaveBeenCalled();
  });

  it("saves a milestone once and commits only after the write", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const result = await h.store.getState().completeMilestone("variables-print", TIMES[0]);

    expect(result).toEqual({ ok: true, alreadyCompleted: false });
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.saved[0]).toEqual(createCafeMilestoneSaveRecord(progressAfter(1)));
    expect(h.store.getState().progress).toEqual(progressAfter(1));
    expect(h.store.getState().error).toBeNull();
  });

  it("prevents skipping milestones", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const result = await h.store.getState().completeMilestone("arithmetic-functions", TIMES[1]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/in order/i);
    expect(h.save).not.toHaveBeenCalled();
    expect(h.store.getState().progress).toEqual(initialCafeMilestoneProgress);
  });

  it("prevents duplicate completion without writing again", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();
    await h.store.getState().completeMilestone("variables-print", TIMES[0]);

    const duplicate = await h.store.getState().completeMilestone("variables-print", TIMES[1]);

    expect(duplicate).toEqual({ ok: true, alreadyCompleted: true });
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.store.getState().progress).toEqual(progressAfter(1));
  });

  it("serializes overlapping milestone saves in order", async () => {
    let saveCalls = 0;
    const firstSaveStarted = deferred<void>();
    const firstSaveGate = deferred<boolean>();
    const saved: CafeMilestoneSaveRecord[] = [];
    const save = vi.fn(async (record: CafeMilestoneSaveRecord) => {
      saveCalls += 1;
      saved.push(record);
      if (saveCalls === 1) {
        firstSaveStarted.resolve(undefined);
        return firstSaveGate.promise;
      }
      return true;
    });
    const store = createCafeMilestoneStore({ load: vi.fn(async () => undefined), save });
    await store.getState().hydrate();

    const first = store.getState().completeMilestone("variables-print", TIMES[0]);
    const second = store.getState().completeMilestone("arithmetic-functions", TIMES[1]);
    await firstSaveStarted.promise;

    expect(save).toHaveBeenCalledTimes(1);
    expect(store.getState().progress.currentMilestoneIndex).toBe(0);

    firstSaveGate.resolve(true);
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, alreadyCompleted: false },
      { ok: true, alreadyCompleted: false },
    ]);

    expect(save).toHaveBeenCalledTimes(2);
    expect(saved[0]?.progress.currentMilestoneIndex).toBe(1);
    expect(saved[1]?.progress.currentMilestoneIndex).toBe(2);
    expect(store.getState().progress).toEqual(progressAfter(2));
  });

  it("keeps prior progress when the save fails and allows a retry", async () => {
    let allowSave = false;
    const h = makeStore(undefined, async () => allowSave);
    await h.store.getState().hydrate();

    const failed = await h.store.getState().completeMilestone("variables-print", TIMES[0]);

    expect(failed.ok).toBe(false);
    expect(h.store.getState().progress).toEqual(initialCafeMilestoneProgress);
    expect(h.store.getState().error).toContain("Could not save");
    expect(h.save).toHaveBeenCalledTimes(1);

    allowSave = true;
    const retried = await h.store.getState().completeMilestone("variables-print", TIMES[0]);

    expect(retried).toEqual({ ok: true, alreadyCompleted: false });
    expect(h.store.getState().progress).toEqual(progressAfter(1));
    expect(h.store.getState().error).toBeNull();
  });

  it("blocks completion when saved progress cannot be loaded", async () => {
    const h = makeStore(undefined);
    h.load.mockRejectedValue(new Error("IndexedDB unavailable"));

    await h.store.getState().hydrate();
    const blocked = await h.store.getState().completeMilestone("variables-print", TIMES[0]);

    expect(h.store.getState().hydrated).toBe(false);
    expect(blocked.ok).toBe(false);
    expect(h.save).not.toHaveBeenCalled();

    h.load.mockResolvedValue(undefined);
    await h.store.getState().hydrate();
    expect(await h.store.getState().completeMilestone("variables-print", TIMES[0])).toEqual({
      ok: true,
      alreadyCompleted: false,
    });
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it("stores a retryable quest-sync error without touching milestone progress", async () => {
    const h = makeStore(createCafeMilestoneSaveRecord(progressAfter(3)));
    await h.store.getState().hydrate();
    const before = h.store.getState().progress;

    h.store.getState().setQuestSyncError("Retry Chapter 1 update");

    expect(h.store.getState().questSyncError).toBe("Retry Chapter 1 update");
    expect(h.store.getState().progress).toBe(before);
    expect(h.save).not.toHaveBeenCalled();

    h.store.getState().clearQuestSyncError();
    expect(h.store.getState().questSyncError).toBeNull();
  });

  it("uses an isolated progress key and never touches Chapter 1 or ticket keys", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();
    await h.store.getState().completeMilestone("variables-print", TIMES[0]);

    expect(CAFE_MILESTONE_STORAGE_STORE).toBe("progress");
    expect(CAFE_MILESTONE_STORAGE_KEY).toBe("chapter1-cafe-milestones");
    expect(CAFE_MILESTONE_STORAGE_KEY).not.toBe("chapter1");
    expect(CAFE_MILESTONE_STORAGE_KEY).not.toBe("state");
    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.save).toHaveBeenCalledTimes(1);
  });
});

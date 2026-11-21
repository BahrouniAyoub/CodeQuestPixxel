import { describe, expect, it, vi, type Mock } from "vitest";
import { CAFE_DEV_TASKS } from "./cafeDevTasks";
import {
  createCafeDevSaveRecord,
  initialCafeDevProgress,
  type CafeDevSaveRecord,
} from "./cafeDevProgress";
import { createCafeDevStore } from "./cafeDevStore";

interface Harness {
  store: ReturnType<typeof createCafeDevStore>;
  load: Mock<() => Promise<unknown>>;
  save: Mock<(record: CafeDevSaveRecord) => Promise<boolean>>;
  saved: CafeDevSaveRecord[];
}

function makeStore(
  raw: unknown = undefined,
  saveResult: () => Promise<boolean> = async () => true,
): Harness {
  const saved: CafeDevSaveRecord[] = [];
  const load = vi.fn(async () => raw);
  const save = vi.fn(async (record: CafeDevSaveRecord) => {
    const ok = await saveResult();
    if (ok) saved.push(record);
    return ok;
  });
  return { store: createCafeDevStore({ load, save }), load, save, saved };
}

const COMPLETED_AT = "2026-01-02T09:00:00.000Z";

describe("café development store", () => {
  it("persists each task once, only when tests passed", async () => {
    const h = makeStore();

    for (const task of CAFE_DEV_TASKS) {
      const result = await h.store.getState().completeTask(task.id, COMPLETED_AT);
      expect(result).toEqual({ ok: true, alreadyCompleted: false });
    }

    expect(h.save).toHaveBeenCalledTimes(4);
    expect(h.saved.at(-1)?.progress.currentTaskIndex).toBe(4);
    expect(h.store.getState().progress.completedTasks.map((entry) => entry.taskId)).toEqual(
      CAFE_DEV_TASKS.map((task) => task.id),
    );
    expect(h.store.getState().hasSavedRecord).toBe(true);
  });

  it("reloads a saved development record without repeating completed tasks", async () => {
    let progress = initialCafeDevProgress;
    for (const task of CAFE_DEV_TASKS.slice(0, 2)) {
      progress = {
        currentTaskIndex: progress.currentTaskIndex + 1,
        completedTasks: [
          ...progress.completedTasks,
          { taskId: task.id, completedAt: COMPLETED_AT },
        ],
      };
    }

    const h = makeStore(createCafeDevSaveRecord(progress));
    await h.store.getState().hydrate();

    expect(h.store.getState().hasSavedRecord).toBe(true);
    expect(h.store.getState().progress.currentTaskIndex).toBe(2);

    const duplicate = await h.store.getState().completeTask("CAFE-DEV-01");
    expect(duplicate).toEqual({ ok: true, alreadyCompleted: true });
    expect(h.save).not.toHaveBeenCalled();
  });

  it("rejects skipped tasks and does not write", async () => {
    const h = makeStore();
    const result = await h.store.getState().completeTask("CAFE-DEV-03");

    expect(result.ok).toBe(false);
    expect(h.save).not.toHaveBeenCalled();
    expect(h.store.getState().progress).toEqual(initialCafeDevProgress);
  });

  it("does not commit progress when the save fails", async () => {
    const h = makeStore(undefined, async () => false);

    const result = await h.store.getState().completeTask("CAFE-DEV-01");

    expect(result.ok).toBe(false);
    expect(h.store.getState().progress).toEqual(initialCafeDevProgress);
    expect(h.store.getState().error).toMatch(/Could not save/i);
  });

  it("allows retry after a save failure", async () => {
    let attempt = 0;
    const h = makeStore(undefined, async () => {
      attempt += 1;
      return attempt > 1;
    });

    expect((await h.store.getState().completeTask("CAFE-DEV-01")).ok).toBe(false);
    expect((await h.store.getState().completeTask("CAFE-DEV-01")).ok).toBe(true);
    expect(h.store.getState().progress.currentTaskIndex).toBe(1);
  });

  it("recovers safely from corrupted saved data", async () => {
    const h = makeStore({ version: 42, progress: { currentTaskIndex: 4 } });
    await h.store.getState().hydrate();

    expect(h.store.getState().progress).toEqual(initialCafeDevProgress);
    expect(h.store.getState().hasSavedRecord).toBe(false);
    expect(h.store.getState().error).toMatch(/invalid/i);
  });

  it("keeps hydration open when storage cannot be read", async () => {
    const h = makeStore();
    h.load.mockRejectedValue(new Error("IndexedDB unavailable"));

    await h.store.getState().hydrate();

    expect(h.store.getState().hydrated).toBe(false);
    expect(h.store.getState().hasSavedRecord).toBe(false);
    expect(h.store.getState().error).toMatch(/Could not load/i);
  });
});

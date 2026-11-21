import { describe, expect, it, vi, type Mock } from "vitest";
import { CAFE_SETUP_TASKS } from "./cafeSetupTasks";
import {
  createCafeSetupSaveRecord,
  initialCafeSetupProgress,
  type CafeSetupSaveRecord,
} from "./cafeSetupProgress";
import { createCafeSetupStore } from "./cafeSetupStore";

interface Harness {
  store: ReturnType<typeof createCafeSetupStore>;
  load: Mock<() => Promise<unknown>>;
  save: Mock<(record: CafeSetupSaveRecord) => Promise<boolean>>;
  saved: CafeSetupSaveRecord[];
}

function makeStore(
  raw: unknown = undefined,
  saveResult: () => Promise<boolean> = async () => true,
): Harness {
  const saved: CafeSetupSaveRecord[] = [];
  const load = vi.fn(async () => raw);
  const save = vi.fn(async (record: CafeSetupSaveRecord) => {
    const ok = await saveResult();
    if (ok) saved.push(record);
    return ok;
  });
  return { store: createCafeSetupStore({ load, save }), load, save, saved };
}

describe("café setup store", () => {
  it("persists sequential task completion", async () => {
    const h = makeStore();

    for (const task of CAFE_SETUP_TASKS) {
      const result = await h.store.getState().completeTask(task.id);
      expect(result.ok).toBe(true);
    }

    expect(h.save).toHaveBeenCalledTimes(5);
    expect(h.saved.at(-1)?.progress.currentTaskIndex).toBe(5);
    expect(h.store.getState().progress.completedTasks.map((entry) => entry.taskId)).toEqual(
      CAFE_SETUP_TASKS.map((task) => task.id),
    );
  });

  it("reloads saved progress and does not repeat completed tasks", async () => {
    let progress = initialCafeSetupProgress;
    for (const task of CAFE_SETUP_TASKS.slice(0, 2)) {
      progress = {
        currentTaskIndex: progress.currentTaskIndex + 1,
        completedTasks: [
          ...progress.completedTasks,
          { taskId: task.id, completedAt: "2026-01-02T09:00:00.000Z" },
        ],
      };
    }

    const h = makeStore(createCafeSetupSaveRecord(progress));
    await h.store.getState().hydrate();

    expect(h.store.getState().hasSavedRecord).toBe(true);
    expect(h.store.getState().progress.currentTaskIndex).toBe(2);

    const duplicate = await h.store.getState().completeTask("read-brief");
    expect(duplicate).toEqual({ ok: true, alreadyCompleted: true });
    expect(h.save).not.toHaveBeenCalled();
  });

  it("does not skip tasks", async () => {
    const h = makeStore();
    const result = await h.store.getState().completeTask("create-files");
    expect(result.ok).toBe(false);
    expect(h.save).not.toHaveBeenCalled();
    expect(h.store.getState().progress).toEqual(initialCafeSetupProgress);
  });

  it("recovers safely from corrupted saved data", async () => {
    const h = makeStore({ version: 42, progress: { currentTaskIndex: 4 } });
    await h.store.getState().hydrate();

    expect(h.store.getState().progress).toEqual(initialCafeSetupProgress);
    expect(h.store.getState().hasSavedRecord).toBe(false);
    expect(h.store.getState().error).toMatch(/invalid/i);
  });

  it("keeps hydration open when storage cannot be read", async () => {
    const h = makeStore();
    h.load.mockRejectedValue(new Error("IndexedDB unavailable"));

    await h.store.getState().hydrate();

    expect(h.store.getState().hydrated).toBe(false);
    expect(h.store.getState().progress).toEqual(initialCafeSetupProgress);
    expect(h.store.getState().error).toMatch(/Could not load/i);
  });

  it("reports a save failure without completing the task", async () => {
    const h = makeStore(undefined, async () => false);

    const result = await h.store.getState().completeTask("read-brief");

    expect(result.ok).toBe(false);
    expect(h.store.getState().progress).toEqual(initialCafeSetupProgress);
    expect(h.store.getState().error).toMatch(/Could not save/i);
  });

  it("allows retry after a save failure", async () => {
    let attempt = 0;
    const h = makeStore(undefined, async () => {
      attempt += 1;
      return attempt > 1;
    });

    expect((await h.store.getState().completeTask("read-brief")).ok).toBe(false);
    expect((await h.store.getState().completeTask("read-brief")).ok).toBe(true);
    expect(h.store.getState().progress.currentTaskIndex).toBe(1);
  });
});

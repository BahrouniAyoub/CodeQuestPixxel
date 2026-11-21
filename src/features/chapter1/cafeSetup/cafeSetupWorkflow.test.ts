import { describe, expect, it, vi } from "vitest";
import { CAFE_SETUP_TASKS } from "./cafeSetupTasks";
import {
  completeCafeSetupTask,
  createCafeSetupSaveRecord,
  getCafeSetupWorkflow,
  initialCafeSetupProgress,
  validateCafeSetupSaveRecord,
  type CafeSetupSaveRecord,
} from "./cafeSetupProgress";
import { createCafeSetupStore } from "./cafeSetupStore";

const COMPLETED_AT = "2026-01-02T09:00:00.000Z";

function makeStore() {
  const saved: CafeSetupSaveRecord[] = [];
  return {
    store: createCafeSetupStore({
      load: vi.fn(async () => undefined),
      save: vi.fn(async (record: CafeSetupSaveRecord) => {
        saved.push(record);
        return true;
      }),
    }),
    saved,
  };
}

describe("café setup workflow marker", () => {
  it("keeps pure setup fixtures on the legacy workflow", () => {
    const progress = CAFE_SETUP_TASKS.reduce(
      (current, task) => completeCafeSetupTask(current, task.id, COMPLETED_AT),
      initialCafeSetupProgress,
    );

    // Only the store's real completion path opts a save into development.
    expect(getCafeSetupWorkflow(progress)).toBeNull();
  });

  it("stamps the development workflow when setup completes through the store", async () => {
    const h = makeStore();

    for (const task of CAFE_SETUP_TASKS) {
      expect((await h.store.getState().completeTask(task.id, COMPLETED_AT)).ok).toBe(true);
    }

    expect(getCafeSetupWorkflow(h.store.getState().progress)).toBe("development");
    expect(getCafeSetupWorkflow(h.saved.at(-1)!.progress)).toBe("development");

    const reloaded = validateCafeSetupSaveRecord(h.saved.at(-1));
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) {
      expect(getCafeSetupWorkflow(reloaded.progress)).toBe("development");
    }
  });

  it("does not stamp the marker before the final task", async () => {
    const h = makeStore();
    for (const task of CAFE_SETUP_TASKS.slice(0, 4)) {
      await h.store.getState().completeTask(task.id, COMPLETED_AT);
    }

    expect(getCafeSetupWorkflow(h.store.getState().progress)).toBeNull();
    expect(getCafeSetupWorkflow(h.saved.at(-1)!.progress)).toBeNull();
  });

  it("does not infer a workflow from an older save without the marker", () => {
    const progress = CAFE_SETUP_TASKS.slice(0, 3).reduce(
      (current, task) => ({
        currentTaskIndex: current.currentTaskIndex + 1,
        completedTasks: [...current.completedTasks, { taskId: task.id, completedAt: COMPLETED_AT }],
      }),
      initialCafeSetupProgress,
    );

    const validated = validateCafeSetupSaveRecord(createCafeSetupSaveRecord(progress));
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(getCafeSetupWorkflow(validated.progress)).toBeNull();
  });
});

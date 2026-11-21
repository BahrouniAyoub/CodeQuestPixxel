import { describe, expect, it } from "vitest";
import { CAFE_SETUP_TASK_IDS, CAFE_SETUP_TASKS } from "./cafeSetupTasks";
import {
  CAFE_SETUP_SAVE_VERSION,
  cafeSetupProgressCount,
  completeCafeSetupTask,
  createCafeSetupSaveRecord,
  getCurrentCafeSetupTask,
  initialCafeSetupProgress,
  isCafeSetupComplete,
  validateCafeSetupSaveRecord,
  type CafeSetupProgress,
} from "./cafeSetupProgress";

function progressAfter(count: number): CafeSetupProgress {
  return CAFE_SETUP_TASKS.slice(0, count).reduce(
    (progress, task) => completeCafeSetupTask(progress, task.id, "2026-01-02T09:00:00.000Z"),
    initialCafeSetupProgress,
  );
}

describe("café setup progress", () => {
  it("defines one ordered canonical workflow", () => {
    expect(CAFE_SETUP_TASK_IDS).toEqual([
      "read-brief",
      "create-folder",
      "create-files",
      "write-plan",
      "verify-setup",
    ]);
    expect(getCurrentCafeSetupTask(initialCafeSetupProgress)?.id).toBe("read-brief");
  });

  it("completes tasks sequentially and reaches 5/5", () => {
    let progress = initialCafeSetupProgress;
    for (const task of CAFE_SETUP_TASKS) {
      progress = completeCafeSetupTask(progress, task.id, "2026-01-02T09:00:00.000Z");
    }

    expect(cafeSetupProgressCount(progress)).toBe(5);
    expect(progress.currentTaskIndex).toBe(5);
    expect(isCafeSetupComplete(progress)).toBe(true);
    expect(getCurrentCafeSetupTask(progress)).toBeNull();
    expect(progress.completedTasks.map((entry) => entry.taskId)).toEqual(CAFE_SETUP_TASK_IDS);
  });

  it("rejects skipped tasks", () => {
    const skipped = completeCafeSetupTask(initialCafeSetupProgress, "create-folder");
    expect(skipped).toBe(initialCafeSetupProgress);
    expect(cafeSetupProgressCount(skipped)).toBe(0);
  });

  it("does not duplicate an already completed task", () => {
    const once = completeCafeSetupTask(initialCafeSetupProgress, "read-brief");
    const twice = completeCafeSetupTask(once, "read-brief");
    expect(twice).toBe(once);
    expect(cafeSetupProgressCount(twice)).toBe(1);
  });

  it("round-trips a versioned save record", () => {
    const progress = progressAfter(3);
    const record = createCafeSetupSaveRecord(progress);
    expect(record.version).toBe(CAFE_SETUP_SAVE_VERSION);
    expect(validateCafeSetupSaveRecord(record)).toEqual({ ok: true, progress });
  });

  it("rejects corrupted or out-of-order records", () => {
    const progress = progressAfter(2);
    const record = createCafeSetupSaveRecord(progress);

    expect(validateCafeSetupSaveRecord({ ...record, version: 99 }).ok).toBe(false);
    expect(
      validateCafeSetupSaveRecord({
        version: 1,
        progress: { ...record.progress, currentTaskIndex: 3 },
      }).ok,
    ).toBe(false);
    expect(
      validateCafeSetupSaveRecord({
        version: 1,
        progress: {
          currentTaskIndex: 2,
          completedTasks: [
            { taskId: "create-folder", completedAt: "2026-01-02T09:00:00.000Z" },
            { taskId: "read-brief", completedAt: "2026-01-02T09:00:00.000Z" },
          ],
        },
      }).ok,
    ).toBe(false);
    expect(
      validateCafeSetupSaveRecord({
        version: 1,
        progress: {
          currentTaskIndex: 1,
          completedTasks: [{ taskId: "read-brief", completedAt: "not-a-date" }],
        },
      }).ok,
    ).toBe(false);
    expect(validateCafeSetupSaveRecord(null).ok).toBe(false);
  });
});

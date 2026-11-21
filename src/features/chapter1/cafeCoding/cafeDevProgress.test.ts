import { describe, expect, it } from "vitest";
import {
  CAFE_DEV_TASKS,
  CAFE_DEV_TASK_COUNT,
  CAFE_DEV_TASK_IDS,
  cafeDevFilePath,
  getCafeDevTask,
  isCafeDevTaskId,
} from "./cafeDevTasks";
import {
  CAFE_DEV_SAVE_VERSION,
  cafeDevProgressCount,
  cafeDevProgressPercent,
  completeCafeDevTask,
  createCafeDevSaveRecord,
  getCurrentCafeDevTask,
  initialCafeDevProgress,
  isCafeDevComplete,
  validateCafeDevSaveRecord,
  type CafeDevProgress,
} from "./cafeDevProgress";

const COMPLETED_AT = "2026-01-02T09:00:00.000Z";

function progressAfter(count: number): CafeDevProgress {
  return CAFE_DEV_TASKS.slice(0, count).reduce(
    (progress, task) => completeCafeDevTask(progress, task.id, COMPLETED_AT),
    initialCafeDevProgress,
  );
}

describe("café development tasks", () => {
  it("defines the four canonical tasks in order", () => {
    expect(CAFE_DEV_TASK_IDS).toEqual(["CAFE-DEV-01", "CAFE-DEV-02", "CAFE-DEV-03", "CAFE-DEV-04"]);
    expect(CAFE_DEV_TASK_COUNT).toBe(4);
    expect(CAFE_DEV_TASKS.map((task) => task.index)).toEqual([0, 1, 2, 3]);
    expect(CAFE_DEV_TASKS.map((task) => task.primaryFile)).toEqual([
      "calculator.py",
      "calculator.py",
      "main.py",
      "main.py",
    ]);
  });

  it("uses only the canonical project folder and files", () => {
    expect(cafeDevFilePath("calculator.py")).toBe("/Projects/Python/cafe-calculator/calculator.py");
    expect(cafeDevFilePath("main.py")).toBe("/Projects/Python/cafe-calculator/main.py");
    expect(getCafeDevTask("CAFE-DEV-01").files).toEqual(["calculator.py"]);
    expect(getCafeDevTask("CAFE-DEV-03").files).toEqual(["calculator.py", "main.py"]);
    expect(getCafeDevTask("CAFE-DEV-04").files).toEqual(["calculator.py", "main.py"]);
  });

  it("contains the required pricing, discount, interactive, and end-to-end checks", () => {
    expect(CAFE_DEV_TASKS.map((task) => task.tests.length)).toEqual([6, 8, 6, 9]);

    const pricingChecks = CAFE_DEV_TASKS[0]!.tests.map((test) => test.pythonCheck ?? "").join("\n");
    expect(pricingChecks).toContain("calculate_total(1, 1)");
    expect(pricingChecks).toContain("calculate_total(2, 3)");
    expect(pricingChecks).toContain("calculate_total(0, 0)");
    expect(pricingChecks).toMatch(/negative/i);
    expect(pricingChecks).toMatch(/rejected|must not return/i);

    const discountChecks = CAFE_DEV_TASKS[1]!.tests
      .map((test) => test.pythonCheck ?? "")
      .join("\n");
    expect(discountChecks).toContain("apply_discount(19.99)");
    expect(discountChecks).toContain("apply_discount(20)");
    expect(discountChecks).toContain("apply_discount(20.01)");
    expect(discountChecks).toContain("calculate_total(1, 1)");

    expect(
      CAFE_DEV_TASKS[2]!.tests.every(
        (test) => test.stdin?.length && test.stdoutMatches?.length,
      ),
    ).toBe(true);
    expect(
      CAFE_DEV_TASKS[2]!.tests.some((test) =>
        test.stdoutMatches?.some((value) => /invalid|negative|whole/i.test(value)),
      ),
    ).toBe(true);
    expect(
      CAFE_DEV_TASKS[3]!.tests.some(
        (test) => test.modules?.[0]?.name === "calculator" && test.stdoutMatches?.length,
      ),
    ).toBe(true);
  });

  it("provides progressive hints without writing starter solutions", () => {
    for (const task of CAFE_DEV_TASKS) {
      expect(task.hints.length).toBeGreaterThanOrEqual(3);
      expect(task.instructions.length).toBeGreaterThan(0);
    }
  });

  it("recognises only canonical task IDs", () => {
    expect(isCafeDevTaskId("CAFE-DEV-04")).toBe(true);
    expect(isCafeDevTaskId("CAFÉ-1")).toBe(false);
  });
});

describe("café development progress", () => {
  it("completes the four tasks sequentially and reaches 4/4", () => {
    const progress = progressAfter(4);

    expect(cafeDevProgressCount(progress)).toBe(4);
    expect(cafeDevProgressPercent(progress)).toBe(100);
    expect(progress.currentTaskIndex).toBe(4);
    expect(isCafeDevComplete(progress)).toBe(true);
    expect(getCurrentCafeDevTask(progress)).toBeNull();
    expect(progress.completedTasks.map((entry) => entry.taskId)).toEqual(CAFE_DEV_TASK_IDS);
  });

  it("rejects skipped and repeated tasks without writing progress", () => {
    const skipped = completeCafeDevTask(initialCafeDevProgress, "CAFE-DEV-02", COMPLETED_AT);
    expect(skipped).toBe(initialCafeDevProgress);

    const once = completeCafeDevTask(initialCafeDevProgress, "CAFE-DEV-01", COMPLETED_AT);
    const twice = completeCafeDevTask(once, "CAFE-DEV-01", COMPLETED_AT);
    expect(twice).toBe(once);
  });

  it("rejects invalid completion timestamps", () => {
    expect(completeCafeDevTask(initialCafeDevProgress, "CAFE-DEV-01", "not-a-date")).toBe(
      initialCafeDevProgress,
    );
  });

  it("round-trips a versioned development save record", () => {
    const progress = progressAfter(3);
    const record = createCafeDevSaveRecord(progress);

    expect(record.version).toBe(CAFE_DEV_SAVE_VERSION);
    expect(validateCafeDevSaveRecord(record)).toEqual({ ok: true, progress });
  });

  it("rejects corrupted, out-of-order, and non-prefix records", () => {
    const record = createCafeDevSaveRecord(progressAfter(2));

    expect(validateCafeDevSaveRecord({ ...record, version: 99 }).ok).toBe(false);
    expect(
      validateCafeDevSaveRecord({
        version: 1,
        progress: { ...record.progress, currentTaskIndex: 3 },
      }).ok,
    ).toBe(false);
    expect(
      validateCafeDevSaveRecord({
        version: 1,
        progress: {
          currentTaskIndex: 2,
          completedTasks: [
            { taskId: "CAFE-DEV-02", completedAt: COMPLETED_AT },
            { taskId: "CAFE-DEV-01", completedAt: COMPLETED_AT },
          ],
        },
      }).ok,
    ).toBe(false);
    expect(
      validateCafeDevSaveRecord({
        version: 1,
        progress: {
          currentTaskIndex: 1,
          completedTasks: [{ taskId: "CAFE-DEV-01", completedAt: "nope" }],
        },
      }).ok,
    ).toBe(false);
    expect(validateCafeDevSaveRecord(null).ok).toBe(false);
  });
});

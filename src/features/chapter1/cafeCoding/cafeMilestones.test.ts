import { describe, expect, it } from "vitest";
import {
  CAFE_MILESTONE_COUNT,
  CAFE_MILESTONES,
  getCafeMilestone,
  isCafeMilestoneId,
} from "./cafeMilestones";
import {
  cafeMilestoneProgressCount,
  cafeMilestoneProgressPercent,
  completeCafeMilestone,
  createCafeMilestoneSaveRecord,
  getCurrentCafeMilestone,
  initialCafeMilestoneProgress,
  isCafeMilestoneComplete,
  validateCafeMilestoneSaveRecord,
  type CafeMilestoneProgress,
} from "./cafeMilestoneProgress";

const FIRST = "2026-01-02T09:00:00.000Z";
const SECOND = "2026-01-02T09:10:00.000Z";
const THIRD = "2026-01-02T09:20:00.000Z";

function progressAfter(count: number): CafeMilestoneProgress {
  const times = [FIRST, SECOND, THIRD];
  return CAFE_MILESTONES.slice(0, count).reduce(
    (progress, milestone) => completeCafeMilestone(progress, milestone.id, times[milestone.index]),
    initialCafeMilestoneProgress,
  );
}

describe("café milestone definitions", () => {
  it("defines three ordered milestones with isolated project files", () => {
    expect(CAFE_MILESTONE_COUNT).toBe(3);
    expect(CAFE_MILESTONES.map((milestone) => milestone.id)).toEqual([
      "variables-print",
      "arithmetic-functions",
      "conditional-discounts",
    ]);
    expect(CAFE_MILESTONES.map((milestone) => milestone.index)).toEqual([0, 1, 2]);
    expect(CAFE_MILESTONES.map((milestone) => milestone.displayFileName)).toEqual([
      "cafe_milestone_1.py",
      "cafe_milestone_2.py",
      "cafe_milestone_3.py",
    ]);
    expect(new Set(CAFE_MILESTONES.map((milestone) => milestone.filePath)).size).toBe(3);
    expect(CAFE_MILESTONES.every((milestone) => milestone.tests.length > 0)).toBe(true);
    expect(isCafeMilestoneId("variables-print")).toBe(true);
    expect(isCafeMilestoneId("unknown")).toBe(false);
    expect(() => getCafeMilestone("unknown" as never)).toThrow(/unknown/i);
  });

  it("checks variables and printed output, and rejects print-only milestone 1 code", () => {
    const milestone = getCafeMilestone("variables-print");
    expect(milestone.tests).toHaveLength(3);
    expect(milestone.tests[0]?.pythonCheck).toContain("coffee_price == 3");
    expect(milestone.tests[1]?.pythonCheck).toContain("sandwich_price == 5");
    expect(milestone.tests[2]?.stdoutNumbers).toEqual([3, 5]);
    expect(milestone.starterCode).not.toContain("coffee_price = 3");
    expect(milestone.starterCode).not.toContain("sandwich_price = 5");
  });

  it("covers every required function case for milestones 2 and 3", () => {
    const arithmetic = getCafeMilestone("arithmetic-functions");
    const checks = arithmetic.tests.map((test) => test.pythonCheck).join("\n");
    for (const call of [
      "calculate_total(2, 1)",
      "calculate_total(0, 2)",
      "calculate_total(3, 0)",
      "calculate_total(1, 1)",
    ]) {
      expect(checks).toContain(call);
    }
    expect(arithmetic.starterCode).not.toContain("coffees * 3");

    const discounts = getCafeMilestone("conditional-discounts");
    const discountChecks = discounts.tests.map((test) => test.pythonCheck).join("\n");
    for (const call of [
      "apply_discount(10)",
      "apply_discount(19)",
      "apply_discount(20)",
      "apply_discount(30)",
      "apply_discount(50)",
    ]) {
      expect(discountChecks).toContain(call);
    }
    expect(discountChecks).toContain("abs(_result - 18) < 1e-9");
    expect(discounts.starterCode).not.toContain("total * 0.9");
  });
});

describe("café milestone progress", () => {
  it("starts at milestone 1 with 0/3", () => {
    expect(initialCafeMilestoneProgress).toEqual({
      currentMilestoneIndex: 0,
      completedMilestones: [],
    });
    expect(getCurrentCafeMilestone(initialCafeMilestoneProgress)?.id).toBe("variables-print");
    expect(cafeMilestoneProgressCount(initialCafeMilestoneProgress)).toBe(0);
    expect(cafeMilestoneProgressPercent(initialCafeMilestoneProgress)).toBe(0);
  });

  it("advances only in order and records timestamps", () => {
    const first = completeCafeMilestone(initialCafeMilestoneProgress, "variables-print", FIRST);
    expect(first.currentMilestoneIndex).toBe(1);
    expect(first.completedMilestones).toEqual([
      { milestoneId: "variables-print", completedAt: FIRST },
    ]);
    expect(getCurrentCafeMilestone(first)?.id).toBe("arithmetic-functions");

    const second = completeCafeMilestone(first, "arithmetic-functions", SECOND);
    const third = completeCafeMilestone(second, "conditional-discounts", THIRD);

    expect(third.currentMilestoneIndex).toBe(3);
    expect(cafeMilestoneProgressCount(third)).toBe(3);
    expect(cafeMilestoneProgressPercent(third)).toBe(100);
    expect(getCurrentCafeMilestone(third)).toBeNull();
    expect(isCafeMilestoneComplete(third, "conditional-discounts")).toBe(true);
  });

  it("rejects skipped, duplicated, and unknown milestones without changing state", () => {
    expect(completeCafeMilestone(initialCafeMilestoneProgress, "arithmetic-functions", FIRST)).toBe(
      initialCafeMilestoneProgress,
    );

    const first = progressAfter(1);
    expect(completeCafeMilestone(first, "variables-print", SECOND)).toBe(first);
    expect(completeCafeMilestone(first, "conditional-discounts", SECOND)).toBe(first);
    expect(completeCafeMilestone(first, "unknown" as never, SECOND)).toBe(first);
    expect(
      completeCafeMilestone(initialCafeMilestoneProgress, "variables-print", "not-a-date"),
    ).toBe(initialCafeMilestoneProgress);
  });
});

describe("café milestone persistence validation", () => {
  it("round-trips a valid prefix record", () => {
    const progress = progressAfter(2);
    const result = validateCafeMilestoneSaveRecord(createCafeMilestoneSaveRecord(progress));
    expect(result).toEqual({ ok: true, progress });
  });

  it.each([
    ["not an object", null],
    ["wrong version", { version: 2, progress: progressAfter(0) }],
    ["missing progress", { version: 1 }],
    [
      "index out of range",
      { version: 1, progress: { currentMilestoneIndex: 4, completedMilestones: [] } },
    ],
    [
      "index does not match count",
      {
        version: 1,
        progress: {
          currentMilestoneIndex: 2,
          completedMilestones: [{ milestoneId: "variables-print", completedAt: FIRST }],
        },
      },
    ],
    [
      "wrong prefix",
      {
        version: 1,
        progress: {
          currentMilestoneIndex: 1,
          completedMilestones: [{ milestoneId: "arithmetic-functions", completedAt: FIRST }],
        },
      },
    ],
    [
      "invalid timestamp",
      {
        version: 1,
        progress: {
          currentMilestoneIndex: 1,
          completedMilestones: [{ milestoneId: "variables-print", completedAt: "not-a-date" }],
        },
      },
    ],
    [
      "duplicate IDs",
      {
        version: 1,
        progress: {
          currentMilestoneIndex: 2,
          completedMilestones: [
            { milestoneId: "variables-print", completedAt: FIRST },
            { milestoneId: "variables-print", completedAt: SECOND },
          ],
        },
      },
    ],
  ])("rejects malformed saved data: %s", (_label, raw) => {
    const result = validateCafeMilestoneSaveRecord(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });
});

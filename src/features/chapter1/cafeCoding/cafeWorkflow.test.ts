import { describe, expect, it } from "vitest";
import {
  getCafeWorkflowSummary,
  selectCafeWorkflow,
  type CafeWorkflowSummaryInput,
} from "./cafeWorkflow";

function input(overrides: Partial<CafeWorkflowSummaryInput> = {}): CafeWorkflowSummaryInput {
  return {
    legacyMilestoneIndex: 0,
    legacyMilestoneFileExists: false,
    ch1_05Completed: false,
    developmentRecordPresent: false,
    legacyCompleted: 0,
    developmentCompleted: 0,
    ...overrides,
  };
}

describe("café workflow selection", () => {
  it("keeps legacy milestone progress on the legacy workflow", () => {
    expect(selectCafeWorkflow(input({ legacyMilestoneIndex: 2 }))).toBe("legacy");
  });

  it("keeps an existing legacy milestone file on the legacy workflow", () => {
    expect(selectCafeWorkflow(input({ legacyMilestoneFileExists: true }))).toBe("legacy");
  });

  it("uses the development workflow when a development record exists", () => {
    expect(selectCafeWorkflow(input({ developmentRecordPresent: true }))).toBe("development");
  });

  it("treats a completed CH1-05 without a development record as legacy", () => {
    expect(selectCafeWorkflow(input({ ch1_05Completed: true }))).toBe("legacy");
  });

  it("treats a brand-new save as development", () => {
    expect(selectCafeWorkflow(input())).toBe("development");
  });

  it("keeps legacy evidence ahead of the new-save default", () => {
    expect(
      selectCafeWorkflow(
        input({
          legacyMilestoneIndex: 1,
          legacyMilestoneFileExists: false,
          ch1_05Completed: true,
        }),
      ),
    ).toBe("legacy");
  });

  it("prefers a development record after 4/4 even when CH1-05 is complete", () => {
    expect(
      selectCafeWorkflow(input({ developmentRecordPresent: true, ch1_05Completed: true })),
    ).toBe("development");
  });

  it("never mixes legacy and development counts", () => {
    expect(
      getCafeWorkflowSummary(
        input({
          legacyMilestoneIndex: 2,
          developmentRecordPresent: true,
          legacyCompleted: 2,
          developmentCompleted: 3,
        }),
      ),
    ).toEqual({ workflow: "legacy", completed: 2, total: 3 });

    expect(
      getCafeWorkflowSummary(
        input({
          developmentRecordPresent: true,
          legacyCompleted: 2,
          developmentCompleted: 3,
        }),
      ),
    ).toEqual({ workflow: "development", completed: 3, total: 4 });
  });

  it("reports the four-task total for a new save", () => {
    expect(getCafeWorkflowSummary(input())).toEqual({
      workflow: "development",
      completed: 0,
      total: 4,
    });
  });
});

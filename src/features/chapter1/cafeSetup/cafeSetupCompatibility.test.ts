import { describe, expect, it } from "vitest";
import {
  detectLegacyCafeProjectFiles,
  evaluateCafeSetupRequirement,
} from "./cafeSetupCompatibility";
import { CAFE_MILESTONES } from "../cafeCoding/cafeMilestones";

describe("café setup compatibility", () => {
  it("requires setup for a brand new session", () => {
    expect(
      evaluateCafeSetupRequirement({
        setupHydrated: true,
        setupComplete: false,
        milestoneIndex: 0,
        legacyMilestoneFileExists: false,
      }),
    ).toEqual({ required: true, legacy: false });
  });

  it("never gates a completed setup phase", () => {
    expect(
      evaluateCafeSetupRequirement({
        setupHydrated: true,
        setupComplete: true,
        milestoneIndex: 0,
        legacyMilestoneFileExists: false,
      }),
    ).toEqual({ required: false, legacy: false });
  });

  it("lets existing milestone progress continue without setup", () => {
    expect(
      evaluateCafeSetupRequirement({
        setupHydrated: true,
        setupComplete: false,
        milestoneIndex: 2,
        legacyMilestoneFileExists: false,
      }),
    ).toEqual({ required: false, legacy: true });
  });

  it("detects an existing milestone file as a legacy session", async () => {
    const legacy = await detectLegacyCafeProjectFiles({
      getEntry: async (path) =>
        path === CAFE_MILESTONES[0]?.filePath
          ? { path, kind: "file", content: "", updatedAt: 0 }
          : undefined,
    });
    expect(legacy).toBe(true);

    const fresh = await detectLegacyCafeProjectFiles({ getEntry: async () => undefined });
    expect(fresh).toBe(false);
  });
});

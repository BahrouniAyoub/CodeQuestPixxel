import { describe, expect, it } from "vitest";
import { MAX_XP, TICKETS } from "@/features/tickets/data/tickets";
import {
  achievements,
  applyVerifiedCompletion,
  isUnlocked,
  sanitizeCompletions,
  sanitizeCurrentTicketId,
  sanitizeStarted,
  totalXp,
} from "./progressLogic";

const pass = { engine: "pyodide" as const, allPassed: true, total: 1, passed: 1 };

describe("progressLogic with legacy CQ tickets removed", () => {
  it("has no active legacy ticket catalog", () => {
    expect(TICKETS).toHaveLength(0);
    expect(MAX_XP).toBe(0);
  });

  it("does not award or track removed legacy ticket IDs", () => {
    const r = applyVerifiedCompletion({}, "CQ-001", pass);
    expect(r.awarded).toBe(false);
    expect(r.reason).toBe("unknown-ticket");
    expect(totalXp(r.completions)).toBe(0);
    expect(isUnlocked("CQ-001", {})).toBe(false);
  });

  it("returns no ticket achievements when catalog is empty", () => {
    expect(achievements({})).toEqual([]);
  });

  it("sanitizes legacy/unknown persisted ticket IDs", () => {
    const completions = sanitizeCompletions({
      "CQ-001": { ticketId: "CQ-001", completedAt: 123 },
      "CQ-005": { ticketId: "CQ-005", completedAt: 456 },
      UNKNOWN: { ticketId: "UNKNOWN", completedAt: 789 },
    });
    expect(completions).toEqual({});

    expect(sanitizeStarted(["CQ-001", "UNKNOWN", "CQ-002"])).toEqual([]);
    expect(sanitizeCurrentTicketId("CQ-001", {})).toBeNull();
  });
});

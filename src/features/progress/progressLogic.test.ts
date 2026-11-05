import { describe, expect, it } from "vitest";
import { MAX_XP, TICKETS } from "@/features/tickets/data/tickets";
import { achievements, applyVerifiedCompletion, isUnlocked, ticketStatus, totalXp, type Completions } from "./progressLogic";

const pass = { engine: "pyodide" as const, allPassed: true, total: 3, passed: 3 };

describe("ticket progression", () => {
  it("only CQ-001 is unlocked at the start", () => {
    expect(isUnlocked("CQ-001", {})).toBe(true);
    expect(isUnlocked("CQ-002", {})).toBe(false);
    expect(ticketStatus("CQ-005", {}, [])).toBe("locked");
  });

  it("completing a ticket unlocks the next one", () => {
    const r = applyVerifiedCompletion({}, "CQ-001", pass);
    expect(r.awarded).toBe(true);
    expect(isUnlocked("CQ-002", r.completions)).toBe(true);
    expect(isUnlocked("CQ-003", r.completions)).toBe(false);
  });

  it("awards XP only once per ticket", () => {
    const first = applyVerifiedCompletion({}, "CQ-001", pass);
    const second = applyVerifiedCompletion(first.completions, "CQ-001", pass);
    expect(second.awarded).toBe(false);
    expect(second.reason).toBe("already-completed");
    expect(totalXp(second.completions)).toBe(100);
  });

  it("does not complete a ticket when any test fails", () => {
    const r = applyVerifiedCompletion({}, "CQ-001", { ...pass, allPassed: false, passed: 2 });
    expect(r.awarded).toBe(false);
    expect(r.completions["CQ-001"]).toBeUndefined();
  });

  it("cannot complete a locked ticket", () => {
    const r = applyVerifiedCompletion({}, "CQ-003", pass);
    expect(r.reason).toBe("locked");
  });

  it("max XP is 1000 and all achievements unlock at the end", () => {
    let c: Completions = {};
    for (const t of TICKETS) c = applyVerifiedCompletion(c, t.id, pass).completions;
    expect(MAX_XP).toBe(1000);
    expect(totalXp(c)).toBe(1000);
    expect(achievements(c).every((a) => a.unlocked)).toBe(true);
  });
});

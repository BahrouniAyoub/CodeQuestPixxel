import { MAX_XP, TICKETS, TICKETS_BY_ID, type TicketId } from "@/features/tickets/data/tickets";
import type { TestSuiteResult } from "@/services/runner/testing";

export interface CompletionRecord {
  ticketId: TicketId;
  completedAt: number;
}

export type Completions = Partial<Record<TicketId, CompletionRecord>>;
export type TicketStatus = "locked" | "available" | "in-progress" | "completed";

export function isUnlocked(id: TicketId, completions: Completions): boolean {
  const index = TICKETS.findIndex((t) => t.id === id);
  if (index <= 0) return index === 0;
  const prev = TICKETS[index - 1];
  return prev ? Boolean(completions[prev.id]) : false;
}

export function ticketStatus(id: TicketId, completions: Completions, started: TicketId[]): TicketStatus {
  if (completions[id]) return "completed";
  if (!isUnlocked(id, completions)) return "locked";
  return started.includes(id) ? "in-progress" : "available";
}

/** XP is always derived from completion records and ticket definitions — never stored as a counter. */
export function totalXp(completions: Completions): number {
  return TICKETS.reduce((sum, t) => sum + (completions[t.id] ? t.xp : 0), 0);
}

export function levelForXp(xp: number): { level: number; current: number; next: number; title: string } {
  const thresholds = [0, 100, 250, 450, 700, 1000];
  const titles = ["Intern", "Junior Dev", "Code Cadet", "Bug Hunter", "Loop Wrangler", "Pixel Pro"];
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) if (xp >= (thresholds[i] ?? 0)) level = i + 1;
  const current = thresholds[level - 1] ?? 0;
  const next = thresholds[level] ?? MAX_XP;
  return { level, current, next, title: titles[level - 1] ?? "Intern" };
}

export interface CompletionAttempt {
  completions: Completions;
  awarded: boolean;
  xpAwarded: number;
  reason?: "already-completed" | "locked" | "not-verified";
}

/**
 * Apply a verified test run. XP is awarded only when:
 *  - the result came from the real Python engine,
 *  - every test passed,
 *  - the ticket is unlocked,
 *  - the ticket was not already completed (awarded once).
 */
export function applyVerifiedCompletion(
  completions: Completions,
  id: TicketId,
  suite: Pick<TestSuiteResult, "engine" | "allPassed" | "total" | "passed">,
  now = Date.now(),
): CompletionAttempt {
  if (completions[id]) return { completions, awarded: false, xpAwarded: 0, reason: "already-completed" };
  if (!isUnlocked(id, completions)) return { completions, awarded: false, xpAwarded: 0, reason: "locked" };
  if (suite.engine !== "pyodide" || !suite.allPassed || suite.total === 0 || suite.passed !== suite.total) {
    return { completions, awarded: false, xpAwarded: 0, reason: "not-verified" };
  }
  return {
    completions: { ...completions, [id]: { ticketId: id, completedAt: now } },
    awarded: true,
    xpAwarded: TICKETS_BY_ID[id].xp,
  };
}

export function nextTicketAfter(id: TicketId): TicketId | null {
  const i = TICKETS.findIndex((t) => t.id === id);
  return TICKETS[i + 1]?.id ?? null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export function achievements(completions: Completions): Achievement[] {
  const count = TICKETS.filter((t) => completions[t.id]).length;
  const xp = totalXp(completions);
  return [
    { id: "first", title: "First Ticket Completed", description: "Ship your very first ticket.", unlocked: count >= 1 },
    {
      id: "beginner",
      title: "Python Beginner",
      description: "Complete Variables, Input and Conditions.",
      unlocked: Boolean(completions["CQ-001"] && completions["CQ-002"] && completions["CQ-003"]),
    },
    { id: "halfway", title: "Halfway There", description: `Earn ${MAX_XP / 2} XP.`, unlocked: xp >= MAX_XP / 2 },
    { id: "all", title: "All Tickets Completed", description: "Finish every MVP ticket.", unlocked: count === TICKETS.length },
  ];
}

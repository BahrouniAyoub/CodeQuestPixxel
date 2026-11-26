import { MAX_XP, TICKETS, TICKETS_BY_ID, isActiveTicketId, isLegacyTicketId, type TicketId } from "@/features/tickets/data/tickets";
import type { TestSuiteResult } from "@/services/runner/testing";

export interface CompletionRecord {
  ticketId: TicketId;
  completedAt: number;
}

export type Completions = Partial<Record<TicketId, CompletionRecord>>;
export type TicketStatus = "locked" | "available" | "in-progress" | "completed";

export function isActiveCatalogTicket(id: TicketId): boolean {
  return isActiveTicketId(id);
}

export function isUnlocked(id: TicketId, completions: Completions): boolean {
  const index = TICKETS.findIndex((t) => t.id === id);
  if (index < 0) return false;
  if (index === 0) return true;
  const prev = TICKETS[index - 1];
  return prev ? Boolean(completions[prev.id]) : false;
}

export function ticketStatus(id: TicketId, completions: Completions, started: TicketId[]): TicketStatus {
  if (completions[id]) return "completed";
  if (!isUnlocked(id, completions)) return "locked";
  return started.includes(id) ? "in-progress" : "available";
}

/** XP is derived only from active ticket definitions. Legacy/unknown records are ignored. */
export function totalXp(completions: Completions): number {
  return TICKETS.reduce((sum, t) => sum + (completions[t.id] ? t.xp : 0), 0);
}

export function levelForXp(xp: number): { level: number; current: number; next: number; title: string } {
  const thresholds = [0, 100, 250, 450, 700, 1000];
  const titles = ["Intern", "Junior Dev", "Code Cadet", "Bug Hunter", "Loop Wrangler", "Pixel Pro"];
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) if (xp >= (thresholds[i] ?? 0)) level = i + 1;
  const current = thresholds[level - 1] ?? 0;
  const next = thresholds[level] ?? Math.max(MAX_XP, current);
  return { level, current, next, title: titles[level - 1] ?? "Intern" };
}

export interface CompletionAttempt {
  completions: Completions;
  awarded: boolean;
  xpAwarded: number;
  reason?: "already-completed" | "locked" | "not-verified" | "unknown-ticket";
}

/** Apply a verified test run. Only active catalog tickets can award XP. */
export function applyVerifiedCompletion(
  completions: Completions,
  id: TicketId,
  suite: Pick<TestSuiteResult, "engine" | "allPassed" | "total" | "passed">,
  now = Date.now(),
): CompletionAttempt {
  const ticket = TICKETS_BY_ID[id];
  if (!ticket) return { completions, awarded: false, xpAwarded: 0, reason: "unknown-ticket" };
  if (completions[id]) return { completions, awarded: false, xpAwarded: 0, reason: "already-completed" };
  if (!isUnlocked(id, completions)) return { completions, awarded: false, xpAwarded: 0, reason: "locked" };
  if (suite.engine !== "pyodide" || !suite.allPassed || suite.total === 0 || suite.passed !== suite.total) {
    return { completions, awarded: false, xpAwarded: 0, reason: "not-verified" };
  }
  return {
    completions: { ...completions, [id]: { ticketId: id, completedAt: now } },
    awarded: true,
    xpAwarded: ticket.xp,
  };
}

export function nextTicketAfter(id: TicketId): TicketId | null {
  const i = TICKETS.findIndex((t) => t.id === id);
  if (i < 0) return null;
  return TICKETS[i + 1]?.id ?? null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export function achievements(completions: Completions): Achievement[] {
  if (TICKETS.length === 0) return [];
  const count = TICKETS.filter((t) => completions[t.id]).length;
  const xp = totalXp(completions);
  const firstThree = TICKETS.slice(0, 3);
  return [
    { id: "first", title: "First Ticket Completed", description: "Ship your very first ticket.", unlocked: count >= 1 },
    {
      id: "beginner",
      title: "Python Beginner",
      description: "Complete the first three tickets.",
      unlocked: firstThree.length > 0 && firstThree.every((t) => Boolean(completions[t.id])),
    },
    {
      id: "halfway",
      title: "Halfway There",
      description: `Earn ${Math.floor(MAX_XP / 2)} XP.`,
      unlocked: MAX_XP > 0 && xp >= MAX_XP / 2,
    },
    { id: "all", title: "All Tickets Completed", description: "Finish every available ticket.", unlocked: count === TICKETS.length },
  ];
}

/** Remove unknown/legacy ticket IDs from persisted progress while preserving save shape. */
export function sanitizeCompletions(completions: unknown): Completions {
  if (!completions || typeof completions !== "object" || Array.isArray(completions)) return {};
  const out: Completions = {};
  for (const [id, record] of Object.entries(completions as Record<string, unknown>)) {
    if (typeof id !== "string" || isLegacyTicketId(id) || !isActiveTicketId(id)) continue;
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    const r = record as Record<string, unknown>;
    const completedAt = typeof r["completedAt"] === "number" && Number.isFinite(r["completedAt"]) ? r["completedAt"] : 0;
    out[id] = { ticketId: id, completedAt };
  }
  return out;
}

export function sanitizeStarted(started: unknown): TicketId[] {
  if (!Array.isArray(started)) return [];
  const seen = new Set<string>();
  const out: TicketId[] = [];
  for (const id of started) {
    if (typeof id !== "string" || seen.has(id) || isLegacyTicketId(id) || !isActiveTicketId(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function sanitizeCurrentTicketId(currentTicketId: unknown, completions: Completions): TicketId | null {
  if (typeof currentTicketId === "string" && isActiveTicketId(currentTicketId) && !isLegacyTicketId(currentTicketId)) {
    return currentTicketId;
  }
  const firstAvailable = TICKETS.find((t) => isUnlocked(t.id, completions) && !completions[t.id]);
  return firstAvailable?.id ?? TICKETS[0]?.id ?? null;
}

export function hasActiveTicketCatalog(): boolean {
  return TICKETS.length > 0;
}

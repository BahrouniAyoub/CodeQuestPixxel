export type TicketId = string;
export type Difficulty = "Starter" | "Easy" | "Medium" | "Tricky";

export interface TicketTest {
  name: string;
  /** Lines returned, in order, by input() */
  stdin?: string[];
  /** Exact expected stdout (trailing whitespace per line ignored). Prompts passed to input() are not printed during tests. */
  expectedStdout?: string;
  /** Python assertions executed after the program, in the same namespace */
  check?: string;
}

export interface TicketDefinition {
  id: TicketId;
  title: string;
  topic: string;
  difficulty: Difficulty;
  xp: number;
  fileName: string;
  summary: string;
  description: string;
  requirements: string[];
  examples: { input?: string; output: string }[];
  acceptance: string[];
  hints: string[];
  starterCode: string;
  tests: TicketTest[];
}

/**
 * Legacy demo/practice tickets removed from the player-facing catalog.
 * Kept only to sanitize old saves/drafts so they never reappear or crash.
 */
export const LEGACY_TICKET_IDS = ["CQ-001", "CQ-002", "CQ-003", "CQ-004", "CQ-005"] as const;
export type LegacyTicketId = (typeof LEGACY_TICKET_IDS)[number];
const LEGACY_TICKET_ID_SET: ReadonlySet<string> = new Set(LEGACY_TICKET_IDS);

export function isLegacyTicketId(id: string): id is LegacyTicketId {
  return LEGACY_TICKET_ID_SET.has(id);
}

/**
 * Active player-facing ticket catalog.
 *
 * Legacy CQ-001..CQ-005 demo tickets were retired; the Café Calculator mission
 * lives in chapter1 cafe systems. Keep this catalog reusable for future chapters.
 */
export const TICKETS: TicketDefinition[] = [];

export const TICKET_IDS = TICKETS.map((t) => t.id);
export const TICKETS_BY_ID = Object.fromEntries(TICKETS.map((t) => [t.id, t])) as Record<TicketId, TicketDefinition>;
export const MAX_XP = TICKETS.reduce((sum, t) => sum + t.xp, 0);

export function isActiveTicketId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(TICKETS_BY_ID, id);
}

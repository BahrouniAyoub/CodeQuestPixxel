/**
 * Chapter 1 — The First Paycheck
 *
 * This module is the single source of truth for the Chapter 1 quest sequence.
 * Progress logic derives its valid IDs and ordering from `CHAPTER1_QUESTS`, so
 * adding or reordering a quest only requires editing this file.
 *
 * Nothing in this module depends on React, Zustand, persistence, or the Godot
 * bridge. It is intentionally a plain data module so it can be reused by any
 * future UI or integration layer.
 */

export interface Chapter1QuestDefinition {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  /** In-game money granted when this quest is completed. Only CH1-07 pays out. */
  readonly moneyReward: number;
}

/** The single Chapter 1 payment amount, in in-game dollars. */
export const CHAPTER1_PAYMENT_REWARD = 50;

export const CHAPTER1_QUESTS = [
  {
    id: "CH1-01",
    title: "A Difficult Morning",
    objective: "Listen to your father's warning",
    moneyReward: 0,
  },
  {
    id: "CH1-02",
    title: "Find a Way Out",
    objective: "Go to your bedroom and open the computer",
    moneyReward: 0,
  },
  {
    id: "CH1-03",
    title: "Your First Opportunity",
    objective: "Find a freelance Python job on GigBoard",
    moneyReward: 0,
  },
  {
    id: "CH1-04",
    title: "The First Client",
    objective: "Apply for the café calculator project",
    moneyReward: 0,
  },
  {
    id: "CH1-05",
    title: "Build the Application",
    objective: "Complete all three Python milestones",
    moneyReward: 0,
  },
  {
    id: "CH1-06",
    title: "Deliver Your Work",
    objective: "Submit the completed project to the client",
    moneyReward: 0,
  },
  {
    id: "CH1-07",
    title: "The First Paycheck",
    objective: "Receive the $50 payment",
    moneyReward: CHAPTER1_PAYMENT_REWARD,
  },
  {
    id: "CH1-08",
    title: "A New Beginning",
    objective: "Return to your father and share the news",
    moneyReward: 0,
  },
] as const satisfies readonly Chapter1QuestDefinition[];

/** A quest as defined by the ordered Chapter 1 sequence. */
export type Chapter1Quest = (typeof CHAPTER1_QUESTS)[number];

/** Literal union of every valid Chapter 1 quest ID. */
export type Chapter1QuestId = Chapter1Quest["id"];

export const CHAPTER1_QUEST_IDS: readonly Chapter1QuestId[] = CHAPTER1_QUESTS.map(
  (quest) => quest.id,
);

export const CHAPTER1_QUESTS_BY_ID = Object.fromEntries(
  CHAPTER1_QUESTS.map((quest) => [quest.id, quest]),
) as Record<Chapter1QuestId, Chapter1Quest>;

const CHAPTER1_QUEST_ID_SET: ReadonlySet<string> = new Set(CHAPTER1_QUEST_IDS);

/** Runtime guard for IDs coming from persistence, events, or other untyped input. */
export function isChapter1QuestId(value: unknown): value is Chapter1QuestId {
  return typeof value === "string" && CHAPTER1_QUEST_ID_SET.has(value);
}

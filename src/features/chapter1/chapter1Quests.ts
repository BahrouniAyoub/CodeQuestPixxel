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
  /** Short, player-facing objective shown in HUD/journal. */
  readonly objective: string;
  /** One-sentence description of what to do and why it matters. */
  readonly description: string;
  /** Where the player should go, or null when no world location applies. */
  readonly location: string | null;
  /** In-game money granted when this quest is completed. Only CH1-07 pays out. */
  readonly moneyReward: number;
}

/** The single Chapter 1 payment amount, in in-game dollars. */
export const CHAPTER1_PAYMENT_REWARD = 50;

/** Exact Chapter 1 completion copy shared by the bridge, tracker, and game route. */
export const CHAPTER1_COMPLETE_TITLE = "Chapter 1 Complete — The First Paycheck";
export const CHAPTER1_COMPLETE_MESSAGE =
  "You completed your first programming job, earned $50, and proved that you can turn your coding skills into real opportunities.";

/** Canonical display title for Chapter 1, shared by HUD, journal, and bridge. */
export const CHAPTER1_TITLE = "Chapter 1 — The First Paycheck";

export const CHAPTER1_QUESTS = [
  {
    id: "CH1-01",
    title: "A Tough Morning",
    objective: "Talk to Dad in the living room",
    description: "Dad has something important to say. Listen to him to find out what's going on.",
    location: "Living room · Dad",
    moneyReward: 0,
  },
  {
    id: "CH1-02",
    title: "Check the Computer",
    objective: "Use the computer in your bedroom",
    description: "Your computer might help you find work. Head to your bedroom and turn it on.",
    location: "Bedroom · Computer",
    moneyReward: 0,
  },
  {
    id: "CH1-03",
    title: "Find a Job",
    objective: "Find a Python job on GigBoard",
    description: "Look through GigBoard on your computer and find a freelance job that fits your skills.",
    location: "PixelOS · GigBoard",
    moneyReward: 0,
  },
  {
    id: "CH1-04",
    title: "Apply for the Job",
    objective: "Apply to the café calculator project",
    description: "Send your application for the café calculator job so you can start working.",
    location: "PixelOS · GigBoard",
    moneyReward: 0,
  },
  {
    id: "CH1-05",
    title: "Build the Calculator",
    objective: "Finish and test the café project",
    description: "Complete the café calculator project and make sure it works before sending it off.",
    location: "PixelOS · Code Editor",
    moneyReward: 0,
  },
  {
    id: "CH1-06",
    title: "Send Your Work",
    objective: "Submit the finished project to the client",
    description: "Your project is ready. Submit it so the café owner can review your work.",
    location: "PixelOS · Submit Project",
    moneyReward: 0,
  },
  {
    id: "CH1-07",
    title: "Get Paid",
    objective: "Claim your $50 payment",
    description: "The client approved your work. Collect your first paycheck!",
    location: "PixelOS · Mail",
    moneyReward: CHAPTER1_PAYMENT_REWARD,
  },
  {
    id: "CH1-08",
    title: "Share the Good News",
    objective: "Go home and tell Dad about your job",
    description: "You earned your first paycheck. Head back to the living room and talk to Dad.",
    location: "Living room · Dad",
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

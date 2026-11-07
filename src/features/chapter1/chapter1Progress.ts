import {
  CHAPTER1_QUESTS,
  isChapter1QuestId,
  type Chapter1Quest,
  type Chapter1QuestId,
} from "./chapter1Quests";

/**
 * Serializable Chapter 1 progression state.
 *
 * `currentQuestIndex` points into the canonical quest array. A value equal to
 * the array length means the chapter is complete.
 */
export interface Chapter1Progress {
  currentQuestIndex: number;
  completedQuestIds: Chapter1QuestId[];
  /** Chapter 1 in-game earnings. Not connected to a global wallet yet. */
  money: number;
  /** Guards the one-time Chapter 1 payment independently of quest bookkeeping. */
  paymentClaimed: boolean;
}

export const initialChapter1Progress: Chapter1Progress = {
  currentQuestIndex: 0,
  completedQuestIds: [],
  money: 0,
  paymentClaimed: false,
};

/**
 * Return the quest the player may currently complete, or `null` when the
 * chapter is complete (or the stored index is invalid).
 */
export function getCurrentChapter1Quest(progress: Chapter1Progress): Chapter1Quest | null {
  const index = progress.currentQuestIndex;
  if (!Number.isInteger(index) || index < 0 || index >= CHAPTER1_QUESTS.length) return null;
  return CHAPTER1_QUESTS[index] ?? null;
}

/**
 * Complete the active quest and return the next immutable progress state.
 *
 * The function is deliberately strict: only the active, not-yet-completed quest
 * can advance the chapter. Repeated, skipped, invalid, or post-completion calls
 * return the original progress object unchanged.
 */
export function completeChapter1Quest(
  progress: Chapter1Progress,
  questId: Chapter1QuestId,
): Chapter1Progress {
  // Defensive runtime check: quest IDs may originate from persisted or event data.
  if (!isChapter1QuestId(questId)) return progress;

  const currentQuest = getCurrentChapter1Quest(progress);
  if (!currentQuest) return progress;
  if (currentQuest.id !== questId) return progress;
  if (progress.completedQuestIds.includes(questId)) return progress;

  const reward = progress.paymentClaimed ? 0 : currentQuest.moneyReward;

  return {
    currentQuestIndex: progress.currentQuestIndex + 1,
    completedQuestIds: [...progress.completedQuestIds, questId],
    money: progress.money + reward,
    paymentClaimed: progress.paymentClaimed || reward > 0,
  };
}

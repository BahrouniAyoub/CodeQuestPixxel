import {
  CHAPTER1_QUESTS,
  CHAPTER1_QUEST_IDS,
  isChapter1QuestId,
  type Chapter1QuestId,
} from "./chapter1Quests";
import type { Chapter1Progress } from "./chapter1Progress";

export const CHAPTER1_SAVE_VERSION = 1;

export interface Chapter1SaveRecord {
  version: typeof CHAPTER1_SAVE_VERSION;
  progress: Chapter1Progress;
}

export type Chapter1ValidationResult =
  { ok: true; progress: Chapter1Progress } | { ok: false; reason: string };

function invalid(reason: string): Chapter1ValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Copy progress into the persisted envelope without retaining caller-owned arrays. */
export function createChapter1SaveRecord(progress: Chapter1Progress): Chapter1SaveRecord {
  return {
    version: CHAPTER1_SAVE_VERSION,
    progress: {
      currentQuestIndex: progress.currentQuestIndex,
      completedQuestIds: [...progress.completedQuestIds],
      money: progress.money,
      paymentClaimed: progress.paymentClaimed,
    },
  };
}

/**
 * Validate untrusted IndexedDB data before it can become Chapter 1 state.
 * Chapter 1 is linear, so a valid save must always describe an exact prefix.
 */
export function validateChapter1SaveRecord(raw: unknown): Chapter1ValidationResult {
  if (!isRecord(raw)) return invalid("save record is not an object");
  if (raw["version"] !== CHAPTER1_SAVE_VERSION) return invalid("unsupported save version");

  const value = raw["progress"];
  if (!isRecord(value)) return invalid("progress is not an object");

  const index = value["currentQuestIndex"];
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > CHAPTER1_QUESTS.length
  ) {
    return invalid("currentQuestIndex is outside the Chapter 1 quest range");
  }

  const completed = value["completedQuestIds"];
  if (!Array.isArray(completed)) return invalid("completedQuestIds is not an array");
  if (completed.length !== index) {
    return invalid("currentQuestIndex does not match the completed quest count");
  }

  const ids: Chapter1QuestId[] = [];
  for (const id of completed) {
    if (!isChapter1QuestId(id)) return invalid("completedQuestIds contains an invalid quest ID");
    ids.push(id);
  }
  if (new Set(ids).size !== ids.length) return invalid("completedQuestIds contains duplicates");
  if (!ids.every((id, position) => id === CHAPTER1_QUEST_IDS[position])) {
    return invalid("completed quests are not the exact canonical Chapter 1 prefix");
  }

  const money = value["money"];
  if (typeof money !== "number" || !Number.isFinite(money) || money < 0) {
    return invalid("money is not a finite non-negative number");
  }

  const paymentClaimed = value["paymentClaimed"];
  if (typeof paymentClaimed !== "boolean") return invalid("paymentClaimed is not a boolean");

  const expectedMoney = CHAPTER1_QUESTS.slice(0, index).reduce(
    (total, quest) => total + quest.moneyReward,
    0,
  );
  if (money !== expectedMoney) {
    return invalid(`money does not match completed quests (expected $${expectedMoney})`);
  }

  const paymentExpected = expectedMoney > 0;
  if (paymentClaimed !== paymentExpected) {
    return invalid("paymentClaimed is inconsistent with completed quests");
  }

  return {
    ok: true,
    progress: {
      currentQuestIndex: index,
      completedQuestIds: ids,
      money,
      paymentClaimed,
    },
  };
}

/**
 * Step 8G bridge contract between the Godot iframe and the React quest store.
 *
 * The existing `codequest:open-os` message is deliberately left untouched. This
 * module only adds the validated, one-shot father-dialogue completion event and
 * the same-origin state snapshot that lets Godot choose the correct dialogue.
 */
import {
  CAFE_PAYMENT_SAVE_VERSION,
  CAFE_PAYMENT_STATUS,
  validateCafePaymentSaveRecord,
} from "@/features/chapter1/cafeCoding/cafePayment";
import {
  useCafePayment,
  type CafePaymentStore,
} from "@/features/chapter1/cafeCoding/cafePaymentStore";
import { notify as defaultNotify, type OsNotification } from "@/features/notifications/notificationStore";
import { getCurrentChapter1Quest } from "./chapter1Progress";
import {
  CHAPTER1_COMPLETE_MESSAGE,
  CHAPTER1_COMPLETE_TITLE,
  CHAPTER1_QUESTS,
  CHAPTER1_TITLE,
  type Chapter1QuestId,
} from "./chapter1Quests";
import { useChapter1, type Chapter1Store } from "./chapter1Store";

export const GODOT_COMPLETE_EVENT_TYPE = "codequest:chapter1-father-complete";
export const GODOT_EVENT_SOURCE = "godot";
export const FATHER_RETURN_QUEST_ID = "CH1-08";
export const FATHER_RETURN_DIALOGUE_ID = "father-return-v1";
export const FATHER_RETURN_EVENT_ID = "ch1-08-father-dialogue-v1";

/** CH1-01: emitted only when the real father introduction dialogue ends. */
export const GODOT_INTRO_COMPLETE_EVENT_TYPE = "codequest:chapter1-intro-complete";
export const FATHER_INTRO_QUEST_ID: Chapter1QuestId = "CH1-01";
export const FATHER_INTRO_DIALOGUE_ID = "father-intro-v1";
export const FATHER_INTRO_EVENT_ID = "ch1-01-father-dialogue-v1";
export const FATHER_INTRO_COMPLETION_PAYLOAD = {
  type: GODOT_INTRO_COMPLETE_EVENT_TYPE,
  source: GODOT_EVENT_SOURCE,
  questId: FATHER_INTRO_QUEST_ID,
  dialogueId: FATHER_INTRO_DIALOGUE_ID,
  eventId: FATHER_INTRO_EVENT_ID,
} as const;

/** CH1-02: emitted only from the real E interaction with the computer. */
export const GODOT_COMPUTER_COMPLETE_EVENT_TYPE = "codequest:chapter1-computer-complete";
export const COMPUTER_INTERACTION_QUEST_ID: Chapter1QuestId = "CH1-02";
export const COMPUTER_INTERACTION_DIALOGUE_ID = "computer-interaction-v1";
export const COMPUTER_INTERACTION_EVENT_ID = "ch1-02-computer-interaction-v1";
export const COMPUTER_INTERACTION_COMPLETION_PAYLOAD = {
  type: GODOT_COMPUTER_COMPLETE_EVENT_TYPE,
  source: GODOT_EVENT_SOURCE,
  questId: COMPUTER_INTERACTION_QUEST_ID,
  dialogueId: COMPUTER_INTERACTION_DIALOGUE_ID,
  eventId: COMPUTER_INTERACTION_EVENT_ID,
} as const;

/** React → Godot state-change notification. The mirror remains the authority. */
export const GODOT_CHAPTER_STATE_EVENT_TYPE = "codequest:chapter-state";

export type EarlyQuestCompletionPayload =
  | typeof FATHER_INTRO_COMPLETION_PAYLOAD
  | typeof COMPUTER_INTERACTION_COMPLETION_PAYLOAD;

export { CHAPTER1_COMPLETE_MESSAGE, CHAPTER1_COMPLETE_TITLE };

/** The canonical payload. Retry uses this, never a payload supplied by the iframe. */
export const FATHER_DIALOGUE_COMPLETION_PAYLOAD = {
  type: GODOT_COMPLETE_EVENT_TYPE,
  source: GODOT_EVENT_SOURCE,
  questId: FATHER_RETURN_QUEST_ID,
  dialogueId: FATHER_RETURN_DIALOGUE_ID,
  eventId: FATHER_RETURN_EVENT_ID,
} as const;

export interface FatherDialogueCompletionPayload {
  readonly type: typeof GODOT_COMPLETE_EVENT_TYPE;
  readonly source: typeof GODOT_EVENT_SOURCE;
  readonly questId: typeof FATHER_RETURN_QUEST_ID;
  readonly dialogueId: typeof FATHER_RETURN_DIALOGUE_ID;
  readonly eventId: typeof FATHER_RETURN_EVENT_ID;
}

/** State mirrored into the iframe so Godot/PixelOS can render the same quest UI. */
export interface CodeQuestChapterState {
  readonly schema: 1;
  readonly chapterTitle: string;
  readonly questId: string | null;
  readonly questTitle: string | null;
  /** Canonical objective text from chapter1Quests.ts; Godot displays this directly. */
  readonly questObjective: string | null;
  readonly questDescription: string | null;
  readonly questLocation: string | null;
  readonly chapterComplete: boolean;
  readonly money: number;
  readonly paymentClaimed: boolean;
  readonly completedQuestIds: readonly string[];
  readonly completedQuests: readonly { readonly id: string; readonly title: string }[];
  readonly totalQuests: number;
}

export interface FatherCompletionMessageLike {
  readonly origin: unknown;
  readonly source: unknown;
  readonly data: unknown;
}

export type FatherCompletionStatus =
  | "invalid-event"
  | "duplicate"
  | "already-complete"
  | "blocked"
  | "retry"
  | "completed";

export interface FatherCompletionResult {
  readonly status: FatherCompletionStatus;
  readonly reason?: string;
}

interface ChapterStoreLike {
  hydrate: () => Promise<void>;
  completeQuest: Chapter1Store["completeQuest"];
  getState: () => Chapter1Store;
}

interface PaymentStoreLike {
  hydrate: () => Promise<void>;
  getState: () => CafePaymentStore;
}

export interface FatherCompletionDependencies {
  readonly chapterStore: ChapterStoreLike;
  readonly paymentStore: PaymentStoreLike;
  readonly notify?: (notification: Omit<OsNotification, "id" | "createdAt">) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rejects every unrelated, malformed, or guessed completion payload. */
export function isFatherDialogueCompletionPayload(
  value: unknown,
): value is FatherDialogueCompletionPayload {
  if (!isRecord(value)) return false;
  return (
    value["type"] === GODOT_COMPLETE_EVENT_TYPE &&
    value["source"] === GODOT_EVENT_SOURCE &&
    value["questId"] === FATHER_RETURN_QUEST_ID &&
    value["dialogueId"] === FATHER_RETURN_DIALOGUE_ID &&
    value["eventId"] === FATHER_RETURN_EVENT_ID
  );
}

/** Validates origin, iframe source, and payload before any quest work happens. */
export function isFatherDialogueCompletionMessage(
  message: FatherCompletionMessageLike,
  expectedOrigin: string,
  expectedSource: unknown,
): message is FatherCompletionMessageLike & { data: FatherDialogueCompletionPayload } {
  return (
    message.origin === expectedOrigin &&
    message.source === expectedSource &&
    isFatherDialogueCompletionPayload(message.data)
  );
}

/**
 * Accepts only the two early Chapter 1 events. Each event type has exactly one
 * valid quest/dialogue/event-id triple, so a guessed or replayed payload cannot
 * advance a different quest.
 */
export function isEarlyQuestCompletionPayload(
  value: unknown,
): value is EarlyQuestCompletionPayload {
  if (!isRecord(value) || value["source"] !== GODOT_EVENT_SOURCE) return false;

  if (value["type"] === GODOT_INTRO_COMPLETE_EVENT_TYPE) {
    return (
      value["questId"] === FATHER_INTRO_QUEST_ID &&
      value["dialogueId"] === FATHER_INTRO_DIALOGUE_ID &&
      value["eventId"] === FATHER_INTRO_EVENT_ID
    );
  }

  if (value["type"] === GODOT_COMPUTER_COMPLETE_EVENT_TYPE) {
    return (
      value["questId"] === COMPUTER_INTERACTION_QUEST_ID &&
      value["dialogueId"] === COMPUTER_INTERACTION_DIALOGUE_ID &&
      value["eventId"] === COMPUTER_INTERACTION_EVENT_ID
    );
  }

  return false;
}

export function isEarlyQuestCompletionMessage(
  message: FatherCompletionMessageLike,
  expectedOrigin: string,
  expectedSource: unknown,
): message is FatherCompletionMessageLike & { data: EarlyQuestCompletionPayload } {
  return (
    message.origin === expectedOrigin &&
    message.source === expectedSource &&
    isEarlyQuestCompletionPayload(message.data)
  );
}

/** Build the same-origin mirror consumed by Godot. No event is an authority here. */
export function createCodeQuestChapterState(
  progress: Chapter1Store["progress"],
): CodeQuestChapterState {
  const quest = getCurrentChapter1Quest(progress);
  return {
    schema: 1,
    chapterTitle: CHAPTER1_TITLE,
    questId: quest?.id ?? null,
    questTitle: quest?.title ?? null,
    questObjective: quest?.objective ?? null,
    questDescription: quest?.description ?? null,
    questLocation: quest?.location ?? null,
    chapterComplete: quest === null,
    money: progress.money,
    paymentClaimed: progress.paymentClaimed,
    completedQuestIds: progress.completedQuestIds,
    completedQuests: progress.completedQuestIds.map((id) => {
      const def = CHAPTER1_QUESTS.find((q) => q.id === id);
      return { id, title: def?.title ?? id };
    }),
    totalQuests: CHAPTER1_QUESTS.length,
  };
}

function blocked(reason: string): FatherCompletionResult {
  return { status: "blocked", reason };
}

/**
 * Completion handler factory.
 *
 * A failed save is not deduplicated, so the UI can retry safely. A successful
 * save is deduplicated in memory; the persisted quest state is the durable
 * guard across reloads.
 */
export function createFatherDialogueCompletionHandler(dependencies: FatherCompletionDependencies) {
  const processedEventIds = new Set<string>();

  return async function handleFatherDialogueCompletion(
    data: unknown,
  ): Promise<FatherCompletionResult> {
    if (!isFatherDialogueCompletionPayload(data)) {
      return { status: "invalid-event", reason: "Unrecognized Godot event." };
    }
    if (processedEventIds.has(data.eventId)) {
      return { status: "duplicate", reason: "This dialogue completion was already handled." };
    }

    try {
      await Promise.all([dependencies.chapterStore.hydrate(), dependencies.paymentStore.hydrate()]);
    } catch (error) {
      return {
        status: "retry",
        reason: `Saved progress could not be loaded. Try again. ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const chapter = dependencies.chapterStore.getState();
    const payment = dependencies.paymentStore.getState();
    if (!chapter.hydrated || !payment.hydrated) {
      return {
        status: "retry",
        reason: chapter.error ?? payment.error ?? "Saved progress is still loading. Try again.",
      };
    }

    const progress = chapter.progress;
    const currentQuest = getCurrentChapter1Quest(progress);
    const chapterAlreadyComplete =
      currentQuest === null &&
      progress.currentQuestIndex === CHAPTER1_QUESTS.length &&
      progress.completedQuestIds.includes(FATHER_RETURN_QUEST_ID);

    if (chapterAlreadyComplete) {
      processedEventIds.add(data.eventId);
      return { status: "already-complete", reason: "Chapter 1 is already complete." };
    }

    // Intentionally no money === 50 guard. Other legitimately earned funds may
    // be present; the paid payment record is the authority.
    if (!progress.completedQuestIds.includes("CH1-07")) {
      return blocked("Finish the café payment quest before returning to your father.");
    }
    if (currentQuest?.id !== FATHER_RETURN_QUEST_ID) {
      return blocked("The return-to-father quest is not active.");
    }
    if (!progress.paymentClaimed) {
      return blocked("The café payment has not been claimed.");
    }

    const paymentValidation = validateCafePaymentSaveRecord({
      version: CAFE_PAYMENT_SAVE_VERSION,
      payment: payment.payment,
    });
    if (
      !paymentValidation.ok ||
      paymentValidation.payment === null ||
      paymentValidation.payment.status !== CAFE_PAYMENT_STATUS
    ) {
      return blocked("A paid café payment record is required to finish Chapter 1.");
    }

    const saved = await dependencies.chapterStore.completeQuest(FATHER_RETURN_QUEST_ID);
    if (!saved) {
      return {
        status: "retry",
        reason:
          dependencies.chapterStore.getState().error ??
          "Could not save Chapter 1 completion. You can retry safely.",
      };
    }

    processedEventIds.add(data.eventId);
    (dependencies.notify ?? defaultNotify)({
      kind: "success",
      title: CHAPTER1_COMPLETE_TITLE,
      message: CHAPTER1_COMPLETE_MESSAGE,
    });
    return { status: "completed" };
  };
}

export type EarlyQuestCompletionStatus =
  | "invalid-event"
  | "duplicate"
  | "already-complete"
  | "blocked"
  | "retry"
  | "completed";

export interface EarlyQuestCompletionResult {
  readonly status: EarlyQuestCompletionStatus;
  readonly reason?: string;
}

export interface EarlyQuestCompletionDependencies {
  readonly chapterStore: ChapterStoreLike;
}

/**
 * Shared handler for CH1-01 and CH1-02. Persistent quest state is the durable
 * guard across reloads; the in-memory event-id set only dedupes within a session.
 * A failed save is never deduplicated, so Godot/React can retry safely.
 */
export function createEarlyQuestCompletionHandler(
  dependencies: EarlyQuestCompletionDependencies,
) {
  const processedEventIds = new Set<string>();

  return async function handleEarlyQuestCompletion(
    data: unknown,
  ): Promise<EarlyQuestCompletionResult> {
    if (!isEarlyQuestCompletionPayload(data)) {
      return { status: "invalid-event", reason: "Unrecognized Godot event." };
    }
    if (processedEventIds.has(data.eventId)) {
      return { status: "duplicate", reason: "This quest event was already handled." };
    }

    try {
      await dependencies.chapterStore.hydrate();
    } catch (error) {
      return {
        status: "retry",
        reason: `Saved progress could not be loaded. Try again. ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const chapter = dependencies.chapterStore.getState();
    if (!chapter.hydrated) {
      return {
        status: "retry",
        reason: chapter.error ?? "Chapter 1 progress is still loading. Try again.",
      };
    }

    const progress = chapter.progress;
    const currentQuest = getCurrentChapter1Quest(progress);
    if (currentQuest?.id !== data.questId) {
      if (progress.completedQuestIds.includes(data.questId)) {
        processedEventIds.add(data.eventId);
        return { status: "already-complete", reason: "This quest is already complete." };
      }
      return {
        status: "blocked",
        reason: `${data.questId} is not the active Chapter 1 quest.`,
      };
    }

    const saved = await dependencies.chapterStore.completeQuest(data.questId);
    if (!saved) {
      return {
        status: "retry",
        reason:
          dependencies.chapterStore.getState().error ??
          "Could not save Chapter 1 progress. You can retry safely.",
      };
    }

    processedEventIds.add(data.eventId);
    return { status: "completed" };
  };
}

export const handleEarlyQuestCompletion = createEarlyQuestCompletionHandler({
  chapterStore: {
    hydrate: () => useChapter1.getState().hydrate(),
    completeQuest: (questId) => useChapter1.getState().completeQuest(questId),
    getState: () => useChapter1.getState(),
  },
});

// These adapters make the module-level handler's dependency on the live Zustand
// singletons explicit while keeping the handler factory easy to test in isolation.
export const handleFatherDialogueCompletion = createFatherDialogueCompletionHandler({
  chapterStore: {
    hydrate: () => useChapter1.getState().hydrate(),
    completeQuest: (questId) => useChapter1.getState().completeQuest(questId),
    getState: () => useChapter1.getState(),
  },
  paymentStore: {
    hydrate: () => useCafePayment.getState().hydrate(),
    getState: () => useCafePayment.getState(),
  },
});

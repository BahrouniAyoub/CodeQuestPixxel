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
} from "./chapter1Quests";
import { useChapter1, type Chapter1Store } from "./chapter1Store";

export const GODOT_COMPLETE_EVENT_TYPE = "codequest:chapter1-father-complete";
export const GODOT_EVENT_SOURCE = "godot";
export const FATHER_RETURN_QUEST_ID = "CH1-08";
export const FATHER_RETURN_DIALOGUE_ID = "father-return-v1";
export const FATHER_RETURN_EVENT_ID = "ch1-08-father-dialogue-v1";

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

/** State mirrored into the iframe so Godot can select the CH1-08 dialogue. */
export interface CodeQuestChapterState {
  readonly schema: 1;
  readonly questId: string | null;
  readonly chapterComplete: boolean;
  readonly money: number;
  readonly paymentClaimed: boolean;
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

/** Build the same-origin mirror consumed by Godot. No event is an authority here. */
export function createCodeQuestChapterState(
  progress: Chapter1Store["progress"],
): CodeQuestChapterState {
  return {
    schema: 1,
    questId: getCurrentChapter1Quest(progress)?.id ?? null,
    chapterComplete: getCurrentChapter1Quest(progress) === null,
    money: progress.money,
    paymentClaimed: progress.paymentClaimed,
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

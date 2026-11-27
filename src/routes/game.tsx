import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BootScreen } from "@/app/BootScreen";
import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import { initialChapter1Progress } from "@/features/chapter1/chapter1Progress";
import {
  CHAPTER1_COMPLETE_MESSAGE,
  CHAPTER1_COMPLETE_TITLE,
} from "@/features/chapter1/chapter1Quests";
import {
  createGameSaveRecord,
  DEFAULT_CHARACTER,
  listGameSaves,
  parseCharacterSnapshot,
  validateGameSaveRecord,
  type CharacterSaveData,
} from "@/features/gameMenu/gameSave";
import {
  createCodeQuestChapterState,
  FATHER_DIALOGUE_COMPLETION_PAYLOAD,
  GODOT_CHAPTER_STATE_EVENT_TYPE,
  handleEarlyQuestCompletion,
  handleFatherDialogueCompletion,
  isEarlyQuestCompletionMessage,
  isEarlyQuestCompletionPayload,
  isFatherDialogueCompletionMessage,
  isFatherDialogueCompletionPayload,
  type CodeQuestChapterState,
  type EarlyQuestCompletionPayload,
  type FatherDialogueCompletionPayload,
} from "@/features/chapter1/godotBridge";
import { useChapter1 } from "@/features/chapter1/chapter1Store";

const PixelOS = lazy(() => import("@/app/PixelOS"));

export const Route = createFileRoute("/game")({
  component: BrowserGame,
});

type ChapterStateWindow = Window & { __codequestChapterState?: CodeQuestChapterState };
type Chapter1BridgePayload = FatherDialogueCompletionPayload | EarlyQuestCompletionPayload;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toGodotCharacter(character: CharacterSaveData) {
  return {
    name: character.name,
    body_index: character.bodyIndex,
    skin_index: character.skinIndex,
    hair_style_index: character.hairStyleIndex,
    hair_color_index: character.hairColorIndex,
    top_index: character.topIndex,
    bottom_index: character.bottomIndex,
    feet_index: character.feetIndex,
  };
}

function questSignature(progress: {
  currentQuestIndex: number;
  completedQuestIds: readonly string[];
  paymentClaimed: boolean;
}): string {
  return `${progress.currentQuestIndex}|${progress.completedQuestIds.join(",")}|${String(progress.paymentClaimed)}`;
}

interface CompletionBanner {
  readonly kind: "success" | "retry";
  readonly title: string;
  readonly message: string;
  readonly retryPayload?: Chapter1BridgePayload;
}

export function BrowserGame() {
  const [showOS, setShowOS] = useState(false);
  const [playerName, setPlayerName] = useState(DEFAULT_CHARACTER.name);
  const [frameLoadCount, setFrameLoadCount] = useState(0);
  const [banner, setBanner] = useState<CompletionBanner | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const latestCharacterRef = useRef<CharacterSaveData | null>(null);
  const restoringRef = useRef(false);
  const questSignatureRef = useRef<string | null>(null);
  const migratedRef = useRef(false);

  const chapterProgress = useChapter1((state) => state.progress);
  const chapterState = useMemo(
    () => createCodeQuestChapterState(chapterProgress),
    [chapterProgress],
  );

  // Hydrate here too: the bridge must not publish initial state over a save, and
  // the completion guards need both stores ready before they can be trusted.
  useEffect(() => {
    void useChapter1.getState().hydrate();
    void useCafePayment.getState().hydrate();
  }, []);

  const publishChapterState = useCallback(() => {
    if (restoringRef.current) return;
    const snapshot = createCodeQuestChapterState(useChapter1.getState().progress);
    (window as ChapterStateWindow).__codequestChapterState = snapshot;

    const iframeWindow = iframeRef.current?.contentWindow as ChapterStateWindow | null;
    if (iframeWindow) {
      // Keep the mirror for on-demand reads and push a same-origin notification
      // so Godot can refresh its objective without reloading or polling.
      iframeWindow.__codequestChapterState = snapshot;
      iframeWindow.postMessage(
        { type: GODOT_CHAPTER_STATE_EVENT_TYPE, state: snapshot },
        window.location.origin,
      );
    }
  }, []);

  useEffect(() => {
    publishChapterState();
  }, [publishChapterState, frameLoadCount, chapterState]);

  useEffect(() => {
    if (!saveNotice) return;
    const timer = window.setTimeout(() => setSaveNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  const showSuccessBanner = useCallback(() => {
    setBanner({
      kind: "success",
      title: CHAPTER1_COMPLETE_TITLE,
      message: CHAPTER1_COMPLETE_MESSAGE,
    });
  }, []);

  const applyBridgeCompletion = useCallback(
    async (payload: Chapter1BridgePayload) => {
      const isFatherEvent = isFatherDialogueCompletionPayload(payload);
      const result = isFatherEvent
        ? await handleFatherDialogueCompletion(payload)
        : await handleEarlyQuestCompletion(payload);

      if (result.status === "completed" || result.status === "already-complete") {
        // Only the final father event shows the Chapter 1 completion banner.
        if (isFatherEvent) showSuccessBanner();
        else setBanner(null);
        return;
      }

      if (result.status === "retry") {
        setBanner({
          kind: "retry",
          title: isFatherEvent ? "Chapter 1 completion not saved" : "Chapter 1 progress not saved",
          message: result.reason ?? "You can retry safely; no quest will be completed twice.",
          retryPayload: payload,
        });
        return;
      }

      if (result.status === "blocked") {
        console.warn("Chapter 1 bridge event blocked:", result.reason);
      }
    },
    [showSuccessBanner],
  );

  const retryCompletion = useCallback(async () => {
    await applyBridgeCompletion(banner?.retryPayload ?? FATHER_DIALOGUE_COMPLETION_PAYLOAD);
  }, [applyBridgeCompletion, banner?.retryPayload]);

  const postToGodot = useCallback((payload: Record<string, unknown>): boolean => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return false;
    iframeWindow.postMessage(payload, window.location.origin);
    return true;
  }, []);

  const returnToGame = useCallback(() => {
    setShowOS(false);
  }, []);

  const resetForNewGame = useCallback(() => {
    restoringRef.current = true;
    useChapter1.setState({
      progress: initialChapter1Progress,
      hydrated: true,
      loading: false,
      error: null,
    });
    useCafePayment.setState({
      payment: null,
      hydrated: true,
      loading: false,
      error: null,
      invalidRecord: false,
    });
    questSignatureRef.current = questSignature(initialChapter1Progress);
    latestCharacterRef.current = null;
    setPlayerName(DEFAULT_CHARACTER.name);
    setSaveNotice("");
    setBanner(null);
    restoringRef.current = false;
  }, []);

  const adoptGodotSave = useCallback(
    async (data: Record<string, unknown>) => {
      const result = validateGameSaveRecord(data["save"] ?? data);
      if (!result.ok) return;
      const save = result.record;

      restoringRef.current = true;
      await Promise.all([useChapter1.getState().hydrate(), useCafePayment.getState().hydrate()]);

      useChapter1.setState({
        progress: save.progress,
        hydrated: true,
        loading: false,
        error: null,
      });
      useCafePayment.setState({
        payment: save.payment,
        hydrated: true,
        loading: false,
        error: null,
        invalidRecord: false,
      });
      questSignatureRef.current = questSignature(save.progress);
      latestCharacterRef.current = save.character;
      setPlayerName(save.character.name.trim() || DEFAULT_CHARACTER.name);
      setSaveNotice(`Loaded ${save.character.name || "Player"}`);
      setBanner(null);
      restoringRef.current = false;
      publishChapterState();
      postToGodot({
        schema: 1,
        type: "codequest:load-applied",
        source: "react",
        slot: save.slot,
      });
    },
    [postToGodot, publishChapterState],
  );

  const respondToStateRequest = useCallback(
    async (data: Record<string, unknown>) => {
      const [chapter, cafe] = await Promise.all([
        useChapter1
          .getState()
          .hydrate()
          .then(() => useChapter1.getState()),
        useCafePayment
          .getState()
          .hydrate()
          .then(() => useCafePayment.getState()),
      ]);
      if (!chapter.hydrated || !cafe.hydrated) {
        setSaveNotice("Progress is still loading. Try saving again.");
        postToGodot({
          schema: 1,
          type: "codequest:save-failed",
          source: "react",
          reason: "Progress is still loading",
        });
        return;
      }

      const character =
        parseCharacterSnapshot(data["character"]) ??
        latestCharacterRef.current ??
        DEFAULT_CHARACTER;
      latestCharacterRef.current = character;
      setPlayerName(character.name.trim() || DEFAULT_CHARACTER.name);

      const rawSlot = data["slot"];
      const requestedSlot = typeof rawSlot === "string" && rawSlot.trim() ? rawSlot.trim() : "auto";
      const slot = requestedSlot === "quick" ? "auto" : requestedSlot;
      const rawReason = data["reason"];
      const reason =
        typeof rawReason === "string" && rawReason.trim().length > 0
          ? rawReason.trim()
          : "Saved game";
      const requestId = data["requestId"];

      const record = createGameSaveRecord({
        slot,
        reason,
        character,
        progress: chapter.progress,
        payment: cafe.payment,
      });

      postToGodot({
        schema: 1,
        type: "codequest:state-snapshot",
        source: "react",
        requestId,
        slot: record.slot,
        reason: record.reason,
        savedAt: record.savedAt,
        character: toGodotCharacter(record.character),
        progress: record.progress,
        payment: record.payment,
        chapterState: createCodeQuestChapterState(chapter.progress),
      });
    },
    [postToGodot],
  );

  const importLegacySaves = useCallback(async (): Promise<boolean> => {
    const saves = await listGameSaves().catch(() => []);
    if (saves.length === 0) return false;
    return postToGodot({
      schema: 1,
      type: "codequest:import-saves",
      source: "react",
      saves: saves.map((save) => ({
        ...save,
        chapterState: createCodeQuestChapterState(save.progress),
      })),
    });
  }, [postToGodot]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeWindow) return;

      if (!isRecord(event.data)) return;

      if (event.data["type"] === "codequest:character-snapshot") {
        const character = parseCharacterSnapshot(event.data["character"]);
        if (character !== null) {
          latestCharacterRef.current = character;
          setPlayerName(character.name.trim() || DEFAULT_CHARACTER.name);
        }
        return;
      }

      if (event.data["type"] === "codequest:request-state") {
        void respondToStateRequest(event.data);
        return;
      }

      if (event.data["type"] === "codequest:load-state") {
        void adoptGodotSave(event.data);
        return;
      }

      if (event.data["type"] === "codequest:new-game") {
        resetForNewGame();
        return;
      }

      const fatherMessageValid = isFatherDialogueCompletionMessage(
        event,
        window.location.origin,
        iframeWindow,
      );
      if (fatherMessageValid && isFatherDialogueCompletionPayload(event.data)) {
        void applyBridgeCompletion(event.data);
        return;
      }

      const earlyMessageValid = isEarlyQuestCompletionMessage(
        event,
        window.location.origin,
        iframeWindow,
      );
      if (earlyMessageValid && isEarlyQuestCompletionPayload(event.data)) {
        void applyBridgeCompletion(event.data);
        return;
      }

      // Existing bridge event: unchanged behavior.
      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "type" in event.data &&
        event.data["type"] === "codequest:open-os"
      ) {
        setShowOS(true);
      }
    };

    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [adoptGodotSave, applyBridgeCompletion, resetForNewGame, respondToStateRequest]);

  useEffect(() => {
    if (migratedRef.current) return;
    void importLegacySaves().then((sent) => {
      if (sent) migratedRef.current = true;
    });
  }, [frameLoadCount, importLegacySaves]);

  useEffect(() => {
    if (useChapter1.getState().hydrated) {
      questSignatureRef.current = questSignature(useChapter1.getState().progress);
    }
    return useChapter1.subscribe((state) => {
      if (restoringRef.current || !state.hydrated) return;
      const signature = questSignature(state.progress);
      if (questSignatureRef.current === null) {
        questSignatureRef.current = signature;
        return;
      }
      if (signature === questSignatureRef.current) return;
      questSignatureRef.current = signature;
      postToGodot({
        schema: 1,
        type: "codequest:state-commit",
        source: "react",
        slot: "auto",
        reason: "PixelOS task complete",
      });
    });
  }, [postToGodot]);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#111827", overflow: "hidden" }}>
      <iframe
        ref={iframeRef}
        id="codequest-godot"
        title="CodeQuest Godot game"
        src="/godot/index.html"
        allow="autoplay; fullscreen"
        onLoad={() => setFrameLoadCount((count) => count + 1)}
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          visibility: showOS ? "hidden" : "visible",
        }}
      />

      {saveNotice ? (
        <div
          role="status"
          data-testid="game-save-notice"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 1300,
            padding: "8px 12px",
            background: "#f2d782",
            color: "#111827",
            border: "2px solid #111827",
            fontFamily: "monospace",
            fontWeight: 800,
          }}
        >
          {saveNotice}
        </div>
      ) : null}

      {banner ? (
        <div
          role="status"
          data-testid="chapter1-completion-banner"
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: "min(560px, calc(100% - 32px))",
            background: banner.kind === "success" ? "#f2d782" : "#4b1f24",
            color: banner.kind === "success" ? "#111827" : "#ffe9e9",
            border: "3px solid #111827",
            boxShadow: "0 8px 0 rgba(0,0,0,0.35)",
            padding: "12px 16px",
            textAlign: "center",
          }}
        >
          <strong style={{ display: "block", fontSize: 15, lineHeight: 1.3 }}>
            {banner.title}
          </strong>
          <span style={{ display: "block", marginTop: 6, fontSize: 12, lineHeight: 1.4 }}>
            {banner.message}
          </span>
          {banner.kind === "retry" ? (
            <button
              type="button"
              onClick={() => void retryCompletion()}
              style={{
                marginTop: 10,
                padding: "6px 12px",
                border: "2px solid #111827",
                background: "#f2d782",
                color: "#111827",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Retry completion
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setBanner(null)}
              style={{
                marginTop: 10,
                padding: "6px 12px",
                border: "2px solid #111827",
                background: "transparent",
                color: "inherit",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      ) : null}

      {showOS && (
        <div style={{ position: "absolute", inset: 0, background: "#101827" }}>
          <ClientOnly fallback={<BootScreen />}>
            <Suspense fallback={<BootScreen />}>
              <PixelOS playerName={playerName} onReturnToGame={returnToGame} />
            </Suspense>
          </ClientOnly>
        </div>
      )}
    </main>
  );
}

import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BootScreen } from "@/app/BootScreen";
import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import {
  CHAPTER1_COMPLETE_MESSAGE,
  CHAPTER1_COMPLETE_TITLE,
} from "@/features/chapter1/chapter1Quests";
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

interface CompletionBanner {
  readonly kind: "success" | "retry";
  readonly title: string;
  readonly message: string;
  readonly retryPayload?: Chapter1BridgePayload;
}

export function BrowserGame() {
  const [showOS, setShowOS] = useState(false);
  const [frameLoadCount, setFrameLoadCount] = useState(0);
  const [banner, setBanner] = useState<CompletionBanner | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const chapterProgress = useChapter1((state) => state.progress);
  const chapterState = useMemo(() => createCodeQuestChapterState(chapterProgress), [chapterProgress]);

  // Hydrate here too: the bridge must not publish initial state over a save, and
  // the completion guards need both stores ready before they can be trusted.
  useEffect(() => {
    void useChapter1.getState().hydrate();
    void useCafePayment.getState().hydrate();
  }, []);

  const publishChapterState = useCallback(() => {
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

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeWindow) return;

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
        event.data.type === "codequest:open-os"
      ) {
        setShowOS(true);
      }
    };

    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [applyBridgeCompletion]);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#111827", overflow: "hidden" }}>
      <iframe
        ref={iframeRef}
        id="codequest-godot"
        title="CodeQuest Godot game"
        src="/godot/index.html"
        allow="autoplay; fullscreen"
        onLoad={() => setFrameLoadCount((count) => count + 1)}
        style={{ width: "100%", height: "100%", border: 0, display: "block", visibility: showOS ? "hidden" : "visible" }}
      />

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
          <strong style={{ display: "block", fontSize: 15, lineHeight: 1.3 }}>{banner.title}</strong>
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
              <PixelOS />
            </Suspense>
          </ClientOnly>
          <button
            type="button"
            onClick={() => setShowOS(false)}
            style={{ position: "fixed", top: 8, right: 12, zIndex: 2147483647, background: "#f2d782", color: "#111", border: "2px solid #111", borderRadius: 5, padding: "9px 15px", fontWeight: 800, cursor: "pointer" }}
          >
            Exit Computer · Return to Game
          </button>
        </div>
      )}
    </main>
  );
}

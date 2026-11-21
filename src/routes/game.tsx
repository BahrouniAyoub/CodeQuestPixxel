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
  handleFatherDialogueCompletion,
  isFatherDialogueCompletionMessage,
  type CodeQuestChapterState,
} from "@/features/chapter1/godotBridge";
import { useChapter1 } from "@/features/chapter1/chapter1Store";

const PixelOS = lazy(() => import("@/app/PixelOS"));

export const Route = createFileRoute("/game")({
  component: BrowserGame,
});

type ChapterStateWindow = Window & { __codequestChapterState?: CodeQuestChapterState };

interface CompletionBanner {
  readonly kind: "success" | "retry";
  readonly title: string;
  readonly message: string;
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
    if (iframeWindow) iframeWindow.__codequestChapterState = snapshot;
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

  const retryCompletion = useCallback(async () => {
    const result = await handleFatherDialogueCompletion(FATHER_DIALOGUE_COMPLETION_PAYLOAD);
    if (result.status === "completed" || result.status === "already-complete") {
      showSuccessBanner();
      return;
    }
    setBanner({
      kind: "retry",
      title: "Chapter 1 completion not saved",
      message: result.reason ?? "You can retry safely; no reward will be added twice.",
    });
  }, [showSuccessBanner]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeWindow) return;

      if (isFatherDialogueCompletionMessage(event, window.location.origin, iframeWindow)) {
        void handleFatherDialogueCompletion(event.data).then((result) => {
          if (result.status === "completed" || result.status === "already-complete") {
            showSuccessBanner();
            return;
          }
          if (result.status === "retry") {
            setBanner({
              kind: "retry",
              title: "Chapter 1 completion not saved",
              message: result.reason ?? "You can retry safely; no reward will be added twice.",
            });
            return;
          }
          if (result.status === "blocked") {
            console.warn("Father dialogue completion blocked:", result.reason);
          }
        });
        return;
      }

      // Existing bridge event: unchanged behavior.
      if (event.data?.type === "codequest:open-os") setShowOS(true);
    };

    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [showSuccessBanner]);

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

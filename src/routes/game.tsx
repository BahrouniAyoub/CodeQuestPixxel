import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { BootScreen } from "@/app/BootScreen";

const PixelOS = lazy(() => import("@/app/PixelOS"));

export const Route = createFileRoute("/game")({
  component: BrowserGame,
});

function BrowserGame() {
  const [showOS, setShowOS] = useState(false);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== document.querySelector<HTMLIFrameElement>("#codequest-godot")?.contentWindow) return;
      if (event.data?.type === "codequest:open-os") setShowOS(true);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#111827", overflow: "hidden" }}>
      <iframe
        id="codequest-godot"
        title="CodeQuest Godot game"
        src="/godot/index.html"
        allow="autoplay; fullscreen"
        style={{ width: "100%", height: "100%", border: 0, display: "block", visibility: showOS ? "hidden" : "visible" }}
      />
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

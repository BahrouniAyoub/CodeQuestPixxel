import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BootScreen } from "@/app/BootScreen";

// The OS uses IndexedDB, Web Workers and drag/resize libraries, so it only renders in the browser.
const PixelOS = lazy(() => import("@/app/PixelOS"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeQuest Pixel OS — Desktop" },
      {
        name: "description",
        content: "Boot into CodeQuest Pixel OS: a pixel-art desktop with tickets, a Python editor, team chat and XP progress.",
      },
      { property: "og:title", content: "CodeQuest Pixel OS — Desktop" },
      {
        property: "og:description",
        content: "A miniature pixel-art Windows-style computer built for junior developers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<BootScreen />}>
      <Suspense fallback={<BootScreen />}>
        <PixelOS />
      </Suspense>
    </ClientOnly>
  );
}

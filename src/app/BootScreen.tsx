export function BootScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-navy text-ink">
      <p className="font-display text-4xl px-text-shadow">CodeQuest Pixel OS</p>
      <p className="text-sm text-ink-dim">
        Booting<span className="anim-blink">_</span>
      </p>
    </div>
  );
}

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2 } from "lucide-react";
import { unlockCafeApplicationForTesting, type DevUnlockResult } from "../devGigboardTesting";

interface GigBoardDevTestingPanelProps {
  /** Derived from `isDevTestingEnabled()`; false renders nothing in production. */
  readonly enabled: boolean;
}

/**
 * Temporary developer panel. It only advances CH1-01..CH1-03 through the normal
 * Chapter 1 action; it never submits a proposal or accepts the application.
 */
export function GigBoardDevTestingPanel({ enabled }: GigBoardDevTestingPanelProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DevUnlockResult | null>(null);

  if (!enabled) return null;

  const handleUnlock = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const next = await unlockCafeApplicationForTesting();
    setResult(next);
    setBusy(false);
  };

  return (
    <section className="cq-gb-dev-panel" aria-label="Development testing">
      <div className="cq-gb-dev-head">
        <FlaskConical size={15} aria-hidden="true" />
        <div>
          <strong>Development Testing — Café Job</strong>
          <small>Temporary controls. Removed after Godot integration.</small>
        </div>
      </div>

      <button type="button" onClick={() => void handleUnlock()} disabled={busy}>
        {busy ? (
          <>
            <Loader2 size={14} className="cq-gb-spin" aria-hidden="true" /> Unlocking…
          </>
        ) : (
          "Unlock Application for Testing"
        )}
      </button>

      {result ? (
        <p
          className={
            result.ok ? "cq-gb-dev-feedback" : "cq-gb-dev-feedback cq-gb-dev-feedback-error"
          }
          role={result.ok ? "status" : "alert"}
        >
          {result.ok ? (
            <CheckCircle2 size={13} aria-hidden="true" />
          ) : (
            <AlertTriangle size={13} aria-hidden="true" />
          )}{" "}
          {result.message}
        </p>
      ) : null}
    </section>
  );
}

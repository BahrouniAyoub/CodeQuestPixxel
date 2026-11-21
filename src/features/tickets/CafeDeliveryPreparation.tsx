import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileText,
  Lightbulb,
  Loader2,
  LockKeyhole,
  Play,
  RefreshCw,
} from "lucide-react";
import { getEntry } from "@/services/filesystem/filesystem";
import { getPythonRunner } from "@/services/runner/pyodideRunner";
import { useCafeDoc } from "@/features/chapter1/cafeCoding/cafeDocStore";
import { useCafeProjectDeliveryStatus } from "@/features/chapter1/cafeCoding/cafeDeliveryStatus";
import { openCafeDocumentationInEditor } from "@/features/chapter1/cafeCoding/cafeDocFiles";
import {
  analyzeCafeReadme,
  type CafeReadmeAnalysis,
} from "@/features/chapter1/cafeCoding/cafeDocReadme";
import { CAFE_DOC_TASK } from "@/features/chapter1/cafeCoding/cafeDocTask";
import { verifyCafeDocumentationFromSavedFile } from "@/features/chapter1/cafeCoding/cafeDocVerification";
import {
  validateCafeDevTask,
  type CafeDevValidationResult,
} from "@/features/chapter1/cafeCoding/cafeDevValidator";
import { verifyCafeProjectDelivery } from "@/features/chapter1/cafeCoding/cafeDeliveryVerification";
import { useFileSession } from "@/features/editor/fileSession";

interface CafeDeliveryPreparationProps {
  readonly developmentComplete: boolean;
  readonly applicationAccepted: boolean;
  readonly setupRequired: boolean;
}

interface Feedback {
  readonly kind: "success" | "error" | "info";
  readonly message: string;
}

function statusTone(status: string): string {
  if (status === "ready-for-delivery") return "ready";
  if (status === "final-checks-required") return "checks";
  return "development";
}

/**
 * Final "Project Delivery Preparation" section for the café board.
 *
 * All instructions and verification stay in Tickets. The Editor is only used
 * to edit the player's saved files.
 */
export function CafeDeliveryPreparation({
  developmentComplete,
  applicationAccepted,
  setupRequired,
}: CafeDeliveryPreparationProps) {
  const delivery = useCafeProjectDeliveryStatus();
  const docProgress = useCafeDoc((state) => state.progress);
  const openFilePath = useFileSession((state) => state.filePath);
  const openFileDirty = useFileSession((state) => state.dirty);

  const [docRunning, setDocRunning] = useState(false);
  const [finalRunning, setFinalRunning] = useState(false);
  const [docAnalysis, setDocAnalysis] = useState<CafeReadmeAnalysis | null>(null);
  const [finalValidation, setFinalValidation] = useState<CafeDevValidationResult | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const unlocked = developmentComplete && applicationAccepted && !setupRequired;
  const running = docRunning || finalRunning;

  const documentationStatus = !unlocked
    ? "Locked"
    : delivery.documentationVerified
      ? "Complete"
      : delivery.readmeChangedSinceVerification
        ? "Needs re-verification"
        : delivery.readmePresent
          ? "In Progress"
          : "Available";

  const finalTestsStatus = delivery.finalCheckPassed
    ? "Passed"
    : delivery.projectChangedSinceFinalCheck
      ? "Needs re-check"
      : docProgress.delivery.checkedAt
        ? "Not passed"
        : "Not run";

  const openReadme = async () => {
    if (!unlocked || running) return;
    setFeedback(null);
    try {
      const result = await openCafeDocumentationInEditor();
      if (!mounted.current) return;
      setFeedback({
        kind: result.ok ? "info" : "error",
        message: result.ok
          ? "README.md opened in the Editor. Save your documentation, then verify it here."
          : result.reason,
      });
    } catch (error) {
      if (!mounted.current) return;
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const verifyDocumentation = async () => {
    if (!unlocked || running) return;
    setDocRunning(true);
    setFeedback(null);
    setDocAnalysis(null);
    setFinalValidation(null);

    try {
      const result = await verifyCafeDocumentationFromSavedFile(
        {
          developmentComplete,
          openFilePath: useFileSession.getState().filePath,
          openFileDirty: useFileSession.getState().dirty,
        },
        {
          readEntry: getEntry,
          recordVerified: (signature) =>
            useCafeDoc.getState().recordDocumentationVerified(signature),
        },
      );
      if (!mounted.current) return;

      setDocAnalysis(result.analysis ?? null);
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.reason });
        return;
      }

      await delivery.refresh();
      if (!mounted.current) return;
      setFeedback({ kind: "success", message: result.reason });
    } catch (error) {
      if (!mounted.current) return;
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (mounted.current) setDocRunning(false);
    }
  };

  const runFinalCheck = async () => {
    if (!unlocked || running) return;
    setFinalRunning(true);
    setFeedback(null);
    setFinalValidation(null);

    try {
      const result = await verifyCafeProjectDelivery(
        {
          developmentComplete,
          setupComplete: delivery.setupComplete,
          docProgress: useCafeDoc.getState().progress,
          openFilePath: useFileSession.getState().filePath,
          openFileDirty: useFileSession.getState().dirty,
        },
        {
          readEntry: getEntry,
          validateProject: (files) => validateCafeDevTask(getPythonRunner(), "CAFE-DEV-04", files),
          recordDeliveryCheck: (input) => useCafeDoc.getState().recordDeliveryCheck(input),
        },
      );
      if (!mounted.current) return;

      if ("validation" in result && result.validation) setFinalValidation(result.validation);
      if ("analysis" in result && result.analysis) setDocAnalysis(result.analysis);

      await delivery.refresh();
      if (!mounted.current) return;

      setFeedback({
        kind: result.ok ? "success" : "error",
        message: result.reason,
      });
    } catch (error) {
      if (!mounted.current) return;
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (mounted.current) setFinalRunning(false);
    }
  };

  const revealHint = () => {
    setHintsShown((current) => Math.min(current + 1, CAFE_DOC_TASK.hints.length));
  };

  const showPreview = () => {
    const readme = delivery.snapshot.readme ?? "";
    setDocAnalysis(readme ? analyzeCafeReadme(readme) : null);
    setFeedback({
      kind: "info",
      message: readme
        ? "Documentation preview checked against the saved README.md."
        : "README.md is not saved yet.",
    });
  };

  return (
    <section className="cq-cafe-delivery" aria-labelledby="cq-cafe-delivery-title">
      <div className="cq-cafe-delivery-head">
        <div>
          <span className="cq-jira-eyebrow">CAFE-DOC-01 · FINAL PREPARATION</span>
          <h3 id="cq-cafe-delivery-title">Project Delivery Preparation</h3>
          <p>
            Documentation and final checks use your saved project files. Nothing is submitted or
            paid in this step.
          </p>
        </div>
        <span
          className={`cq-cafe-delivery-badge cq-cafe-delivery-badge-${statusTone(delivery.status)}`}
          data-testid="cafe-delivery-status"
        >
          {delivery.loading ? "Checking…" : delivery.label}
        </span>
      </div>

      <div className="cq-cafe-delivery-grid">
        <div className="cq-cafe-delivery-card">
          <strong>Coding tasks</strong>
          <span>
            {delivery.codingCompletedCount}/{delivery.codingTotal} complete
          </span>
          <small>
            {delivery.codingTasksComplete
              ? "All four coding tasks are verified."
              : "Finish the four development tasks first."}
          </small>
        </div>
        <div className="cq-cafe-delivery-card">
          <strong>Documentation</strong>
          <span>{documentationStatus}</span>
          <small>
            {delivery.documentationVerified
              ? "README.md matches the verified content."
              : delivery.readmeChangedSinceVerification
                ? "README.md changed since verification."
                : "Verify the saved README.md."}
          </small>
        </div>
        <div className="cq-cafe-delivery-card">
          <strong>Final tests</strong>
          <span>{finalTestsStatus}</span>
          <small>
            {delivery.finalCheckPassed
              ? "The saved calculator passed the end-to-end check."
              : delivery.projectChangedSinceFinalCheck
                ? "Project files changed since the final check."
                : "Run the final project check."}
          </small>
        </div>
        <div className="cq-cafe-delivery-card">
          <strong>Delivery status</strong>
          <span>{delivery.loading ? "Checking…" : delivery.label}</span>
          <small>Derived from verified files, not a button click.</small>
        </div>
      </div>

      {!unlocked ? (
        <p className="cq-cafe-delivery-notice">
          <LockKeyhole size={14} aria-hidden="true" />
          {!applicationAccepted
            ? "The café project unlocks after Alex Morgan accepts your proposal."
            : setupRequired
              ? "Finish the café project setup before documenting the application."
              : "Complete all four café coding tasks to unlock CAFE-DOC-01."}
        </p>
      ) : null}

      <div className="cq-cafe-delivery-task">
        <div className="cq-cafe-delivery-task-head">
          <FileText size={17} aria-hidden="true" />
          <div>
            <strong>
              {CAFE_DOC_TASK.id} · {CAFE_DOC_TASK.title}
            </strong>
            <small>{CAFE_DOC_TASK.primaryFile}</small>
          </div>
          <span
            className={`cq-cafe-status ${delivery.documentationVerified ? "cq-cafe-status-completed" : unlocked ? "cq-cafe-status-in-progress" : "cq-cafe-status-locked"}`}
          >
            {delivery.documentationVerified ? <Check size={11} /> : <ClipboardList size={11} />}{" "}
            {documentationStatus}
          </span>
        </div>
        <p>{CAFE_DOC_TASK.description}</p>
        <p className="cq-cafe-delivery-objective">{CAFE_DOC_TASK.objective}</p>

        <details className="cq-cafe-delivery-instructions">
          <summary>README requirements and example outline</summary>
          <ol>
            {CAFE_DOC_TASK.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
          <pre>{CAFE_DOC_TASK.example}</pre>
        </details>

        <div className="cq-cafe-delivery-hints">
          {CAFE_DOC_TASK.hints.slice(0, hintsShown).map((hint, index) => (
            <p key={hint}>
              <b>Hint {index + 1}:</b> {hint}
            </p>
          ))}
          {hintsShown < CAFE_DOC_TASK.hints.length ? (
            <button type="button" onClick={revealHint}>
              <Lightbulb size={14} aria-hidden="true" /> Reveal hint {hintsShown + 1} of{" "}
              {CAFE_DOC_TASK.hints.length}
            </button>
          ) : (
            <small>All hints revealed. No XP penalty.</small>
          )}
        </div>
      </div>

      <div className="cq-cafe-delivery-actions">
        <button
          type="button"
          className="cq-cafe-open"
          onClick={() => void openReadme()}
          disabled={!unlocked || running}
        >
          <Code2 size={15} aria-hidden="true" /> Open README in Editor
        </button>
        <button
          type="button"
          className="cq-cafe-verify"
          onClick={() => void verifyDocumentation()}
          disabled={!unlocked || running || delivery.documentationVerified}
        >
          {docRunning ? (
            <>
              <Loader2 size={15} className="cq-cafe-spin" aria-hidden="true" /> Verifying…
            </>
          ) : (
            <>
              <Play size={15} aria-hidden="true" /> Verify Documentation
            </>
          )}
        </button>
        <button
          type="button"
          className="cq-cafe-final-check"
          onClick={() => void runFinalCheck()}
          disabled={!unlocked || running || !delivery.documentationVerified}
        >
          {finalRunning ? (
            <>
              <Loader2 size={15} className="cq-cafe-spin" aria-hidden="true" /> Running final check…
            </>
          ) : (
            <>
              <Award size={15} aria-hidden="true" /> Run Final Project Check
            </>
          )}
        </button>
        <button
          type="button"
          className="cq-cafe-preview"
          onClick={showPreview}
          disabled={!unlocked || running || !delivery.readmePresent}
        >
          <RefreshCw size={14} aria-hidden="true" /> Check Saved README
        </button>
      </div>

      <p className="cq-cafe-action-hint">
        {!unlocked
          ? "CAFE-DOC-01 unlocks after all four coding tasks are verified."
          : delivery.documentationVerified
            ? "Documentation is verified. Run the final project check to confirm the saved Python application."
            : "Verification reads the saved README.md and never writes its content for you."}
      </p>

      {openFileDirty && openFilePath && openFilePath.toLowerCase().endsWith(".md") ? (
        <p className="cq-cafe-delivery-notice">
          <AlertTriangle size={14} aria-hidden="true" /> README.md has unsaved Editor changes. Save
          the file before verifying.
        </p>
      ) : null}

      {feedback ? (
        <p
          className={`cq-cafe-feedback cq-cafe-feedback-${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.kind === "error" ? (
            <AlertTriangle size={14} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} aria-hidden="true" />
          )}{" "}
          {feedback.message}
        </p>
      ) : null}

      {docAnalysis ? (
        <div
          className={
            docAnalysis.ok
              ? "cq-cafe-results cq-cafe-results-pass"
              : "cq-cafe-results cq-cafe-results-fail"
          }
          aria-live="polite"
        >
          <strong>{docAnalysis.summary}</strong>
          <small>Saved README.md · {docAnalysis.length} characters</small>
          <ul>
            {docAnalysis.requirements.map((requirement) => (
              <li key={requirement.id}>
                <span>{requirement.passed ? "✓" : "✕"}</span>
                <div>
                  <strong>{requirement.label}</strong>
                  <small>{requirement.passed ? "Documented." : requirement.feedback}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {finalValidation ? (
        <div
          className={
            finalValidation.status === "passed"
              ? "cq-cafe-results cq-cafe-results-pass"
              : "cq-cafe-results cq-cafe-results-fail"
          }
          aria-live="polite"
        >
          <strong>{finalValidation.message}</strong>
          <small>
            {finalValidation.testsPassed}/{finalValidation.testsExecuted} tests passed ·{" "}
            {finalValidation.testsTotal} total
          </small>
          <ul>
            {finalValidation.outcomes.map((outcome, index) => (
              <li key={`${outcome.name}-${index}`}>
                <span>{outcome.passed ? "✓" : "✕"}</span>
                <div>
                  <strong>{outcome.name}</strong>
                  <small>{outcome.message}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {delivery.missingFiles.length > 0 ? (
        <p className="cq-cafe-delivery-notice">
          <AlertTriangle size={14} aria-hidden="true" /> Required files missing:{" "}
          {delivery.missingFiles.join(", ")}. Recreate them before delivery.
        </p>
      ) : null}

      {delivery.readmeChangedSinceVerification ? (
        <p className="cq-cafe-delivery-notice">
          <AlertTriangle size={14} aria-hidden="true" /> README.md changed since it was verified.
          Verify the documentation again.
        </p>
      ) : null}

      {delivery.projectChangedSinceFinalCheck ? (
        <p className="cq-cafe-delivery-notice">
          <AlertTriangle size={14} aria-hidden="true" /> Project files changed since the last final
          check. Run the final project check again.
        </p>
      ) : null}

      {delivery.status === "ready-for-delivery" ? (
        <p className="cq-cafe-delivery-ready">
          <Award size={15} aria-hidden="true" /> Ready for Delivery · coding tasks 4/4 ·
          documentation complete · final tests passed.
        </p>
      ) : null}
    </section>
  );
}

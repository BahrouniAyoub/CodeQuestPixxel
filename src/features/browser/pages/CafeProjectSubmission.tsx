import { useEffect, useState, type KeyboardEvent } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Mail, Send } from "lucide-react";
import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { checkCafeClientResponse } from "@/features/chapter1/cafeCoding/cafeClientReview";
import type { CafeProjectDeliveryView } from "@/features/chapter1/cafeCoding/cafeDeliveryStatus";
import { useCafeSubmission } from "@/features/chapter1/cafeCoding/cafeSubmissionStore";
import { submitCafeProject } from "@/features/chapter1/cafeCoding/cafeSubmissionVerification";
import type { CafeWorkflow } from "@/features/chapter1/cafeCoding/cafeWorkflow";
import { useCafeDoc } from "@/features/chapter1/cafeCoding/cafeDocStore";
import { validateCafeDevTask } from "@/features/chapter1/cafeCoding/cafeDevValidator";
import { CAFE_PROJECT_REQUIRED_FILES } from "@/features/chapter1/cafeSetup/cafeSetupTasks";
import { useFileSession } from "@/features/editor/fileSession";
import { getEntry } from "@/services/filesystem/filesystem";
import { getPythonRunner } from "@/services/runner/pyodideRunner";

export interface CafeProjectSubmissionProps {
  readonly projectName: string;
  readonly clientName: string;
  readonly jobId: string;
  readonly workflow: CafeWorkflow;
  readonly delivery: CafeProjectDeliveryView;
  readonly onOpenMail: () => void;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Explicit submit → review → approval flow for the accepted café job. Readiness
 * comes from the shared delivery hook; the snapshot and client review are only
 * created by the player's Confirm Submission / Check Client Response actions.
 */
export function CafeProjectSubmission({
  projectName,
  clientName,
  jobId,
  workflow,
  delivery,
  onOpenMail,
}: CafeProjectSubmissionProps) {
  const submission = useCafeSubmission((state) => state.submission);
  const hydrated = useCafeSubmission((state) => state.hydrated);
  const submissionError = useCafeSubmission((state) => state.error);
  const chapterProgress = useChapter1((state) => state.progress);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void useCafeSubmission.getState().hydrate();
    void useChapter1.getState().hydrate();
  }, []);

  const ready = !delivery.loading && delivery.status === "ready-for-delivery";
  const awaitingReview = submission?.reviewStatus === "awaiting-review";
  const approved = submission?.reviewStatus === "approved";
  const currentQuestId = getCurrentChapter1Quest(chapterProgress)?.id ?? null;
  const ch1_06Complete = chapterProgress.completedQuestIds.includes("CH1-06");
  const questRetryAvailable = approved && !ch1_06Complete && currentQuestId === "CH1-06";

  const cancelConfirmation = () => {
    if (submitting) return;
    setConfirmOpen(false);
    setActionError(null);
  };

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") cancelConfirmation();
  };

  const handleConfirmSubmission = async () => {
    if (submitting) return;
    setSubmitting(true);
    setActionError(null);

    try {
      const result = await submitCafeProject(
        {
          workflow,
          developmentComplete: delivery.codingTasksComplete,
          setupComplete: delivery.setupComplete,
          docProgress: useCafeDoc.getState().progress,
          finalCheckPassed: delivery.finalCheckPassed,
          openFilePath: useFileSession.getState().filePath,
          openFileDirty: useFileSession.getState().dirty,
        },
        {
          readEntry: getEntry,
          validateProject: (files) => validateCafeDevTask(getPythonRunner(), "CAFE-DEV-04", files),
        },
      );

      if (!result.ok || result.record === null) {
        setActionError(result.reason);
        return;
      }

      const stored = await useCafeSubmission.getState().submit(result.record);
      if (!stored.ok) {
        setActionError(stored.reason);
        return;
      }

      await delivery.refresh();
      setConfirmOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckResponse = async () => {
    if (checking) return;
    setChecking(true);
    setActionError(null);
    try {
      const result = await checkCafeClientResponse();
      if (!result.ok) setActionError(result.reason);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="cq-gb-submission" aria-labelledby="cq-gb-submission-title">
      <div className="cq-gb-submission-head">
        <div>
          <span>Client delivery</span>
          <h3 id="cq-gb-submission-title">Submit Your Project</h3>
        </div>
        <strong
          className={`cq-gb-submission-status${approved ? " cq-gb-submission-status-approved" : ""}${
            awaitingReview ? " cq-gb-submission-status-awaiting" : ""
          }`}
          data-testid="cafe-submission-status"
        >
          {!hydrated
            ? "Loading…"
            : approved
              ? "Approved"
              : awaitingReview
                ? "Awaiting Review"
                : "Ready for Delivery"}
        </strong>
      </div>

      {submission ? (
        <>
          <dl className="cq-gb-submission-meta">
            <div>
              <dt>Submission ID</dt>
              <dd>{submission.submissionId}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{formatTimestamp(submission.submittedAt)}</dd>
            </div>
            <div>
              <dt>Project fingerprint</dt>
              <dd>{submission.projectFingerprint}</dd>
            </div>
          </dl>

          {awaitingReview ? (
            <>
              <p className="cq-gb-submission-copy">
                Your saved files are with {clientName}. No real-world waiting is needed — check for
                the client response when you are ready.
              </p>
              <button
                type="button"
                className="cq-gb-submission-action"
                onClick={() => void handleCheckResponse()}
                disabled={checking}
                data-testid="cafe-check-client-response"
              >
                {checking ? (
                  <>
                    <Loader2 size={14} className="cq-gb-spin" aria-hidden="true" /> Checking
                    response…
                  </>
                ) : (
                  <>
                    <Mail size={14} aria-hidden="true" /> Check Client Response
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <p className="cq-gb-submission-approved" role="status">
                <CheckCircle2 size={15} aria-hidden="true" />
                {clientName} approved your submitted café calculator. CH1-06 is complete and CH1-07
                is now available. No payment is granted in this step.
              </p>
              <button
                type="button"
                className="cq-gb-submission-action"
                onClick={onOpenMail}
                data-testid="cafe-open-mail"
              >
                <Mail size={14} aria-hidden="true" /> Open Mail
              </button>
            </>
          )}

          {questRetryAvailable ? (
            <div className="cq-gb-submission-retry" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>Chapter 1 could not be updated after approval. Your submission is safe.</span>
              <button
                type="button"
                onClick={() => void handleCheckResponse()}
                disabled={checking}
                data-testid="cafe-retry-quest"
              >
                {checking ? "Retrying…" : "Retry Chapter 1 update"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="cq-gb-submission-copy">
            Send the four saved project files to {clientName} for review. Submission is explicit and
            does not move money or change your wallet.
          </p>
          <button
            type="button"
            className="cq-gb-submission-action"
            onClick={() => {
              setActionError(null);
              setConfirmOpen(true);
            }}
            disabled={!ready || submitting}
            data-testid="cafe-submit-project"
          >
            <Send size={14} aria-hidden="true" /> Submit Project
          </button>
          <p className="cq-gb-submission-hint">
            {ready
              ? `Coding ${delivery.codingCompletedCount}/${delivery.codingTotal}, documentation verified, and final checks passed.`
              : "Finish the coding tasks, README verification, and final checks in Tickets first."}
          </p>
        </>
      )}

      {submissionError && !submission ? (
        <p className="cq-gb-app-warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {submissionError}
        </p>
      ) : null}
      {actionError ? (
        <p className="cq-gb-app-warning" role="alert" data-testid="cafe-submission-error">
          <AlertTriangle size={14} aria-hidden="true" /> {actionError}
        </p>
      ) : null}
      {!hydrated ? (
        <p className="cq-gb-submission-hint">
          <Clock3 size={12} aria-hidden="true" /> Restoring your saved submission…
        </p>
      ) : null}

      {confirmOpen && !submission ? (
        <div className="cq-gb-modal-backdrop">
          <div
            className="cq-gb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cq-gb-submit-title"
            onKeyDown={onDialogKeyDown}
          >
            <div className="cq-gb-modal-form">
              <header className="cq-gb-modal-head">
                <div>
                  <span className="cq-gb-chip">Confirm submission</span>
                  <h2 id="cq-gb-submit-title">Submit {projectName}</h2>
                </div>
                <button
                  type="button"
                  className="cq-gb-modal-close"
                  aria-label="Close submission confirmation"
                  onClick={cancelConfirmation}
                  disabled={submitting}
                >
                  ×
                </button>
              </header>

              <dl className="cq-gb-submit-summary">
                <div>
                  <dt>Project</dt>
                  <dd>{projectName}</dd>
                </div>
                <div>
                  <dt>Client</dt>
                  <dd>{clientName}</dd>
                </div>
                <div>
                  <dt>Job ID</dt>
                  <dd>{jobId}</dd>
                </div>
              </dl>

              <div className="cq-gb-submit-section">
                <strong>Required project files</strong>
                <ul aria-label="Required project files">
                  {CAFE_PROJECT_REQUIRED_FILES.map((name) => (
                    <li key={name}>
                      <CheckCircle2 size={13} aria-hidden="true" /> {name}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="cq-gb-submit-section">
                <strong>Verification status</strong>
                <ul aria-label="Verification status">
                  <li>
                    Coding tasks: {delivery.codingCompletedCount}/{delivery.codingTotal}
                  </li>
                  <li>README: {delivery.documentationVerified ? "Verified" : "Not verified"}</li>
                  <li>Final checks: {delivery.finalCheckPassed ? "Passed" : "Not passed"}</li>
                </ul>
                <p>
                  These four saved files will be sent to {clientName} for review. Your working files
                  stay editable and the submitted snapshot never changes. No payment is made and
                  nothing is deducted from your wallet.
                </p>
              </div>

              {actionError ? (
                <p className="cq-gb-form-error" role="alert">
                  <AlertTriangle size={14} aria-hidden="true" /> {actionError}
                </p>
              ) : null}

              <div className="cq-gb-modal-actions">
                <button
                  type="button"
                  className="cq-gb-cancel"
                  onClick={cancelConfirmation}
                  disabled={submitting}
                  data-testid="cafe-submit-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmSubmission()}
                  disabled={submitting}
                  data-testid="cafe-submit-confirm"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="cq-gb-spin" aria-hidden="true" /> Sending…
                    </>
                  ) : (
                    "Confirm Submission"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

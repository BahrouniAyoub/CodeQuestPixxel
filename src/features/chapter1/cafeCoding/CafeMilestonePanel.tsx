import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderOpen, Loader2, Play, RefreshCw } from "lucide-react";
import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { useFileSession } from "@/features/editor/fileSession";
import { getPythonRunner } from "@/services/runner/pyodideRunner";
import { writeFile } from "@/services/filesystem/filesystem";
import { CAFE_MILESTONES, type CafeMilestoneId } from "./cafeMilestones";
import {
  cafeMilestoneProgressCount,
  cafeMilestoneProgressPercent,
  getCurrentCafeMilestone,
  isCafeMilestoneComplete,
} from "./cafeMilestoneProgress";
import { useCafeMilestones } from "./cafeMilestoneStore";
import {
  validateCafeMilestone,
  type CafeMilestoneValidationResult,
} from "./cafeMilestoneValidator";
import { evaluateCafeCodingAccess, syncCafeProjectQuestFromStores } from "./cafeQuestSync";
import { isCafeMilestoneFilePath, openCafeMilestoneInEditor } from "./cafeProjectFiles";
import "./cafeCoding.css";

interface CafeMilestonePanelProps {
  readonly code: string;
  readonly filePath: string | null;
  readonly fileReady: boolean;
}

export function CafeMilestonePanel({ code, filePath, fileReady }: CafeMilestonePanelProps) {
  const progress = useCafeMilestones((state) => state.progress);
  const milestoneHydrated = useCafeMilestones((state) => state.hydrated);
  const milestoneError = useCafeMilestones((state) => state.error);
  const questSyncError = useCafeMilestones((state) => state.questSyncError);

  const chapterProgress = useChapter1((state) => state.progress);
  const chapterHydrated = useChapter1((state) => state.hydrated);
  const application = useGigboardApplication((state) => state.application);
  const applicationHydrated = useGigboardApplication((state) => state.hydrated);

  const [running, setRunning] = useState(false);
  const [retryingQuest, setRetryingQuest] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [validation, setValidation] = useState<CafeMilestoneValidationResult | null>(null);

  const validationToken = useRef(0);
  const mounted = useRef(true);

  const accepted = application?.status === "accepted";
  const currentMilestone = getCurrentCafeMilestone(progress);
  const completedCount = cafeMilestoneProgressCount(progress);
  const percent = cafeMilestoneProgressPercent(progress);
  const currentQuestId = getCurrentChapter1Quest(chapterProgress)?.id ?? null;

  const access = evaluateCafeCodingAccess({
    chapterHydrated,
    milestoneHydrated,
    applicationStatus: application?.status ?? null,
    currentQuestId,
  });

  const currentFileMatches = currentMilestone
    ? isCafeMilestoneFilePath(filePath, currentMilestone.id)
    : false;

  const canRunTests =
    Boolean(currentMilestone) && access.allowed && currentFileMatches && fileReady && !running;

  useEffect(() => {
    // Loading persisted records is safe during setup. No quest is completed
    // here; all writes remain tied to explicit user actions.
    void useCafeMilestones.getState().hydrate();
    void useChapter1.getState().hydrate();
    void useGigboardApplication.getState().hydrate();
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      validationToken.current += 1;
    };
  }, []);

  // Any edit or file switch makes an in-flight result stale.
  useEffect(() => {
    validationToken.current += 1;
    setValidation(null);
    setActionError(null);
    setRunning(false);
  }, [code, filePath]);

  const runTests = async () => {
    if (!currentMilestone || !canRunTests) return;

    const milestone = currentMilestone;
    const codeSnapshot = code;
    const token = ++validationToken.current;

    setRunning(true);
    setValidation(null);
    setActionError(null);
    useCafeMilestones.getState().clearQuestSyncError();

    let result: CafeMilestoneValidationResult;
    try {
      result = await validateCafeMilestone(getPythonRunner(), milestone.id, codeSnapshot);
    } catch (error) {
      if (!mounted.current || token !== validationToken.current) return;
      setActionError(error instanceof Error ? error.message : String(error));
      setRunning(false);
      return;
    }

    if (!mounted.current || token !== validationToken.current) return;
    setValidation(result);

    if (result.status !== "passed") {
      setRunning(false);
      return;
    }

    // Persist the exact code that passed before recording progress. A failed
    // file write must not produce a milestone the student cannot recover.
    if (!filePath || !isCafeMilestoneFilePath(filePath, milestone.id)) {
      setActionError("Open the current milestone file before saving your work.");
      setRunning(false);
      return;
    }

    try {
      await writeFile(filePath, codeSnapshot);
      useFileSession.getState().setDirty(false);
    } catch (error) {
      if (!mounted.current || token !== validationToken.current) return;
      setActionError(
        `The tests passed, but your code could not be saved: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      setRunning(false);
      return;
    }

    const completion = await useCafeMilestones.getState().completeMilestone(milestone.id);
    if (!mounted.current || token !== validationToken.current) return;

    if (!completion.ok) {
      setActionError(completion.reason);
      setRunning(false);
      return;
    }

    const after = useCafeMilestones.getState().progress;
    if (getCurrentCafeMilestone(after) === null) {
      const sync = await syncCafeProjectQuestFromStores();
      if (!mounted.current || token !== validationToken.current) return;
      if (!sync.ok) {
        useCafeMilestones
          .getState()
          .setQuestSyncError(
            sync.reason ??
              "Your milestones are saved, but Chapter 1 could not be updated. Retry the Chapter 1 update — do not run the tests again.",
          );
      } else {
        useCafeMilestones.getState().clearQuestSyncError();
      }
    } else {
      const next = getCurrentCafeMilestone(after);
      if (next) {
        const opened = await openCafeMilestoneInEditor(next.id);
        if (!mounted.current || token !== validationToken.current) return;
        if (!opened.ok) setActionError(opened.reason);
      }
    }

    setRunning(false);
  };

  const retryQuestSync = async () => {
    if (retryingQuest) return;
    setRetryingQuest(true);
    const result = await syncCafeProjectQuestFromStores();
    if (!mounted.current) return;
    if (result.ok) {
      useCafeMilestones.getState().clearQuestSyncError();
    } else {
      useCafeMilestones
        .getState()
        .setQuestSyncError(
          result.reason ??
            "Chapter 1 still could not be updated. Your milestones remain saved; retry the update.",
        );
    }
    setRetryingQuest(false);
  };

  const openMilestoneFile = async (milestoneId: CafeMilestoneId) => {
    setActionError(null);
    const result = await openCafeMilestoneInEditor(milestoneId);
    if (!mounted.current) return;
    if (!result.ok) setActionError(result.reason);
  };

  // The café panel is only visible to a hired player.
  if (!applicationHydrated || !accepted) return null;

  const lockReason = !currentMilestone
    ? "All three milestones are verified."
    : !currentFileMatches
      ? `Open ${currentMilestone.displayFileName} to run this milestone's tests.`
      : access.reason;

  return (
    <section className="cq-cafe-panel" aria-label="Café coding project">
      <header className="cq-cafe-head">
        <div>
          <span className="cq-cafe-eyebrow">CLIENT PROJECT · ALEX MORGAN</span>
          <h3>Build a Café Order Calculator</h3>
        </div>
        <span className="cq-cafe-progress-label">
          {completedCount}/{CAFE_MILESTONES.length} · {percent}%
        </span>
      </header>

      <div
        className="cq-cafe-progress-bar"
        role="progressbar"
        aria-label="Café milestone progress"
        aria-valuemin={0}
        aria-valuemax={CAFE_MILESTONES.length}
        aria-valuenow={completedCount}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      <ol className="cq-cafe-milestones" aria-label="Café milestones">
        {CAFE_MILESTONES.map((milestone) => {
          const completed = isCafeMilestoneComplete(progress, milestone.id);
          const current = currentMilestone?.id === milestone.id;
          return (
            <li
              key={milestone.id}
              className={
                completed
                  ? "cq-cafe-milestone-complete"
                  : current
                    ? "cq-cafe-milestone-current"
                    : ""
              }
            >
              <span className="cq-cafe-milestone-mark" aria-hidden="true">
                {completed ? <CheckCircle2 size={15} /> : current ? "●" : "○"}
              </span>
              <div>
                <strong>
                  {milestone.index + 1}. {milestone.title}
                </strong>
                <small>{completed ? "Completed" : current ? "Current milestone" : "Locked"}</small>
              </div>
            </li>
          );
        })}
      </ol>

      {milestoneError ? (
        <p className="cq-cafe-warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {milestoneError}
        </p>
      ) : null}

      {currentMilestone ? (
        <div className="cq-cafe-task">
          <h4>
            Milestone {currentMilestone.index + 1}: {currentMilestone.title}
          </h4>
          <p>{currentMilestone.description}</p>
          <ul>
            {currentMilestone.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
          <pre>{currentMilestone.example}</pre>

          <div className="cq-cafe-actions">
            <button
              type="button"
              className="cq-action-primary"
              disabled={!canRunTests}
              onClick={() => void runTests()}
            >
              {running ? (
                <>
                  <Loader2 size={14} className="cq-cafe-spin" aria-hidden="true" /> Running tests…
                </>
              ) : (
                <>
                  <Play size={14} aria-hidden="true" /> Run Tests
                </>
              )}
            </button>

            {!currentFileMatches ? (
              <button type="button" onClick={() => void openMilestoneFile(currentMilestone.id)}>
                <FolderOpen size={14} aria-hidden="true" /> Open {currentMilestone.displayFileName}
              </button>
            ) : null}

            <span className="cq-cafe-hint">{lockReason}</span>
          </div>
        </div>
      ) : (
        <p className="cq-cafe-ready">All three milestones are verified.</p>
      )}

      {actionError ? (
        <p className="cq-cafe-warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {actionError}
        </p>
      ) : null}

      {validation ? (
        <div
          className={
            validation.status === "passed"
              ? "cq-cafe-results cq-cafe-results-pass"
              : "cq-cafe-results cq-cafe-results-fail"
          }
          aria-live="polite"
        >
          <strong>{validation.message}</strong>
          <small>
            {validation.testsPassed}/{validation.testsExecuted} tests passed ·{" "}
            {validation.testsTotal} total
          </small>
          <ul>
            {validation.outcomes.map((outcome, index) => (
              <li key={`${outcome.name}-${index}`}>
                <span>{outcome.passed ? "✓" : "✕"}</span>
                <div>
                  <strong>{outcome.name}</strong>
                  <small>{outcome.message}</small>
                  {outcome.expected !== undefined ? (
                    <small>
                      Expected: {outcome.expected} · Actual: {outcome.actual}
                    </small>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {completedCount === CAFE_MILESTONES.length ? (
        <p className="cq-cafe-delivery-ready">Project ready for delivery.</p>
      ) : null}

      {questSyncError ? (
        <div className="cq-cafe-warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{questSyncError}</span>
          <button type="button" onClick={() => void retryQuestSync()} disabled={retryingQuest}>
            {retryingQuest ? (
              <>
                <Loader2 size={13} className="cq-cafe-spin" aria-hidden="true" /> Retrying…
              </>
            ) : (
              <>
                <RefreshCw size={13} aria-hidden="true" /> Retry Chapter 1 update
              </>
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}

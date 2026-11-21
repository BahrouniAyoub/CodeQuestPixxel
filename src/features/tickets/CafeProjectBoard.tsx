import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Code2,
  FolderOpen,
  Lightbulb,
  Loader2,
  LockKeyhole,
  Play,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import {
  CAFE_MILESTONES,
  type CafeMilestoneId,
} from "@/features/chapter1/cafeCoding/cafeMilestones";
import {
  getCurrentCafeMilestone,
  isCafeMilestoneComplete,
} from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import {
  validateCafeMilestone,
  type CafeMilestoneValidationResult,
} from "@/features/chapter1/cafeCoding/cafeMilestoneValidator";
import {
  evaluateCafeCodingAccess,
  syncCafeProjectQuestFromStores,
} from "@/features/chapter1/cafeCoding/cafeQuestSync";
import {
  isCafeMilestoneFilePath,
  openCafeMilestoneInEditor,
} from "@/features/chapter1/cafeCoding/cafeProjectFiles";
import {
  evaluateCafeTaskActions,
  getCafeTaskStatus,
  getCafeTaskViews,
  type CafeTaskStatus,
} from "@/features/chapter1/cafeCoding/cafeTaskStatus";
import { verifyCafeTaskFromSavedFile } from "@/features/chapter1/cafeCoding/cafeTaskVerification";
import {
  detectLegacyCafeProject,
  evaluateCafeSetupRequirement,
} from "@/features/chapter1/cafeSetup/cafeSetupCompatibility";
import {
  getCurrentCafeSetupTask,
  isCafeSetupComplete,
} from "@/features/chapter1/cafeSetup/cafeSetupProgress";
import { useCafeSetup } from "@/features/chapter1/cafeSetup/cafeSetupStore";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { useFileSession } from "@/features/editor/fileSession";
import { getEntry } from "@/services/filesystem/filesystem";
import { getPythonRunner } from "@/services/runner/pyodideRunner";
import "./cafe-project-board.css";

interface CafeProjectBoardProps {
  readonly selectedTaskId: CafeMilestoneId;
  readonly onSelectTask: (id: CafeMilestoneId) => void;
}

interface Feedback {
  readonly kind: "success" | "error" | "info";
  readonly message: string;
}

const QUEST_SYNC_RETRY_MESSAGE =
  "Your milestones are saved, but Chapter 1 could not be updated. Retry the Chapter 1 update — do not run the milestone tests again.";

const STATUS_LABEL: Record<CafeTaskStatus, string> = {
  locked: "Locked",
  available: "Available",
  "in-progress": "In Progress",
  completed: "Completed",
};

function StatusIcon({ status }: { status: CafeTaskStatus }) {
  if (status === "completed") return <Check size={11} aria-hidden="true" />;
  if (status === "locked") return <LockKeyhole size={11} aria-hidden="true" />;
  return <CircleDot size={11} aria-hidden="true" />;
}

/**
 * Café calculator project inside the Tickets app.
 *
 * Instructions and verification live here; the editor only hosts the code.
 * Verification reads the saved canonical milestone file from the filesystem.
 */
export function CafeProjectBoard({ selectedTaskId, onSelectTask }: CafeProjectBoardProps) {
  const progress = useCafeMilestones((state) => state.progress);
  const milestoneHydrated = useCafeMilestones((state) => state.hydrated);
  const milestoneError = useCafeMilestones((state) => state.error);
  const questSyncError = useCafeMilestones((state) => state.questSyncError);

  const chapterProgress = useChapter1((state) => state.progress);
  const chapterHydrated = useChapter1((state) => state.hydrated);
  const application = useGigboardApplication((state) => state.application);
  const applicationHydrated = useGigboardApplication((state) => state.hydrated);
  const setupProgress = useCafeSetup((state) => state.progress);
  const setupHydrated = useCafeSetup((state) => state.hydrated);

  const openFilePath = useFileSession((state) => state.filePath);
  const openFileDirty = useFileSession((state) => state.dirty);

  const [existingFileIds, setExistingFileIds] = useState<ReadonlySet<CafeMilestoneId>>(
    () => new Set(),
  );
  const [legacyProject, setLegacyProject] = useState<boolean | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<CafeMilestoneId | null>(null);
  const [retryingQuest, setRetryingQuest] = useState(false);
  const [validation, setValidation] = useState<CafeMilestoneValidationResult | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintsShown, setHintsShown] = useState<Partial<Record<CafeMilestoneId, number>>>({});

  const validationToken = useRef(0);
  const mounted = useRef(true);
  const autoSyncAttempted = useRef(false);

  const refreshExistingFiles = useCallback(async () => {
    const found = new Set<CafeMilestoneId>();
    await Promise.all(
      CAFE_MILESTONES.map(async (milestone) => {
        try {
          const entry = await getEntry(milestone.filePath);
          if (entry?.kind === "file") found.add(milestone.id);
        } catch {
          // A filesystem read failure leaves the task listed as not started.
        }
      }),
    );
    if (mounted.current) setExistingFileIds(found);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      validationToken.current += 1;
    };
  }, []);

  useEffect(() => {
    // Loading persisted records is safe. Completion stays tied to user actions.
    void useCafeMilestones.getState().hydrate();
    void useChapter1.getState().hydrate();
    void useGigboardApplication.getState().hydrate();
    void useCafeSetup.getState().hydrate();
    void refreshExistingFiles();
  }, [refreshExistingFiles]);

  useEffect(() => {
    let alive = true;
    void detectLegacyCafeProject()
      .then((value) => {
        if (alive) setLegacyProject(value);
      })
      .catch(() => {
        if (alive) setLegacyProject(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // A new verification supersedes any result from the previous task.
  useEffect(() => {
    validationToken.current += 1;
    setValidation(null);
    setFeedback(null);
  }, [selectedTaskId]);

  const applicationAccepted = application?.status === "accepted";
  const setupComplete = isCafeSetupComplete(setupProgress);
  const setupRequirement = evaluateCafeSetupRequirement({
    setupHydrated,
    setupComplete,
    milestoneIndex: progress.currentMilestoneIndex,
    legacyMilestoneFileExists: legacyProject === true,
  });
  const setupTask = getCurrentCafeSetupTask(setupProgress);

  // Setup creates the project files outside this board. Re-scan once setup is
  // complete so a returning player sees the current task without reopening it.
  useEffect(() => {
    if (setupComplete) void refreshExistingFiles();
  }, [setupComplete, refreshExistingFiles]);

  const currentQuestId = getCurrentChapter1Quest(chapterProgress)?.id ?? null;
  const access = evaluateCafeCodingAccess({
    chapterHydrated,
    milestoneHydrated,
    applicationStatus: application?.status ?? null,
    currentQuestId,
  });

  const completedCount = progress.completedMilestones.length;
  const percent = Math.round((completedCount / CAFE_MILESTONES.length) * 100);
  const allComplete = progress.currentMilestoneIndex === CAFE_MILESTONES.length;
  const taskViews = getCafeTaskViews({ progress, existingFileIds });
  const selected = taskViews.find((task) => task.milestone.id === selectedTaskId) ?? taskViews[0];

  // Recovery for a 3/3 save that could not sync CH1-05 during verification.
  useEffect(() => {
    if (autoSyncAttempted.current || questSyncError) return;
    if (!milestoneHydrated || !chapterHydrated || !applicationHydrated) return;
    if (
      allComplete &&
      applicationAccepted &&
      currentQuestId === "CH1-05" &&
      !chapterProgress.completedQuestIds.includes("CH1-05")
    ) {
      autoSyncAttempted.current = true;
      void syncCafeProjectQuestFromStores().then((result) => {
        if (!mounted.current) return;
        if (result.ok) {
          useCafeMilestones.getState().clearQuestSyncError();
        } else {
          useCafeMilestones.getState().setQuestSyncError(result.reason ?? QUEST_SYNC_RETRY_MESSAGE);
        }
      });
    }
  }, [
    allComplete,
    applicationAccepted,
    applicationHydrated,
    chapterHydrated,
    chapterProgress.completedQuestIds,
    currentQuestId,
    milestoneHydrated,
    questSyncError,
  ]);

  if (!selected) return null;

  const milestone = selected.milestone;
  const taskStatus = getCafeTaskStatus(milestone, { progress, existingFileIds });
  const actions = evaluateCafeTaskActions({
    milestone,
    status: taskStatus,
    applicationAccepted,
    access,
    setupRequired: setupRequirement.required,
    setupTaskTitle: setupTask?.title ?? null,
    running: runningTaskId === milestone.id,
    fileOpen: isCafeMilestoneFilePath(openFilePath, milestone.id),
    fileDirty: openFileDirty,
    fileExists: existingFileIds.has(milestone.id),
  });

  const visibleHints = hintsShown[milestone.id] ?? 0;

  const openTask = async () => {
    if (!actions.open.allowed) return;
    setFeedback(null);
    try {
      const result = await openCafeMilestoneInEditor(milestone.id);
      if (!mounted.current) return;
      if (result.ok) {
        await refreshExistingFiles();
        if (!mounted.current) return;
        setFeedback({
          kind: "info",
          message: `Opened ${milestone.displayFileName} in the editor. Save your changes, then verify the task here.`,
        });
      } else {
        setFeedback({ kind: "error", message: result.reason });
      }
    } catch (error) {
      if (!mounted.current) return;
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const verifyTask = async () => {
    if (!actions.verify.allowed || runningTaskId) return;

    const token = ++validationToken.current;
    setRunningTaskId(milestone.id);
    setValidation(null);
    setFeedback(null);
    useCafeMilestones.getState().clearQuestSyncError();

    try {
      const result = await verifyCafeTaskFromSavedFile(
        {
          milestone,
          currentMilestoneId:
            getCurrentCafeMilestone(useCafeMilestones.getState().progress)?.id ?? null,
          openFilePath: useFileSession.getState().filePath,
          openFileDirty: useFileSession.getState().dirty,
        },
        {
          readEntry: getEntry,
          validate: (milestoneId, code) =>
            validateCafeMilestone(getPythonRunner(), milestoneId, code),
          completeMilestone: (milestoneId) =>
            useCafeMilestones.getState().completeMilestone(milestoneId),
          getCurrentMilestoneId: () =>
            getCurrentCafeMilestone(useCafeMilestones.getState().progress)?.id ?? null,
          syncQuest: syncCafeProjectQuestFromStores,
        },
      );

      if (!mounted.current || token !== validationToken.current) return;

      if (!result.ok) {
        if ("validation" in result) setValidation(result.validation);
        setFeedback({ kind: "error", message: result.reason });
        if (result.kind === "file-missing") await refreshExistingFiles();
        return;
      }

      setValidation(result.validation);
      await refreshExistingFiles();
      if (!mounted.current || token !== validationToken.current) return;

      if (result.questSync && !result.questSync.ok) {
        useCafeMilestones
          .getState()
          .setQuestSyncError(result.questSync.reason ?? QUEST_SYNC_RETRY_MESSAGE);
      }

      setFeedback({
        kind: "success",
        message: result.allComplete
          ? "All three café tasks are verified. Chapter 1 is ready for delivery."
          : `Task ${milestone.index + 1} verified. Task ${milestone.index + 2} is now available.`,
      });
    } catch (error) {
      if (!mounted.current || token !== validationToken.current) return;
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (mounted.current && token === validationToken.current) {
        setRunningTaskId(null);
      }
    }
  };

  const retryQuestSync = async () => {
    if (retryingQuest) return;
    setRetryingQuest(true);
    const result = await syncCafeProjectQuestFromStores();
    if (!mounted.current) return;
    if (result.ok) {
      useCafeMilestones.getState().clearQuestSyncError();
    } else {
      useCafeMilestones.getState().setQuestSyncError(result.reason ?? QUEST_SYNC_RETRY_MESSAGE);
    }
    setRetryingQuest(false);
  };

  const revealHint = () => {
    setHintsShown((current) => ({
      ...current,
      [milestone.id]: Math.min((current[milestone.id] ?? 0) + 1, milestone.hints.length),
    }));
  };

  return (
    <div className="cq-cafe-board" aria-label="Café calculator project">
      <div className="cq-cafe-board-strip">
        <div>
          <span className="cq-jira-eyebrow">CLIENT PROJECT · ALEX MORGAN</span>
          <h2>Build a Café Order Calculator</h2>
          <p>Three development tasks · Python · same workspace as the editor</p>
        </div>
        <div className="cq-cafe-board-progress">
          <strong>
            {completedCount}/{CAFE_MILESTONES.length} · {percent}%
          </strong>
          <div
            className="cq-cafe-board-progress-bar"
            role="progressbar"
            aria-label="Café task progress"
            aria-valuemin={0}
            aria-valuemax={CAFE_MILESTONES.length}
            aria-valuenow={completedCount}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {!applicationAccepted ? (
        <p className="cq-cafe-board-notice" role="status">
          <LockKeyhole size={14} aria-hidden="true" /> The café project unlocks after Alex Morgan
          accepts your proposal.
        </p>
      ) : null}

      {applicationAccepted && setupRequirement.required ? (
        <p className="cq-cafe-board-notice" role="status">
          <LockKeyhole size={14} aria-hidden="true" /> Project setup required
          {setupTask ? `: ${setupTask.title}` : ""}. Open GigBoard to continue the brief, folder,
          files, and plan before verifying café tasks.
        </p>
      ) : null}

      {applicationAccepted && setupRequirement.legacy && !setupComplete ? (
        <p className="cq-cafe-board-notice cq-cafe-board-notice-legacy" role="status">
          <CheckCircle2 size={14} aria-hidden="true" /> Existing café project detected. Setup is not
          required for this save; your milestone progress is unchanged.
        </p>
      ) : null}

      {milestoneError ? (
        <p className="cq-cafe-board-warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {milestoneError}
        </p>
      ) : null}

      <div className="cq-cafe-board-workspace">
        <aside className="cq-cafe-tasklist" aria-label="Café development tasks">
          {taskViews.map((task) => (
            <button
              key={task.milestone.id}
              type="button"
              className={`cq-cafe-task ${task.milestone.id === milestone.id ? "selected" : ""}`}
              onClick={() => onSelectTask(task.milestone.id)}
              aria-current={task.milestone.id === milestone.id ? "true" : undefined}
            >
              <div className="cq-cafe-task-line">
                <span className="cq-cafe-task-id">CAFÉ-{task.milestone.index + 1}</span>
                <span className={`cq-cafe-status cq-cafe-status-${task.status}`}>
                  <StatusIcon status={task.status} /> {STATUS_LABEL[task.status]}
                </span>
              </div>
              <strong>{task.milestone.title}</strong>
              <small>{task.milestone.displayFileName}</small>
            </button>
          ))}
        </aside>

        <main className="cq-cafe-taskdetail">
          <div className="cq-jira-breadcrumb">
            CodeQuest <ChevronRight size={13} aria-hidden="true" /> Café Calculator{" "}
            <ChevronRight size={13} aria-hidden="true" /> <b>CAFÉ-{milestone.index + 1}</b>
          </div>

          <div className="cq-cafe-task-header">
            <div>
              <div className="cq-jira-eyebrow">
                CAFÉ-{milestone.index + 1} <span>·</span> {milestone.displayFileName}
              </div>
              <h2>{milestone.title}</h2>
            </div>
            <span className={`cq-cafe-status cq-cafe-status-${taskStatus}`}>
              <StatusIcon status={taskStatus} /> {STATUS_LABEL[taskStatus]}
            </span>
          </div>

          <p className="cq-cafe-description">{milestone.description}</p>

          <section className="cq-cafe-section">
            <h3>INSTRUCTIONS</h3>
            <ol className="cq-cafe-instructions">
              {milestone.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          </section>

          <section className="cq-cafe-section">
            <h3>EXPECTED BEHAVIOR</h3>
            <p>{milestone.expectedBehavior}</p>
          </section>

          <section className="cq-cafe-section">
            <h3>EXAMPLE</h3>
            <pre className="cq-cafe-example">{milestone.example}</pre>
          </section>

          <section className="cq-cafe-section">
            <h3>ACCEPTANCE CRITERIA</h3>
            <ul className="cq-cafe-acceptance">
              {milestone.tests.map((test) => (
                <li key={test.name}>
                  <CheckCircle2 size={14} aria-hidden="true" /> {test.name}
                </li>
              ))}
            </ul>
          </section>

          <section className="cq-cafe-section cq-cafe-hints">
            <h3>
              <Lightbulb size={16} aria-hidden="true" /> DEVELOPER HINTS
            </h3>
            {milestone.hints.slice(0, visibleHints).map((hint, index) => (
              <p key={hint}>
                <b>Hint {index + 1}:</b> {hint}
              </p>
            ))}
            {visibleHints < milestone.hints.length ? (
              <button type="button" onClick={revealHint}>
                <Lightbulb size={14} aria-hidden="true" /> Reveal hint {visibleHints + 1} of{" "}
                {milestone.hints.length}
              </button>
            ) : (
              <p className="cq-cafe-all-hints">All hints revealed. No XP penalty.</p>
            )}
          </section>

          <div className="cq-cafe-actions">
            <button
              type="button"
              className="cq-cafe-open"
              onClick={() => void openTask()}
              disabled={!actions.open.allowed || runningTaskId !== null}
            >
              <Code2 size={16} aria-hidden="true" />
              {taskStatus === "completed" ? "Practice in Editor" : "Open in Editor"}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cq-cafe-verify"
              onClick={() => void verifyTask()}
              disabled={!actions.verify.allowed || runningTaskId !== null}
            >
              {runningTaskId === milestone.id ? (
                <>
                  <Loader2 size={15} className="cq-cafe-spin" aria-hidden="true" /> Verifying…
                </>
              ) : (
                <>
                  <Play size={15} aria-hidden="true" /> Verify Task
                </>
              )}
            </button>
          </div>

          {applicationAccepted && !setupRequirement.required ? (
            <p className="cq-cafe-action-hint">
              {actions.verify.allowed
                ? `Verification reads the saved ${milestone.displayFileName} file.`
                : actions.verify.reason}
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

          {allComplete ? (
            <p className="cq-cafe-delivery-ready">
              <Trophy size={15} aria-hidden="true" /> All three tasks verified. Project ready for
              delivery.
            </p>
          ) : null}

          {completedCount > 0 && !allComplete ? (
            <p className="cq-cafe-task-score">
              <Check size={13} aria-hidden="true" /> {completedCount}/{CAFE_MILESTONES.length} tasks
              complete ·{" "}
              {isCafeMilestoneComplete(progress, milestone.id)
                ? "Select the next available task to continue."
                : `${milestone.displayFileName} is the current task.`}
            </p>
          ) : null}

          {questSyncError ? (
            <div className="cq-cafe-board-warning" role="alert">
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

          {!actions.open.allowed &&
          actions.open.reason &&
          actions.open.reason !== actions.verify.reason ? (
            <p className="cq-cafe-action-hint">
              <FolderOpen size={13} aria-hidden="true" /> {actions.open.reason}
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
}

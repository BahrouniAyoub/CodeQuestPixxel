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
} from "lucide-react";
import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import {
  CAFE_DEV_TASK_COUNT,
  CAFE_DEV_FILE_NAMES,
  cafeDevFilePath,
  type CafeDevFileName,
  type CafeDevTaskId,
} from "@/features/chapter1/cafeCoding/cafeDevTasks";
import {
  cafeDevProgressCount,
  cafeDevProgressPercent,
  getCurrentCafeDevTask,
  isCafeDevTaskComplete,
} from "@/features/chapter1/cafeCoding/cafeDevProgress";
import { useCafeDev } from "@/features/chapter1/cafeCoding/cafeDevStore";
import { openCafeDevTaskInEditor } from "@/features/chapter1/cafeCoding/cafeDevFiles";
import {
  cafeDevTaskStatusLabel,
  evaluateCafeDevTaskActions,
  getCafeDevTaskViews,
  type CafeDevTaskStatus,
} from "@/features/chapter1/cafeCoding/cafeDevTaskStatus";
import { verifyCafeDevTaskFromSavedFiles } from "@/features/chapter1/cafeCoding/cafeDevTaskVerification";
import {
  validateCafeDevTask,
  type CafeDevValidationResult,
} from "@/features/chapter1/cafeCoding/cafeDevValidator";
import {
  evaluateCafeCodingAccess,
  syncCafeDevelopmentQuestFromStores,
} from "@/features/chapter1/cafeCoding/cafeQuestSync";
import { evaluateCafeSetupRequirement } from "@/features/chapter1/cafeSetup/cafeSetupCompatibility";
import {
  getCurrentCafeSetupTask,
  isCafeSetupComplete,
} from "@/features/chapter1/cafeSetup/cafeSetupProgress";
import { useCafeSetup } from "@/features/chapter1/cafeSetup/cafeSetupStore";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { useFileSession } from "@/features/editor/fileSession";
import { getEntry } from "@/services/filesystem/filesystem";
import { getPythonRunner } from "@/services/runner/pyodideRunner";
import { CafeDeliveryPreparation } from "./CafeDeliveryPreparation";
import "./cafe-project-board.css";

interface CafeDevelopmentBoardProps {
  readonly selectedTaskId: CafeDevTaskId;
  readonly onSelectTask: (id: CafeDevTaskId) => void;
}

interface Feedback {
  readonly kind: "success" | "error" | "info";
  readonly message: string;
}

const QUEST_SYNC_RETRY_MESSAGE =
  "Your development tasks are saved, but Chapter 1 could not be updated. Retry the Chapter 1 update — do not run the task tests again.";

function StatusIcon({ status }: { status: CafeDevTaskStatus }) {
  if (status === "completed") return <Check size={11} aria-hidden="true" />;
  if (status === "locked") return <LockKeyhole size={11} aria-hidden="true" />;
  return <CircleDot size={11} aria-hidden="true" />;
}

/**
 * The four-task café calculator project inside Tickets.
 *
 * Instructions and verification live here; the editor only hosts the code.
 * Every check reads the saved calculator.py/main.py files, and verification is
 * blocked while either required file has unsaved editor changes.
 */
export function CafeDevelopmentBoard({ selectedTaskId, onSelectTask }: CafeDevelopmentBoardProps) {
  const progress = useCafeDev((state) => state.progress);
  const developmentHydrated = useCafeDev((state) => state.hydrated);
  const developmentError = useCafeDev((state) => state.error);
  const hasSavedRecord = useCafeDev((state) => state.hasSavedRecord);
  const questSyncError = useCafeDev((state) => state.questSyncError);

  const chapterProgress = useChapter1((state) => state.progress);
  const chapterHydrated = useChapter1((state) => state.hydrated);
  const application = useGigboardApplication((state) => state.application);
  const applicationHydrated = useGigboardApplication((state) => state.hydrated);
  const setupProgress = useCafeSetup((state) => state.progress);

  const openFilePath = useFileSession((state) => state.filePath);
  const openFileDirty = useFileSession((state) => state.dirty);

  const [existingFileNames, setExistingFileNames] = useState<ReadonlySet<CafeDevFileName>>(
    () => new Set(),
  );
  const [nonEmptyFileNames, setNonEmptyFileNames] = useState<ReadonlySet<CafeDevFileName>>(
    () => new Set(),
  );
  const [runningTaskId, setRunningTaskId] = useState<CafeDevTaskId | null>(null);
  const [retryingQuest, setRetryingQuest] = useState(false);
  const [validation, setValidation] = useState<CafeDevValidationResult | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintsShown, setHintsShown] = useState<Partial<Record<CafeDevTaskId, number>>>({});

  const validationToken = useRef(0);
  const mounted = useRef(true);
  const autoSyncAttempted = useRef(false);

  const refreshExistingFiles = useCallback(async () => {
    const existing = new Set<CafeDevFileName>();
    const nonEmpty = new Set<CafeDevFileName>();
    await Promise.all(
      CAFE_DEV_FILE_NAMES.map(async (fileName) => {
        try {
          const entry = await getEntry(cafeDevFilePath(fileName));
          if (entry?.kind !== "file") return;
          existing.add(fileName);
          if ((entry.content ?? "").trim().length > 0) nonEmpty.add(fileName);
        } catch {
          // A filesystem read failure leaves the task listed as not started.
        }
      }),
    );
    if (!mounted.current) return;
    setExistingFileNames(existing);
    setNonEmptyFileNames(nonEmpty);
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
    void useCafeDev.getState().hydrate();
    void useChapter1.getState().hydrate();
    void useGigboardApplication.getState().hydrate();
    void useCafeSetup.getState().hydrate();
    void refreshExistingFiles();
  }, [refreshExistingFiles]);

  // A new verification supersedes any result from the previous task.
  useEffect(() => {
    validationToken.current += 1;
    setValidation(null);
    setFeedback(null);
  }, [selectedTaskId]);

  const applicationAccepted = application?.status === "accepted";
  const setupComplete = isCafeSetupComplete(setupProgress);
  const setupRequirement = evaluateCafeSetupRequirement({
    setupHydrated: true,
    // A saved development record already proves the project was set up, even if
    // an older setup record is missing.
    setupComplete: setupComplete || hasSavedRecord,
    milestoneIndex: 0,
    legacyMilestoneFileExists: false,
  });
  const setupTask = getCurrentCafeSetupTask(setupProgress);
  const currentQuestId = getCurrentChapter1Quest(chapterProgress)?.id ?? null;
  const access = evaluateCafeCodingAccess({
    chapterHydrated,
    milestoneHydrated: developmentHydrated,
    applicationStatus: application?.status ?? null,
    currentQuestId,
  });

  const completedCount = cafeDevProgressCount(progress);
  const percent = cafeDevProgressPercent(progress);
  const allComplete = progress.currentTaskIndex === CAFE_DEV_TASK_COUNT;
  const taskViews = getCafeDevTaskViews({
    progress,
    existingFileNames,
    nonEmptyFileNames,
  });
  const selected = taskViews.find((task) => task.task.id === selectedTaskId) ?? taskViews[0];

  // Recovery for a 4/4 save that could not sync CH1-05 during verification.
  useEffect(() => {
    if (autoSyncAttempted.current || questSyncError) return;
    if (!developmentHydrated || !chapterHydrated || !applicationHydrated) return;
    if (
      allComplete &&
      applicationAccepted &&
      currentQuestId === "CH1-05" &&
      !chapterProgress.completedQuestIds.includes("CH1-05")
    ) {
      autoSyncAttempted.current = true;
      void syncCafeDevelopmentQuestFromStores().then((result) => {
        if (!mounted.current) return;
        if (result.ok) {
          useCafeDev.getState().clearQuestSyncError();
        } else {
          useCafeDev.getState().setQuestSyncError(result.reason ?? QUEST_SYNC_RETRY_MESSAGE);
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
    developmentHydrated,
    questSyncError,
  ]);

  if (!selected) return null;

  const task = selected.task;
  const taskStatus = selected.status;
  const actions = evaluateCafeDevTaskActions({
    task,
    status: taskStatus,
    applicationAccepted,
    access,
    setupRequired: setupRequirement.required,
    setupTaskTitle: setupTask?.title ?? null,
    running: runningTaskId === task.id,
    openFilePath,
    openFileDirty,
    existingFileNames,
  });

  const visibleHints = hintsShown[task.id] ?? 0;

  const openTask = async () => {
    if (!actions.open.allowed) return;
    setFeedback(null);
    try {
      const result = await openCafeDevTaskInEditor(task.id);
      if (!mounted.current) return;
      if (result.ok) {
        await refreshExistingFiles();
        if (!mounted.current) return;
        setFeedback({
          kind: "info",
          message: `Opened ${task.primaryFile} in the editor. Save your changes, then verify the task here.`,
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
    setRunningTaskId(task.id);
    setValidation(null);
    setFeedback(null);
    useCafeDev.getState().clearQuestSyncError();

    try {
      const result = await verifyCafeDevTaskFromSavedFiles(
        {
          task,
          currentTaskId: getCurrentCafeDevTask(useCafeDev.getState().progress)?.id ?? null,
          openFilePath: useFileSession.getState().filePath,
          openFileDirty: useFileSession.getState().dirty,
        },
        {
          readEntry: getEntry,
          validate: (taskId, files) => validateCafeDevTask(getPythonRunner(), taskId, files),
          completeTask: (taskId) => useCafeDev.getState().completeTask(taskId),
          getCurrentTaskId: () => getCurrentCafeDevTask(useCafeDev.getState().progress)?.id ?? null,
          syncQuest: syncCafeDevelopmentQuestFromStores,
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
        useCafeDev
          .getState()
          .setQuestSyncError(result.questSync.reason ?? QUEST_SYNC_RETRY_MESSAGE);
      }

      setFeedback({
        kind: "success",
        message: result.allComplete
          ? "All four café development tasks are verified. Complete the Project Delivery Preparation section next."
          : `Task ${task.index + 1} verified. Task ${task.index + 2} is now available.`,
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
    const result = await syncCafeDevelopmentQuestFromStores();
    if (!mounted.current) return;
    if (result.ok) {
      useCafeDev.getState().clearQuestSyncError();
    } else {
      useCafeDev.getState().setQuestSyncError(result.reason ?? QUEST_SYNC_RETRY_MESSAGE);
    }
    setRetryingQuest(false);
  };

  const revealHint = () => {
    setHintsShown((current) => ({
      ...current,
      [task.id]: Math.min((current[task.id] ?? 0) + 1, task.hints.length),
    }));
  };

  return (
    <div className="cq-cafe-board" aria-label="Café calculator development project">
      <div className="cq-cafe-board-strip">
        <div>
          <span className="cq-jira-eyebrow">CLIENT PROJECT · ALEX MORGAN</span>
          <h2>Build a Café Order Calculator</h2>
          <p>Four development tasks · Multi-file Python project · same workspace as the editor</p>
        </div>
        <div className="cq-cafe-board-progress">
          <strong>
            {completedCount}/{CAFE_DEV_TASK_COUNT} · {percent}%
          </strong>
          <div
            className="cq-cafe-board-progress-bar"
            role="progressbar"
            aria-label="Café development task progress"
            aria-valuemin={0}
            aria-valuemax={CAFE_DEV_TASK_COUNT}
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

      {developmentError ? (
        <p className="cq-cafe-board-warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {developmentError}
        </p>
      ) : null}

      <div className="cq-cafe-board-workspace">
        <aside className="cq-cafe-tasklist" aria-label="Café development tasks">
          {taskViews.map((view) => (
            <button
              key={view.task.id}
              type="button"
              className={`cq-cafe-task ${view.task.id === task.id ? "selected" : ""}`}
              onClick={() => onSelectTask(view.task.id)}
              aria-current={view.task.id === task.id ? "true" : undefined}
            >
              <div className="cq-cafe-task-line">
                <span className="cq-cafe-task-id">{view.task.id}</span>
                <span className={`cq-cafe-status cq-cafe-status-${view.status}`}>
                  <StatusIcon status={view.status} /> {cafeDevTaskStatusLabel(view.status)}
                </span>
              </div>
              <strong>{view.task.title}</strong>
              <small>{view.task.primaryFile}</small>
            </button>
          ))}
        </aside>

        <main className="cq-cafe-taskdetail">
          <div className="cq-jira-breadcrumb">
            CodeQuest <ChevronRight size={13} aria-hidden="true" /> Café Calculator{" "}
            <ChevronRight size={13} aria-hidden="true" /> <b>{task.id}</b>
          </div>

          <div className="cq-cafe-task-header">
            <div>
              <div className="cq-jira-eyebrow">
                {task.id} <span>·</span> {task.primaryFile}
              </div>
              <h2>{task.title}</h2>
            </div>
            <span className={`cq-cafe-status cq-cafe-status-${taskStatus}`}>
              <StatusIcon status={taskStatus} /> {cafeDevTaskStatusLabel(taskStatus)}
            </span>
          </div>

          <p className="cq-cafe-description">{task.description}</p>

          <section className="cq-cafe-section">
            <h3>INSTRUCTIONS</h3>
            <ol className="cq-cafe-instructions">
              {task.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          </section>

          <section className="cq-cafe-section">
            <h3>EXPECTED BEHAVIOR</h3>
            <p>{task.expectedBehavior}</p>
          </section>

          <section className="cq-cafe-section">
            <h3>EXAMPLE</h3>
            <pre className="cq-cafe-example">{task.example}</pre>
          </section>

          <section className="cq-cafe-section">
            <h3>ACCEPTANCE CRITERIA</h3>
            <ul className="cq-cafe-acceptance">
              {task.tests.map((test) => (
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
            {task.hints.slice(0, visibleHints).map((hint, index) => (
              <p key={hint}>
                <b>Hint {index + 1}:</b> {hint}
              </p>
            ))}
            {visibleHints < task.hints.length ? (
              <button type="button" onClick={revealHint}>
                <Lightbulb size={14} aria-hidden="true" /> Reveal hint {visibleHints + 1} of{" "}
                {task.hints.length}
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
              {runningTaskId === task.id ? (
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
                ? `Verification reads the saved ${task.files.join(" and ")} ${
                    task.files.length === 1 ? "file" : "files"
                  }.`
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

          {completedCount > 0 && !allComplete ? (
            <p className="cq-cafe-task-score">
              <Check size={13} aria-hidden="true" /> {completedCount}/{CAFE_DEV_TASK_COUNT} tasks
              complete ·{" "}
              {isCafeDevTaskComplete(progress, task.id)
                ? "Select the next available task to continue."
                : `${task.primaryFile} is the current task.`}
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

          <CafeDeliveryPreparation
            developmentComplete={allComplete}
            applicationAccepted={applicationAccepted}
            setupRequired={setupRequirement.required}
          />
        </main>
      </div>
    </div>
  );
}

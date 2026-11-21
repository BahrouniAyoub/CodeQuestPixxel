import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { useCafeMilestones } from "../cafeCoding/cafeMilestoneStore";
import { checkCafeSetupTask, openCafeProjectWorkspace, openCafeSetupApp } from "./cafeSetupActions";
import {
  CAFE_CLIENT_BRIEF_INTRO,
  CAFE_CLIENT_BRIEF_REQUIREMENTS,
  CAFE_CLIENT_BRIEF_SIGN_OFF,
} from "./cafeClientBrief";
import { detectLegacyCafeProject } from "./cafeSetupCompatibility";
import {
  cafeSetupProgressCount,
  getCurrentCafeSetupTask,
  isCafeSetupComplete,
} from "./cafeSetupProgress";
import { useCafeSetup } from "./cafeSetupStore";
import { CAFE_SETUP_PLAN_TOPICS, CAFE_SETUP_TASK_COUNT } from "./cafeSetupTasks";
import "./cafeSetup.css";

interface CafeProjectGuidancePanelProps {
  /** `compact` trims instructional detail for Progress/Tickets. */
  readonly variant?: "full" | "compact";
}

interface Feedback {
  readonly ok: boolean;
  readonly message: string;
}

const EMPTY_CHECKLIST: readonly boolean[] = CAFE_SETUP_PLAN_TOPICS.map(() => false);

/**
 * Contextual guidance for the café setup phase. It only verifies files that
 * already exist; it never creates folders or files for the player.
 */
export function CafeProjectGuidancePanel({ variant = "full" }: CafeProjectGuidancePanelProps) {
  const setupProgress = useCafeSetup((state) => state.progress);
  const setupHydrated = useCafeSetup((state) => state.hydrated);
  const setupError = useCafeSetup((state) => state.error);
  const application = useGigboardApplication((state) => state.application);

  const [legacy, setLegacy] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [planTopics, setPlanTopics] = useState<readonly boolean[]>(EMPTY_CHECKLIST);

  useEffect(() => {
    // Loading persisted records is safe. Completion stays tied to user actions.
    void useCafeSetup.getState().hydrate();
    void useCafeMilestones.getState().hydrate();
    void useChapter1.getState().hydrate();
    void useGigboardApplication.getState().hydrate();
  }, []);

  useEffect(() => {
    let alive = true;
    void detectLegacyCafeProject()
      .then((value) => {
        if (alive) setLegacy(value);
      })
      .catch(() => {
        if (alive) setLegacy(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const accepted = application?.status === "accepted";
  const setupComplete = isCafeSetupComplete(setupProgress);
  const currentTask = getCurrentCafeSetupTask(setupProgress);
  const completedCount = cafeSetupProgressCount(setupProgress);
  const planConfirmed = useMemo(() => planTopics.every(Boolean), [planTopics]);

  if (!accepted) return null;

  if (!setupHydrated) {
    return (
      <section className="cq-cafe-setup cq-cafe-setup-loading" aria-label="Café project setup">
        <Loader2 size={15} className="cq-cafe-spin" aria-hidden="true" />
        <span>{setupError ?? "Loading your café project setup…"}</span>
      </section>
    );
  }

  // Existing development saves continue the milestone workflow unchanged.
  if (!setupComplete && legacy) return null;

  if (setupComplete) {
    return (
      <section className="cq-cafe-setup" aria-label="Café project setup">
        <div className="cq-cafe-setup-head">
          <div>
            <span className="cq-cafe-setup-eyebrow">CAFÉ PROJECT · SETUP</span>
            <h3>Project setup complete</h3>
          </div>
          <strong className="cq-cafe-setup-count">
            {completedCount}/{CAFE_SETUP_TASK_COUNT}
          </strong>
        </div>
        <p className="cq-cafe-setup-ready">
          <CheckCircle2 size={14} aria-hidden="true" /> The four café development tasks are
          unlocked.
        </p>
        <button
          type="button"
          onClick={() => {
            setBusy(true);
            setFeedback(null);
            void openCafeProjectWorkspace().then((result) => {
              setBusy(false);
              setFeedback({ ok: result.ok, message: result.message });
            });
          }}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 size={14} className="cq-cafe-spin" aria-hidden="true" /> Opening…
            </>
          ) : (
            <>
              <FolderOpen size={14} aria-hidden="true" /> Open Project in Editor
            </>
          )}
        </button>
        {feedback ? <FeedbackLine feedback={feedback} /> : null}
      </section>
    );
  }

  if (!currentTask) return null;

  const runAction = async (action: () => Promise<{ ok: boolean; message: string }>) => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await action();
      setFeedback({ ok: result.ok, message: result.message });
    } catch (error) {
      setFeedback({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenApp = () => {
    if (currentTask.id === "read-brief") {
      setBriefOpen((open) => !open);
      return;
    }
    void runAction(() => openCafeSetupApp(currentTask.id));
  };

  const handleCheck = () => {
    if (currentTask.id === "read-brief") {
      void runAction(async () => {
        const completion = await useCafeSetup.getState().completeTask("read-brief");
        return completion.ok
          ? { ok: true, message: "Brief reviewed. Next: Create Project Folder." }
          : { ok: false, message: completion.reason };
      });
      return;
    }
    void runAction(() =>
      checkCafeSetupTask(currentTask.id, { planTopicsConfirmed: planConfirmed }),
    );
  };

  const toggleTopic = (index: number) => {
    setPlanTopics((current) =>
      current.map((value, position) => (position === index ? !value : value)),
    );
  };

  return (
    <section
      className={`cq-cafe-setup ${variant === "compact" ? "cq-cafe-setup-compact" : ""}`}
      aria-label="Café project setup"
    >
      <div className="cq-cafe-setup-head">
        <div>
          <span className="cq-cafe-setup-eyebrow">CAFÉ PROJECT · SETUP</span>
          <h3>
            <ClipboardList size={15} aria-hidden="true" /> {currentTask.title}
          </h3>
        </div>
        <strong className="cq-cafe-setup-count">
          {completedCount}/{CAFE_SETUP_TASK_COUNT}
        </strong>
      </div>

      <div
        className="cq-cafe-setup-bar"
        role="progressbar"
        aria-label="Café setup progress"
        aria-valuemin={0}
        aria-valuemax={CAFE_SETUP_TASK_COUNT}
        aria-valuenow={completedCount}
      >
        <span style={{ width: `${(completedCount / CAFE_SETUP_TASK_COUNT) * 100}%` }} />
      </div>

      <p className="cq-cafe-setup-objective">{currentTask.objective}</p>

      {variant === "full" ? (
        <ul className="cq-cafe-setup-instructions">
          {currentTask.instructions.map((instruction) => (
            <li key={instruction}>
              <ChevronRight size={12} aria-hidden="true" /> {instruction}
            </li>
          ))}
        </ul>
      ) : null}

      {currentTask.id === "read-brief" && briefOpen ? (
        <div className="cq-cafe-setup-brief" aria-label="Client brief">
          <p>{CAFE_CLIENT_BRIEF_INTRO}</p>
          <ul>
            {CAFE_CLIENT_BRIEF_REQUIREMENTS.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
          <small>{CAFE_CLIENT_BRIEF_SIGN_OFF}</small>
        </div>
      ) : null}

      {currentTask.id === "write-plan" ? (
        <fieldset className="cq-cafe-setup-checklist">
          <legend>Confirm your PLAN.md covers all six topics</legend>
          {CAFE_SETUP_PLAN_TOPICS.map((topic, index) => (
            <label key={topic}>
              <input
                type="checkbox"
                checked={planTopics[index] ?? false}
                onChange={() => toggleTopic(index)}
              />
              {topic}
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="cq-cafe-setup-actions">
        <button type="button" onClick={handleOpenApp} disabled={busy}>
          {currentTask.id === "read-brief" ? (
            <>{briefOpen ? "Hide Requirements" : "Read Requirements"}</>
          ) : (
            <>
              <FolderOpen size={14} aria-hidden="true" /> {currentTask.openLabel}
            </>
          )}
        </button>
        <button type="button" className="cq-action-primary" onClick={handleCheck} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={14} className="cq-cafe-spin" aria-hidden="true" /> Checking…
            </>
          ) : currentTask.id === "read-brief" ? (
            "Mark Brief Reviewed"
          ) : (
            "Check Task"
          )}
        </button>
      </div>

      <p className="cq-cafe-setup-hint">{currentTask.hint}</p>

      {feedback ? <FeedbackLine feedback={feedback} /> : null}
    </section>
  );
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return (
    <p
      className={
        feedback.ok ? "cq-cafe-setup-feedback" : "cq-cafe-setup-feedback cq-cafe-setup-error"
      }
      role={feedback.ok ? "status" : "alert"}
    >
      {feedback.ok ? (
        <CheckCircle2 size={13} aria-hidden="true" />
      ) : (
        <AlertTriangle size={13} aria-hidden="true" />
      )}{" "}
      {feedback.message}
    </p>
  );
}

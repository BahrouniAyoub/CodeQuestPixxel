import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { CAFE_MILESTONES } from "@/features/chapter1/cafeCoding/cafeMilestones";
import {
  cafeMilestoneProgressCount,
  cafeMilestoneProgressPercent,
  getCurrentCafeMilestone,
  isCafeMilestoneComplete,
} from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import { openCafeProjectInEditor } from "@/features/chapter1/cafeCoding/cafeProjectFiles";
import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { useGigboardApplication } from "../gigboardApplicationStore";
import { GIGBOARD_JOBS_ADDRESS } from "../browserRoutes";
import type { GigboardJob } from "../data/gigboardJobs";
import {
  GIGBOARD_PROPOSAL_MAX_LENGTH,
  GIGBOARD_PROPOSAL_MIN_LENGTH,
  validateProposal,
} from "../data/gigboardApplication";
import { GigBoardHeader } from "./GigBoardPage";

interface GigBoardJobDetailsProps {
  job: GigboardJob;
  onNavigate: (address: string) => void;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function lockedMessage(
  chapterHydrated: boolean,
  chapterError: string | null,
  applicationHydrated: boolean,
  applicationError: string | null,
  currentQuestId: string | null,
): string {
  if (!chapterHydrated || !applicationHydrated) {
    if (chapterError && !chapterHydrated) {
      return "Chapter 1 progress could not be loaded. Reload the page before applying.";
    }
    if (applicationError && !applicationHydrated) {
      return "Your saved GigBoard application could not be loaded. Reload the page before applying.";
    }
    return "Checking your Chapter 1 progress…";
  }

  if (currentQuestId === "CH1-03") {
    return "This looks like your first real opportunity. Open this listing from GigBoard to confirm your discovery, then the proposal form unlocks.";
  }
  if (currentQuestId === "CH1-01" || currentQuestId === "CH1-02") {
    return "You need to finish the morning at home and get to your computer before you can take on paid client work.";
  }
  if (currentQuestId === null) {
    return "Chapter 1 is complete, so this application is closed.";
  }
  return "Finish the current Chapter 1 quest before applying to the café calculator project.";
}

export function GigBoardJobDetails({ job, onNavigate }: GigBoardJobDetailsProps) {
  const progress = useChapter1((state) => state.progress);
  const chapterHydrated = useChapter1((state) => state.hydrated);
  const chapterError = useChapter1((state) => state.error);
  const application = useGigboardApplication((state) => state.application);
  const applicationHydrated = useGigboardApplication((state) => state.hydrated);
  const applicationError = useGigboardApplication((state) => state.error);
  const milestoneProgress = useCafeMilestones((state) => state.progress);
  const milestoneHydrated = useCafeMilestones((state) => state.hydrated);

  const [formOpen, setFormOpen] = useState(false);
  const [proposal, setProposal] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingResponse, setCheckingResponse] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [questWarning, setQuestWarning] = useState<string | null>(null);
  const [retryingQuest, setRetryingQuest] = useState(false);
  const [openingProject, setOpeningProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    if (!job.chapter1Project) return;
    // Loading persisted records is safe during render setup; quest completion
    // remains tied to explicit user actions only.
    void useChapter1.getState().hydrate();
    void useGigboardApplication.getState().hydrate();
    void useCafeMilestones.getState().hydrate();
  }, [job.chapter1Project]);

  const currentQuest = getCurrentChapter1Quest(progress);
  const currentQuestId = currentQuest?.id ?? null;
  const isCafeProject = job.chapter1Project;
  const accepted = application?.status === "accepted";
  const completedMilestoneCount = cafeMilestoneProgressCount(milestoneProgress);
  const milestonePercent = cafeMilestoneProgressPercent(milestoneProgress);
  const currentMilestone = getCurrentCafeMilestone(milestoneProgress);
  const projectReadyForDelivery = completedMilestoneCount === CAFE_MILESTONES.length;
  const canApply =
    isCafeProject &&
    !application &&
    chapterHydrated &&
    applicationHydrated &&
    currentQuestId === "CH1-04";

  const openForm = () => {
    setProposal("");
    setFormError(null);
    setActionError(null);
    setFormOpen(true);
  };

  const cancelForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setProposal("");
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const activeQuest = getCurrentChapter1Quest(useChapter1.getState().progress);
    if (activeQuest?.id !== "CH1-04") {
      setFormError(
        "This application is locked until Chapter 1 reaches “The First Client”. Finish the current quest first.",
      );
      return;
    }

    const validation = validateProposal(proposal);
    if (!validation.ok) {
      setFormError(validation.reason);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setActionError(null);

    const result = await useGigboardApplication.getState().submitApplication(proposal);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.reason);
      return;
    }

    setFormOpen(false);
    setProposal("");

    const questCompleted = await useChapter1.getState().completeQuest("CH1-04");
    const stillPending = getCurrentChapter1Quest(useChapter1.getState().progress)?.id === "CH1-04";
    if (!questCompleted && stillPending) {
      setQuestWarning(
        "Your application is saved, but Chapter 1 could not be updated. Retry the quest step below — do not submit the application again.",
      );
    }
  };

  const handleCheckResponse = async () => {
    if (checkingResponse) return;
    setCheckingResponse(true);
    setActionError(null);
    const result = await useGigboardApplication.getState().acceptApplication();
    setCheckingResponse(false);
    if (!result.ok) setActionError(result.reason);
  };

  const handleRetryQuest = async () => {
    if (retryingQuest) return;
    setRetryingQuest(true);
    setQuestWarning(null);
    const completed = await useChapter1.getState().completeQuest("CH1-04");
    const stillPending = getCurrentChapter1Quest(useChapter1.getState().progress)?.id === "CH1-04";
    if (!completed && stillPending) {
      setQuestWarning(
        "Chapter 1 still could not be updated. Your application remains saved; try the retry again.",
      );
    }
    setRetryingQuest(false);
  };

  const handleOpenProject = async () => {
    if (openingProject) return;
    setOpeningProject(true);
    setProjectError(null);
    const result = await openCafeProjectInEditor();
    setOpeningProject(false);
    if (!result.ok) setProjectError(result.reason);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") cancelForm();
  };

  const locked = lockedMessage(
    chapterHydrated,
    chapterError,
    applicationHydrated,
    applicationError,
    currentQuestId,
  );

  return (
    <div className="cq-gb">
      <GigBoardHeader onNavigate={onNavigate} active="jobs" />
      <main className="cq-gb-detail">
        <button
          type="button"
          className="cq-gb-back"
          onClick={() => onNavigate(GIGBOARD_JOBS_ADDRESS)}
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to job listings
        </button>

        <div className="cq-gb-detail-grid">
          <article className="cq-gb-detail-main">
            <div className="cq-gb-job-top">
              <span className="cq-gb-chip">{job.category}</span>
              <span className={`cq-gb-level cq-gb-level-${job.difficulty.toLowerCase()}`}>
                {job.difficulty}
              </span>
            </div>
            <h1>{job.title}</h1>
            <p className="cq-gb-detail-client">
              <Users size={14} aria-hidden="true" /> {job.client}
              <span>·</span>
              <Clock3 size={14} aria-hidden="true" /> {job.posted}
              <span>·</span>
              <MapPin size={14} aria-hidden="true" /> Remote
            </p>

            <section>
              <h2>Project description</h2>
              <p>{job.description}</p>
            </section>

            <section>
              <h2>Required skills</h2>
              <ul className="cq-gb-skills cq-gb-skills-large" aria-label="Required skills">
                {job.skills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2>Deliverables</h2>
              <ul className="cq-gb-deliverables">
                {job.deliverables.map((deliverable) => (
                  <li key={deliverable}>
                    <CheckCircle2 size={15} aria-hidden="true" /> {deliverable}
                  </li>
                ))}
              </ul>
            </section>

            {accepted ? (
              <section className="cq-gb-project-ready" aria-labelledby="cq-gb-project-ready-title">
                <div className="cq-gb-project-ready-head">
                  <span>HIRED / ACCEPTED</span>
                  <h2 id="cq-gb-project-ready-title">Project ready: {job.title}</h2>
                  <p>
                    Client: {job.client} · Budget: ${job.budget}
                  </p>
                </div>
                <p>
                  Alex Morgan has hired you. Complete the three verified Python milestones in the
                  Pixel OS editor to finish the build.
                </p>

                <div className="cq-gb-project-progress">
                  <div>
                    <span>
                      {projectReadyForDelivery
                        ? "All milestones complete"
                        : currentMilestone
                          ? `Current milestone: ${currentMilestone.index + 1}. ${currentMilestone.title}`
                          : milestoneHydrated
                            ? "Loading the next milestone…"
                            : "Loading your milestone progress…"}
                    </span>
                    <strong>
                      {completedMilestoneCount}/{CAFE_MILESTONES.length} · {milestonePercent}%
                    </strong>
                  </div>
                  <div
                    className="cq-gb-project-progress-bar"
                    role="progressbar"
                    aria-label="Café milestone progress"
                    aria-valuemin={0}
                    aria-valuemax={CAFE_MILESTONES.length}
                    aria-valuenow={completedMilestoneCount}
                  >
                    <span style={{ width: `${milestonePercent}%` }} />
                  </div>
                </div>

                <ol className="cq-gb-milestones" aria-label="Café milestones">
                  {CAFE_MILESTONES.map((milestone) => {
                    const completed = isCafeMilestoneComplete(milestoneProgress, milestone.id);
                    const current = currentMilestone?.id === milestone.id;
                    return (
                      <li
                        key={milestone.id}
                        className={
                          completed
                            ? "cq-gb-milestone-complete"
                            : current
                              ? "cq-gb-milestone-current"
                              : ""
                        }
                      >
                        <span className="cq-gb-milestone-check" aria-hidden="true">
                          {completed ? "✓" : current ? "●" : "○"}
                        </span>
                        <div>
                          <strong>{milestone.title}</strong>
                          <p>{milestone.description}</p>
                          <small>
                            {completed ? "Completed" : current ? "Current milestone" : "Locked"}
                          </small>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {projectReadyForDelivery ? (
                  <p className="cq-gb-project-delivery-ready">Project ready for delivery.</p>
                ) : null}

                {projectError ? (
                  <p className="cq-gb-app-warning" role="alert">
                    <AlertTriangle size={14} aria-hidden="true" /> {projectError}
                  </p>
                ) : null}

                <div className="cq-gb-project-actions">
                  <button
                    type="button"
                    onClick={() => void handleOpenProject()}
                    disabled={openingProject}
                  >
                    {openingProject ? (
                      <>
                        <Loader2 size={14} className="cq-gb-spin" aria-hidden="true" /> Opening
                        project…
                      </>
                    ) : (
                      <>
                        <FolderOpen size={14} aria-hidden="true" /> Open Project in Editor
                      </>
                    )}
                  </button>
                </div>

                <p className="cq-gb-project-ready-note">
                  The $50 payment is not granted in this step. Chapter 1 advances after all three
                  milestones are verified.
                </p>
              </section>
            ) : null}

            <section className="cq-gb-detail-guarantee">
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <strong>GigBoard project protection</strong>
                <p>
                  This is a fictional project preview. Payments and contracts are not active in this
                  build.
                </p>
              </div>
            </section>
          </article>

          <aside className="cq-gb-detail-side">
            <div className="cq-gb-budget-card">
              <span>Project budget</span>
              <strong>${job.budget}</strong>
              <small>{job.type}</small>
            </div>
            <dl className="cq-gb-detail-meta">
              <div>
                <dt>
                  <Wallet size={13} aria-hidden="true" /> Budget
                </dt>
                <dd>${job.budget}</dd>
              </div>
              <div>
                <dt>Difficulty</dt>
                <dd>{job.difficulty}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{job.category}</dd>
              </div>
              <div>
                <dt>Job type</dt>
                <dd>{job.type}</dd>
              </div>
            </dl>

            {isCafeProject ? (
              <section className="cq-gb-apply cq-gb-application-panel" aria-label="Application">
                {application ? (
                  <>
                    <div
                      className={`cq-gb-app-status ${accepted ? "cq-gb-app-status-accepted" : ""}`}
                      data-testid="gigboard-application-status"
                    >
                      <span>Application status</span>
                      <strong>{accepted ? "Hired / Accepted" : "Application submitted"}</strong>
                      <small>
                        {accepted
                          ? "Alex Morgan has hired you for this project."
                          : "Waiting for Alex Morgan to review your proposal."}
                      </small>
                    </div>

                    <dl className="cq-gb-app-meta">
                      <div>
                        <dt>Project</dt>
                        <dd>{job.title}</dd>
                      </div>
                      <div>
                        <dt>Client</dt>
                        <dd>{job.client}</dd>
                      </div>
                      <div>
                        <dt>Budget</dt>
                        <dd>${job.budget}</dd>
                      </div>
                      <div>
                        <dt>Submitted</dt>
                        <dd>{formatTimestamp(application.submittedAt)}</dd>
                      </div>
                    </dl>

                    <details className="cq-gb-proposal">
                      <summary>Your submitted proposal</summary>
                      <p>{application.proposal}</p>
                    </details>

                    {accepted ? (
                      <div className="cq-gb-client-response" role="status">
                        <MessageSquare size={17} aria-hidden="true" />
                        <div>
                          <strong>Alex Morgan</strong>
                          <p>{application.acceptanceMessage}</p>
                          {application.acceptedAt ? (
                            <small>Accepted {formatTimestamp(application.acceptedAt)}</small>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="cq-gb-response-pending">
                        <p>
                          Alex usually reviews new proposals quickly. Check the client response when
                          you are ready.
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleCheckResponse()}
                          disabled={checkingResponse}
                        >
                          {checkingResponse ? (
                            <>
                              <Loader2 size={14} className="cq-gb-spin" aria-hidden="true" />{" "}
                              Checking response…
                            </>
                          ) : (
                            <>
                              <MessageSquare size={14} aria-hidden="true" /> Check client response
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {applicationError ? (
                      <p className="cq-gb-app-warning" role="alert">
                        <AlertTriangle size={14} aria-hidden="true" /> {applicationError}
                      </p>
                    ) : null}

                    {actionError ? (
                      <p className="cq-gb-app-warning" role="alert">
                        <AlertTriangle size={14} aria-hidden="true" /> {actionError}
                      </p>
                    ) : null}

                    {questWarning && currentQuestId === "CH1-04" ? (
                      <div className="cq-gb-app-warning" role="alert">
                        <AlertTriangle size={14} aria-hidden="true" />
                        <span>{questWarning}</span>
                        <button
                          type="button"
                          onClick={() => void handleRetryQuest()}
                          disabled={retryingQuest}
                        >
                          {retryingQuest ? "Retrying…" : "Retry Chapter 1 update"}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="cq-gb-app-status" data-testid="gigboard-application-status">
                      <span>Application status</span>
                      <strong>Not applied</strong>
                      <small>One proposal only for this Chapter 1 project.</small>
                    </div>
                    <button type="button" onClick={openForm} disabled={!canApply}>
                      Apply for Project
                    </button>
                    <p
                      className={
                        canApply ? "cq-gb-apply-help" : "cq-gb-apply-help cq-gb-apply-locked"
                      }
                      data-testid={canApply ? undefined : "gigboard-application-locked"}
                    >
                      {canApply
                        ? "Applications are open. Tell Alex how you would build the café order calculator."
                        : locked}
                    </p>
                    {applicationError ? (
                      <p className="cq-gb-app-warning" role="alert">
                        <AlertTriangle size={14} aria-hidden="true" /> {applicationError}
                      </p>
                    ) : null}
                  </>
                )}
              </section>
            ) : (
              <div className="cq-gb-apply">
                <button type="button" disabled>
                  Apply for Project
                </button>
                <p>
                  This listing is browsing-only in this chapter. Only the Chapter 1 café project
                  accepts applications, and nothing is submitted here.
                </p>
              </div>
            )}
          </aside>
        </div>
      </main>

      {isCafeProject && formOpen ? (
        <div className="cq-gb-modal-backdrop">
          <div
            className="cq-gb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cq-gb-proposal-title"
            onKeyDown={handleDialogKeyDown}
          >
            <form onSubmit={(event) => void handleSubmit(event)}>
              <header className="cq-gb-modal-head">
                <div>
                  <span className="cq-gb-chip">Proposal</span>
                  <h2 id="cq-gb-proposal-title">Apply to {job.title}</h2>
                </div>
                <button
                  type="button"
                  className="cq-gb-modal-close"
                  aria-label="Close proposal form"
                  onClick={cancelForm}
                  disabled={submitting}
                >
                  ×
                </button>
              </header>

              <dl className="cq-gb-modal-summary">
                <div>
                  <dt>Project</dt>
                  <dd>{job.title}</dd>
                </div>
                <div>
                  <dt>Client</dt>
                  <dd>{job.client}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>${job.budget}</dd>
                </div>
              </dl>

              <label className="cq-gb-proposal-field">
                <span>Your proposal</span>
                <textarea
                  aria-label="Your proposal"
                  autoFocus
                  value={proposal}
                  onChange={(event) => {
                    setProposal(event.target.value);
                    if (formError) setFormError(null);
                  }}
                  rows={7}
                  maxLength={GIGBOARD_PROPOSAL_MAX_LENGTH}
                  placeholder="Explain how you would build the café order calculator, what you will deliver, and why you are a good fit."
                  disabled={submitting}
                />
                <small>
                  {proposal.trim().length} / {GIGBOARD_PROPOSAL_MAX_LENGTH} characters · minimum{" "}
                  {GIGBOARD_PROPOSAL_MIN_LENGTH}
                </small>
              </label>

              {formError ? (
                <p className="cq-gb-form-error" role="alert">
                  <AlertTriangle size={14} aria-hidden="true" /> {formError}
                </p>
              ) : null}

              <div className="cq-gb-modal-actions">
                <button
                  type="button"
                  className="cq-gb-cancel"
                  onClick={cancelForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="cq-gb-spin" aria-hidden="true" /> Saving
                      application…
                    </>
                  ) : (
                    "Submit proposal"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

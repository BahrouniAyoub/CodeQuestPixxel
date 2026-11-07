import { AlertTriangle, BookOpen, CheckCircle2, ChevronRight, Target, Wallet } from "lucide-react";
import { useChapter1 } from "./chapter1Store";
import { getCurrentChapter1Quest } from "./chapter1Progress";
import { CHAPTER1_PAYMENT_REWARD, CHAPTER1_QUESTS } from "./chapter1Quests";
import "./chapter1-tracker.css";

const TOTAL_QUESTS: number = CHAPTER1_QUESTS.length;

function percentageLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Read-only Chapter 1 tracker.
 *
 * Quest completion is intentionally not exposed here: the chapter advances only
 * through gameplay events that call the store directly.
 */
export function Chapter1Tracker() {
  const progress = useChapter1((state) => state.progress);
  const hydrated = useChapter1((state) => state.hydrated);
  const loading = useChapter1((state) => state.loading);
  const error = useChapter1((state) => state.error);

  const currentQuest = getCurrentChapter1Quest(progress);
  const completedCount = Math.min(progress.completedQuestIds.length, TOTAL_QUESTS);
  const percentage = TOTAL_QUESTS === 0 ? 0 : (completedCount / TOTAL_QUESTS) * 100;
  const chapterComplete = hydrated && currentQuest === null;

  return (
    <section
      className="cq-progress-section cq-chapter1-tracker"
      aria-labelledby="chapter1-tracker-title"
    >
      <div className="cq-chapter1-header">
        <div>
          <div className="cq-eyebrow">CHAPTER 1 / QUEST TRACKER</div>
          <h2 id="chapter1-tracker-title">
            <BookOpen size={19} aria-hidden="true" /> Chapter 1 — The First Paycheck
          </h2>
        </div>
        {hydrated ? (
          <span className={`cq-chapter1-state ${chapterComplete ? "complete" : ""}`}>
            {chapterComplete ? "CHAPTER COMPLETE" : "IN PROGRESS"}
          </span>
        ) : null}
      </div>

      {!hydrated ? (
        <div className="cq-chapter1-loading" role="status" data-testid="chapter1-loading">
          <Target size={18} aria-hidden="true" />
          <span>
            {loading || !error
              ? "Loading Chapter 1 progress…"
              : "Chapter 1 progress is not available."}
          </span>
        </div>
      ) : (
        <>
          {currentQuest ? (
            <div className="cq-chapter1-current">
              <div className="cq-chapter1-quest">
                <span className="cq-tag">{currentQuest.id}</span>
                <strong>{currentQuest.title}</strong>
                <span className="cq-chapter1-count">
                  {completedCount} / {TOTAL_QUESTS} COMPLETE
                </span>
              </div>
              <p className="cq-chapter1-objective">
                <ChevronRight size={16} aria-hidden="true" />
                <span>{currentQuest.objective}</span>
              </p>
            </div>
          ) : (
            <div className="cq-chapter1-current cq-chapter1-complete">
              <div className="cq-chapter1-quest">
                <CheckCircle2 size={20} aria-hidden="true" />
                <strong>Chapter complete</strong>
                <span className="cq-chapter1-count">
                  {completedCount} / {TOTAL_QUESTS} COMPLETE
                </span>
              </div>
              <p>All {TOTAL_QUESTS} quests are finished. The First Paycheck is in the books.</p>
            </div>
          )}

          <div className="cq-chapter1-progress">
            <div className="cq-progress-bar-label">
              <span>Quest progress</span>
              <span>
                {completedCount} / {TOTAL_QUESTS} · {percentageLabel(percentage)}%
              </span>
            </div>
            <div
              className="cq-progress-track"
              role="progressbar"
              aria-label="Chapter 1 quest progress"
              aria-valuemin={0}
              aria-valuemax={TOTAL_QUESTS}
              aria-valuenow={completedCount}
              aria-valuetext={`${completedCount} of ${TOTAL_QUESTS} quests complete (${percentageLabel(percentage)}%)`}
            >
              <div style={{ width: `${percentage}%` }} />
            </div>
          </div>

          <div className="cq-chapter1-earnings">
            <span>
              <Wallet size={17} aria-hidden="true" /> Chapter earnings
            </span>
            <strong>
              ${progress.money} / ${CHAPTER1_PAYMENT_REWARD}
            </strong>
          </div>
        </>
      )}

      {error ? (
        <div className="cq-chapter1-warning" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}
    </section>
  );
}

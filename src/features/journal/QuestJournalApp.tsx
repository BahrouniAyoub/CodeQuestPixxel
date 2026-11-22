import { BookOpen, CheckCircle2, MapPin, ScrollText, Target } from "lucide-react";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import {
  CHAPTER1_COMPLETE_MESSAGE,
  CHAPTER1_COMPLETE_TITLE,
  CHAPTER1_QUESTS,
  CHAPTER1_TITLE,
} from "@/features/chapter1/chapter1Quests";
import "../shared-apps.css";
import "./journal.css";

export function QuestJournalApp() {
  const progress = useChapter1((s) => s.progress);
  const hydrated = useChapter1((s) => s.hydrated);
  const loading = useChapter1((s) => s.loading);
  const error = useChapter1((s) => s.error);

  const currentQuest = getCurrentChapter1Quest(progress);
  const completedCount = progress.completedQuestIds.length;
  const total = CHAPTER1_QUESTS.length;
  const percent = Math.round((completedCount / total) * 100);

  if (loading || !hydrated) {
    return (
      <div className="cq-app cq-journal">
        <div className="cq-section-card">
          <div className="cq-eyebrow">QUEST JOURNAL</div>
          <h2><BookOpen size={20} /> Loading journal…</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="cq-app cq-journal">
      <div className="cq-journal-hero cq-section-card">
        <div className="cq-eyebrow">QUEST JOURNAL</div>
        <h1><ScrollText size={24} /> {CHAPTER1_TITLE}</h1>
        <p className="cq-journal-sub">
          {currentQuest
            ? "Track your current mission and see how far you've come."
            : "You completed Chapter 1. Great work!"}
        </p>
        <div className="cq-journal-progress-row">
          <div className="cq-journal-progress-meta">
            <span>Chapter progress</span>
            <strong>{completedCount}/{total} quests</strong>
          </div>
          <div className="cq-progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="cq-progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {error ? <div className="cq-journal-error" role="status">{error}</div> : null}
      </div>

      <div className="cq-section-card cq-journal-current">
        <div className="cq-eyebrow">CURRENT MISSION</div>
        {currentQuest ? (
          <>
            <div className="cq-journal-quest-title">
              <span className="cq-journal-quest-id">{currentQuest.id}</span>
              <h2>{currentQuest.title}</h2>
            </div>
            <p className="cq-journal-desc">{currentQuest.description}</p>
            <div className="cq-journal-detail">
              <Target size={16} />
              <div>
                <span className="cq-journal-detail-label">Current objective</span>
                <strong>{currentQuest.objective}</strong>
              </div>
            </div>
            <div className="cq-journal-detail">
              <MapPin size={16} />
              <div>
                <span className="cq-journal-detail-label">Where to go</span>
                <strong>{currentQuest.location ?? "—"}</strong>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="cq-journal-quest-title">
              <CheckCircle2 size={20} />
              <h2>{CHAPTER1_COMPLETE_TITLE}</h2>
            </div>
            <p className="cq-journal-desc">{CHAPTER1_COMPLETE_MESSAGE}</p>
          </>
        )}
      </div>

      <div className="cq-section-card">
        <div className="cq-eyebrow">COMPLETED QUESTS</div>
        <ul className="cq-journal-list" aria-label="Chapter 1 quest list">
          {CHAPTER1_QUESTS.map((quest) => {
            const done = progress.completedQuestIds.includes(quest.id);
            const active = currentQuest?.id === quest.id;
            return (
              <li key={quest.id} className={`cq-journal-item ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}>
                <div className="cq-journal-item-status" aria-hidden="true">
                  {done ? <CheckCircle2 size={15} /> : <span className="cq-journal-dot" />}
                </div>
                <div className="cq-journal-item-body">
                  <div className="cq-journal-item-head">
                    <span className="cq-journal-item-id">{quest.id}</span>
                    <strong>{quest.title}</strong>
                    {active ? <span className="cq-journal-badge">Current</span> : null}
                    {done ? <span className="cq-journal-badge done">Done</span> : null}
                  </div>
                  <span className="cq-journal-item-obj">{quest.objective}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

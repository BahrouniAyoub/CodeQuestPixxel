import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { ArrowLeft, ArrowRight, LogOut, Search, X } from "lucide-react";
import {
  APPS,
  APP_ORDER,
  START_PINNED_APPS,
  searchApps,
  type AppId,
} from "@/core/applications/registry";
import { useBrowserNavigationIntent } from "@/features/browser/browserNavigationIntent";
import { GIGBOARD_ADDRESS } from "@/features/browser/browserRoutes";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { levelForXp, totalXp } from "@/features/progress/progressLogic";
import { useProgress } from "@/features/progress/progressStore";
import { PixelIcon } from "@/shared/components/PixelIcon";
import "./StartMenu.css";

export interface StartMenuProps {
  readonly menuRef: RefObject<HTMLDivElement | null>;
  readonly startButtonRef: RefObject<HTMLButtonElement | null>;
  readonly onClose: (restoreFocus: boolean) => void;
  readonly onLaunch: (id: AppId) => void;
  readonly onReturnToGame?: (() => void) | undefined;
  readonly playerName: string;
  readonly closing?: boolean | undefined;
}

type StartView = "pinned" | "all";

const RESULTS_TITLE_ID = "cq-start-results-title";

export default function StartMenu({
  menuRef,
  startButtonRef,
  onClose,
  onLaunch,
  onReturnToGame,
  playerName,
  closing = false,
}: StartMenuProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<StartView>("pinned");
  const searchRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const progress = useProgress();
  const chapterProgress = useChapter1((state) => state.progress);
  const chapterHydrated = useChapter1((state) => state.hydrated);

  const pinnedApps = useMemo(() => START_PINNED_APPS.map((id) => APPS[id]), []);
  const allApps = useMemo(() => APP_ORDER.map((id) => APPS[id]), []);
  const normalizedQuery = query.trim();
  const results = useMemo(() => {
    if (normalizedQuery) return searchApps(normalizedQuery);
    return view === "all" ? allApps : pinnedApps;
  }, [allApps, normalizedQuery, pinnedApps, view]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (closing) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose(true);
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target) || startButtonRef.current?.contains(target)) return;
      onClose(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closing, menuRef, onClose, startButtonRef]);

  const level = levelForXp(totalXp(progress.completions)).level;
  const completedCount = chapterHydrated ? chapterProgress.completedQuestIds.length : null;
  const displayName = playerName.trim() || "Player";
  const caption = normalizedQuery
    ? "Search results"
    : view === "all"
      ? "All applications"
      : "Pinned applications";

  const launchApp = (id: AppId) => {
    onLaunch(id);
  };

  const openGigBoard = () => {
    useBrowserNavigationIntent.getState().requestNavigation(GIGBOARD_ADDRESS);
    launchApp("browser");
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    // Enter is a launch shortcut; arrow keys and text editing remain native.
    if (event.key !== "Enter" || results.length === 0) return;
    event.preventDefault();
    const first = results[0];
    if (first) launchApp(first.id);
  };

  const focusResult = (index: number) => {
    if (results.length === 0) return;
    const target = (index + results.length) % results.length;
    resultRefs.current[target]?.focus();
  };

  const handleResultsKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = resultRefs.current.findIndex((node) => node === document.activeElement);
    if (current < 0) return;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusResult(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusResult(current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusResult(0);
        break;
      case "End":
        event.preventDefault();
        focusResult(results.length - 1);
        break;
      default:
        break;
    }
  };

  const showRecommendations = !normalizedQuery && view === "pinned";
  const resultIdPrefix = !normalizedQuery && view === "all" ? "start-all-app" : "start-pinned-app";

  return (
    <section
      ref={menuRef}
      id="cq-start-menu"
      className="cq-start-menu"
      role="dialog"
      aria-label="Start menu"
      data-tutorial-id="start-menu"
      data-state={closing ? "closing" : "open"}
      aria-describedby="cq-start-help"
    >
      <span id="cq-start-help" className="cq-sr-only">
        Search or tab to an application. Press Escape to close the Start menu.
      </span>

      <header className="cq-start-header">
        <div className="cq-start-brand">
          <span className="cq-start-brand-symbol" aria-hidden="true">
            ▦
          </span>
          <div>
            <strong>CodeQuest</strong>
            <small>PIXEL OS</small>
          </div>
        </div>
        <button
          type="button"
          className="cq-start-close"
          aria-label="Close Start menu"
          data-tutorial-id="start-close-button"
          onClick={() => onClose(true)}
        >
          <X size={17} />
        </button>
      </header>

      <label className="cq-start-search">
        <Search size={17} aria-hidden="true" />
        <span className="cq-sr-only">Search applications</span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder="Search applications..."
          autoComplete="off"
          aria-controls="cq-start-results"
          data-tutorial-id="start-search"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </label>

      <div className="cq-start-content">
        <div className="cq-start-section-heading">
          <h2 id={RESULTS_TITLE_ID}>{caption}</h2>
          {!normalizedQuery && view === "pinned" ? (
            <button
              type="button"
              className="cq-start-view-button"
              data-tutorial-id="start-all-apps-button"
              onClick={() => {
                setView("all");
                setQuery("");
              }}
            >
              All apps <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : null}
          {!normalizedQuery && view === "all" ? (
            <button
              type="button"
              className="cq-start-view-button"
              data-tutorial-id="start-back-button"
              onClick={() => {
                setView("pinned");
                setQuery("");
              }}
            >
              <ArrowLeft size={15} aria-hidden="true" /> Pinned
            </button>
          ) : null}
        </div>

        <div
          id="cq-start-results"
          className={`cq-start-results ${view === "all" && !normalizedQuery ? "cq-start-results-list" : ""}`}
          role="group"
          aria-labelledby={RESULTS_TITLE_ID}
          onKeyDown={handleResultsKeyDown}
        >
          {results.map((app, index) => (
            <button
              key={app.id}
              ref={(node) => {
                resultRefs.current[index] = node;
              }}
              type="button"
              className="cq-start-result"
              aria-label={`${app.title} — ${app.description}`}
              title={app.description}
              data-tutorial-id={`${resultIdPrefix}-${app.id}`}
              onClick={() => launchApp(app.id)}
            >
              <PixelIcon name={app.icon} size={34} />
              <span>{app.shortTitle}</span>
            </button>
          ))}
          {results.length === 0 ? (
            <p className="cq-start-empty" role="status">
              No applications found for “{normalizedQuery}”.
            </p>
          ) : null}
        </div>

        {showRecommendations ? (
          <section className="cq-start-recommended" aria-label="Recommended destinations">
            <h2>Recommended</h2>
            <button
              type="button"
              className="cq-start-recommendation"
              aria-label="Open GigBoard in Browser"
              data-tutorial-id="start-recommended-gigboard"
              onClick={openGigBoard}
            >
              <PixelIcon name="browser" size={27} />
              <span>
                <strong>GigBoard</strong>
                <small>Browse work in the internal Browser</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cq-start-recommendation"
              aria-label="Open Quest Journal"
              data-tutorial-id="start-recommended-journal"
              onClick={() => launchApp("journal")}
            >
              <PixelIcon name="journal" size={27} />
              <span>
                <strong>Quest Journal</strong>
                <small>
                  {completedCount === null
                    ? "Current mission and progress"
                    : `${completedCount}/${CHAPTER1_QUESTS.length} Chapter 1 quests complete`}
                </small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        ) : null}
      </div>

      <footer className="cq-start-footer">
        <div className="cq-start-player">
          <span aria-hidden="true">👾</span>
          <div>
            <strong>{displayName}</strong>
            <small>
              Level {level}
              {completedCount === null ? "" : ` · CH1 ${completedCount}/${CHAPTER1_QUESTS.length}`}
            </small>
          </div>
        </div>
        <div className="cq-start-system-actions">
          <button
            type="button"
            className="cq-start-system-button"
            data-tutorial-id="start-settings"
            onClick={() => launchApp("settings")}
          >
            <PixelIcon name="settings" size={20} />
            <span>Settings</span>
          </button>
          {onReturnToGame ? (
            <button
              type="button"
              className="cq-start-system-button"
              data-tutorial-id="start-return-to-game"
              onClick={() => {
                onClose(false);
                onReturnToGame();
              }}
            >
              <LogOut size={18} aria-hidden="true" />
              <span>Return to Game</span>
            </button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Briefcase,
  Globe2,
  Home as HomeIcon,
  MoreVertical,
  Plus,
  RotateCw,
  Search,
  Star,
  X,
} from "lucide-react";
import { useWindows } from "@/core/windows/windowStore";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import "../shared-apps.css";
import "./browser.css";
import {
  BROWSER_HOME_ADDRESS,
  SEARCH_ADDRESS,
  backBrowserHistory,
  buildSearchAddress,
  canGoBack,
  canGoForward,
  createBrowserHistory,
  currentBrowserAddress,
  forwardBrowserHistory,
  navigateBrowserHistory,
  resolveBrowserAddress,
  type BrowserHistory,
  type BrowserPageKind,
} from "./browserRoutes";
import { findGigboardJobBySlug, CAFE_CALCULATOR_JOB_SLUG } from "./data/gigboardJobs";
import { BrowserHomePage } from "./pages/BrowserHomePage";
import { GigBoardJobDetails } from "./pages/GigBoardJobDetails";
import { GigBoardPage } from "./pages/GigBoardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { QuestSearchPage } from "./pages/QuestSearchPage";

interface BrowserTab {
  readonly id: string;
  readonly history: BrowserHistory;
}

interface BookmarkEntry {
  readonly address: string;
  readonly title: string;
}

const DEFAULT_BOOKMARKS: readonly BookmarkEntry[] = [
  { address: SEARCH_ADDRESS, title: "QuestSearch" },
  { address: "gigboard.codequest", title: "GigBoard" },
];

type OpenMenu = "bookmarks" | "main" | null;

function TabIcon({ page }: { page: BrowserPageKind }) {
  if (page === "search") return <Search size={13} aria-hidden="true" />;
  if (page === "gigboard" || page === "gigboard-jobs" || page === "gigboard-job") {
    return <Briefcase size={13} aria-hidden="true" />;
  }
  return <Globe2 size={13} aria-hidden="true" />;
}

/**
 * Simulated, network-free browser with Chrome-style tabs, omnibox search,
 * bookmarks, and independent history per tab.
 */
export function BrowserApp() {
  const nextTabId = useRef(1);
  const addressRef = useRef<HTMLInputElement>(null);
  const focused = useWindows((state) => state.focused === "browser");

  const [tabs, setTabs] = useState<BrowserTab[]>(() => [
    { id: "tab-0", history: createBrowserHistory() },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-0");
  const [addressInput, setAddressInput] = useState(BROWSER_HOME_ADDRESS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([...DEFAULT_BOOKMARKS]);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!;
  const history = activeTab.history;
  const address = currentBrowserAddress(history);
  const resolved = resolveBrowserAddress(address);
  const job = resolved.page === "gigboard-job" ? findGigboardJobBySlug(resolved.jobSlug) : null;
  const pageTitle = job?.title ?? resolved.title;
  const isBookmarked = bookmarks.some((bookmark) => bookmark.address === address);
  const pageKey = `${activeTabId}:${address}:${refreshKey}`;

  useEffect(() => setAddressInput(address), [activeTabId, address]);

  useEffect(() => {
    if (!focused) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        addressRef.current?.focus();
        addressRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focused]);

  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".cq-browser-menus")) return;
      setOpenMenu(null);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenu]);

  const updateHistory = (next: BrowserHistory) => {
    setTabs((current) =>
      current.map((tab) => (tab.id === activeTabId ? { ...tab, history: next } : tab)),
    );
    setAddressInput(currentBrowserAddress(next));
  };

  const goTo = (input: string) => {
    const next = navigateBrowserHistory(history, input);
    updateHistory(next);

    // CH1-03 is completed by an explicit user navigation to the café job
    // details, never by rendering the page. completeQuest itself only advances
    // when CH1-03 is the active quest, so earlier quests cannot be skipped.
    const target = resolveBrowserAddress(currentBrowserAddress(next));
    if (target.page === "gigboard-job" && target.jobSlug === CAFE_CALCULATOR_JOB_SLUG) {
      void useChapter1.getState().completeQuest("CH1-03");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    goTo(addressInput);
  };

  const handleAddressKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      goTo(addressInput);
    }
  };

  const handleBack = () => updateHistory(backBrowserHistory(history));
  const handleForward = () => updateHistory(forwardBrowserHistory(history));
  const handleHome = () => goTo(BROWSER_HOME_ADDRESS);
  const handleRefresh = () => {
    setAddressInput(address);
    setRefreshKey((value) => value + 1);
  };

  const newTab = () => {
    const tab: BrowserTab = {
      id: `tab-${nextTabId.current++}`,
      history: createBrowserHistory(),
    };
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setAddressInput(BROWSER_HOME_ADDRESS);
  };

  const selectTab = (tabId: string) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;
    setActiveTabId(tab.id);
    setAddressInput(currentBrowserAddress(tab.history));
  };

  const closeTab = (tabId: string) => {
    const index = tabs.findIndex((tab) => tab.id === tabId);
    if (tabs.length === 1) {
      const fresh: BrowserTab = {
        id: `tab-${nextTabId.current++}`,
        history: createBrowserHistory(),
      };
      setTabs([fresh]);
      setActiveTabId(fresh.id);
      setAddressInput(BROWSER_HOME_ADDRESS);
      return;
    }
    const remaining = tabs.filter((tab) => tab.id !== tabId);
    setTabs(remaining);
    if (tabId === activeTabId) {
      const next = remaining[Math.min(index, remaining.length - 1)]!;
      setActiveTabId(next.id);
      setAddressInput(currentBrowserAddress(next.history));
    }
  };

  const removeBookmark = (bookmarkAddress: string) =>
    setBookmarks((current) => current.filter((bookmark) => bookmark.address !== bookmarkAddress));

  const toggleBookmark = () =>
    setBookmarks((current) =>
      current.some((bookmark) => bookmark.address === address)
        ? current.filter((bookmark) => bookmark.address !== address)
        : [...current, { address, title: pageTitle }],
    );

  const openBookmark = (bookmark: BookmarkEntry) => {
    setOpenMenu(null);
    goTo(bookmark.address);
  };

  const handleMenuAction = (action: "new-tab" | "reload" | "bookmark" | "search") => {
    setOpenMenu(null);
    if (action === "new-tab") newTab();
    if (action === "reload") handleRefresh();
    if (action === "bookmark") toggleBookmark();
    if (action === "search") goTo(SEARCH_ADDRESS);
  };

  return (
    <div className="cq-app cq-browser">
      <div className="cq-browser-chrome">
        <div className="cq-browser-tabs" role="tablist" aria-label="Browser tabs">
          {tabs.map((tab) => {
            const tabAddress = currentBrowserAddress(tab.history);
            const tabResolved = resolveBrowserAddress(tabAddress);
            const active = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={`cq-browser-tab${active ? " cq-browser-tab-active" : ""}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="cq-browser-tab-button"
                  title={tabResolved.title}
                  onClick={() => selectTab(tab.id)}
                >
                  <TabIcon page={tabResolved.page} />
                  <span className="cq-browser-tab-title">{tabResolved.title}</span>
                </button>
                <button
                  type="button"
                  className="cq-browser-tab-close"
                  aria-label={`Close ${tabResolved.title} tab`}
                  onClick={() => closeTab(tab.id)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="cq-browser-newtab"
            aria-label="New tab"
            title="New tab"
            onClick={newTab}
          >
            <Plus size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="cq-browser-toolbar">
          <div className="cq-browser-nav">
            <button
              type="button"
              className="cq-browser-icon-btn"
              aria-label="Back"
              title="Back"
              disabled={!canGoBack(history)}
              onClick={handleBack}
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cq-browser-icon-btn"
              aria-label="Forward"
              title="Forward"
              disabled={!canGoForward(history)}
              onClick={handleForward}
            >
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cq-browser-icon-btn"
              aria-label="Refresh"
              title="Refresh"
              onClick={handleRefresh}
            >
              <RotateCw size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cq-browser-icon-btn"
              aria-label="Home"
              title="Home"
              onClick={handleHome}
            >
              <HomeIcon size={17} aria-hidden="true" />
            </button>
          </div>

          <form className="cq-browser-address" role="search" onSubmit={handleSubmit}>
            {resolved.page === "search" ? (
              <Search size={15} aria-hidden="true" />
            ) : (
              <Globe2 size={15} aria-hidden="true" />
            )}
            <input
              ref={addressRef}
              aria-label="Address bar"
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              onKeyDown={handleAddressKeyDown}
              onFocus={(event) => event.currentTarget.select()}
              spellCheck={false}
              autoComplete="off"
            />
            <span className="cq-browser-address-hint">Internal</span>
          </form>

          <div className="cq-browser-menus">
            <button
              type="button"
              className={`cq-browser-icon-btn${isBookmarked ? " cq-browser-star-active" : ""}`}
              aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              onClick={toggleBookmark}
            >
              <Star size={16} fill={isBookmarked ? "currentColor" : "none"} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cq-browser-icon-btn"
              aria-label="Bookmarks"
              title="Bookmarks"
              aria-expanded={openMenu === "bookmarks"}
              onClick={() =>
                setOpenMenu((current) => (current === "bookmarks" ? null : "bookmarks"))
              }
            >
              <Bookmark size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cq-browser-icon-btn"
              aria-label="Browser menu"
              title="Browser menu"
              aria-expanded={openMenu === "main"}
              onClick={() => setOpenMenu((current) => (current === "main" ? null : "main"))}
            >
              <MoreVertical size={17} aria-hidden="true" />
            </button>

            {openMenu === "bookmarks" && (
              <div className="cq-browser-menu" role="menu" aria-label="Bookmarks menu">
                <p className="cq-browser-menu-heading">Bookmarks</p>
                {bookmarks.length === 0 && (
                  <p className="cq-browser-menu-empty">No bookmarks saved yet.</p>
                )}
                {bookmarks.map((bookmark) => (
                  <div key={bookmark.address} className="cq-browser-bookmark-row">
                    <button
                      type="button"
                      role="menuitem"
                      className="cq-browser-bookmark-open"
                      onClick={() => openBookmark(bookmark)}
                    >
                      <Globe2 size={13} aria-hidden="true" />
                      <span>
                        <strong>{bookmark.title}</strong>
                        <small>{bookmark.address}</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="cq-browser-bookmark-remove"
                      aria-label={`Remove bookmark ${bookmark.title}`}
                      title={`Remove ${bookmark.title}`}
                      onClick={() => removeBookmark(bookmark.address)}
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {openMenu === "main" && (
              <div
                className="cq-browser-menu cq-browser-main-menu"
                role="menu"
                aria-label="Browser menu"
              >
                <button type="button" role="menuitem" onClick={() => handleMenuAction("new-tab")}>
                  <Plus size={15} aria-hidden="true" /> New tab
                </button>
                <button type="button" role="menuitem" onClick={() => handleMenuAction("reload")}>
                  <RotateCw size={15} aria-hidden="true" /> Reload
                </button>
                <button type="button" role="menuitem" onClick={() => handleMenuAction("bookmark")}>
                  <Star size={15} aria-hidden="true" />{" "}
                  {isBookmarked ? "Remove bookmark" : "Bookmark this page"}
                </button>
                <button type="button" role="menuitem" onClick={() => handleMenuAction("search")}>
                  <Search size={15} aria-hidden="true" /> Open QuestSearch
                </button>
                <hr />
                <p className="cq-browser-menu-note">CodeQuest Browser — internal sites only</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cq-browser-viewport">
        {resolved.page === "home" && <BrowserHomePage key={pageKey} onNavigate={goTo} />}
        {resolved.page === "search" && (
          <QuestSearchPage
            key={pageKey}
            query={resolved.query}
            onSearch={(query) => goTo(buildSearchAddress(query))}
            onNavigate={goTo}
          />
        )}
        {(resolved.page === "gigboard" || resolved.page === "gigboard-jobs") && (
          <GigBoardPage
            key={pageKey}
            view={resolved.page === "gigboard-jobs" ? "jobs" : "home"}
            query={resolved.query}
            category={resolved.params["category"] ?? ""}
            difficulty={resolved.params["difficulty"] ?? ""}
            onNavigate={goTo}
          />
        )}
        {resolved.page === "gigboard-job" &&
          (job ? (
            <GigBoardJobDetails key={pageKey} job={job} onNavigate={goTo} />
          ) : (
            <NotFoundPage key={pageKey} address={address} onNavigate={goTo} />
          ))}
        {resolved.page === "not-found" && (
          <NotFoundPage key={pageKey} address={address} onNavigate={goTo} />
        )}
      </div>
    </div>
  );
}

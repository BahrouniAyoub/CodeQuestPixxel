import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Rnd } from "react-rnd";
import { X, Minus, Square } from "lucide-react";
import wallpaper from "@/assets/wallpaper-night-city.jpg";
import { APPS, PINNED_APPS, type AppId } from "@/core/applications/registry";
import { PixelIcon } from "@/shared/components/PixelIcon";
import { TASKBAR_HEIGHT, desktopBounds, useWindows } from "@/core/windows/windowStore";
import { dbGet, dbGetAll } from "@/services/persistence/db";
import type { Geometry } from "@/core/windows/windowReducer";
import { useSettings, type Settings } from "@/features/settings/settingsStore";
import "./pixel-os-shell.css";
import { TicketsApp } from "@/features/tickets/TicketsApp";
import { useProgress, type ProgressPersisted } from "@/features/progress/progressStore";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { EditorApp } from "@/features/editor/EditorApp";
import { ChatApp } from "@/features/chat/ChatApp";
import { MailApp } from "@/features/mail/MailApp";
import { useMail } from "@/features/mail/mailStore";
import { syncCafeWelcomeEmail } from "@/features/mail/mailIntegration";
import { ProgressApp } from "@/features/progress/ProgressApp";
import { QuestJournalApp } from "@/features/journal/QuestJournalApp";
import { BrowserApp } from "@/features/browser/BrowserApp";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import { useCafeSubmission } from "@/features/chapter1/cafeCoding/cafeSubmissionStore";
import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import { useCafeSetup } from "@/features/chapter1/cafeSetup/cafeSetupStore";
import { SettingsApp } from "@/features/settings/SettingsApp";
import { useChat, type ChatPersisted } from "@/features/chat/chatStore";
import { useDrafts } from "@/features/tickets/draftStore";
import { useNotifications } from "@/features/notifications/notificationStore";
import { ExplorerApp } from "@/features/explorer/ExplorerApp";
import { TerminalApp } from "@/features/terminal/TerminalApp";
import type { TicketId } from "@/features/tickets/data/tickets";
import StartMenu from "./StartMenu";
import Taskbar from "./Taskbar";

export interface PixelOSProps {
  /** Supplied by the /game route; the standalone desktop preview uses Player. */
  readonly playerName?: string;
  /** Absent on the standalone desktop preview, where there is no game to return to. */
  readonly onReturnToGame?: () => void;
}

const START_CLOSE_MS = 120;

function AppPreview({ id }: { id: AppId }) {
  const app = APPS[id];
  if (id === "tickets") return <TicketsApp />;
  if (id === "editor") return <EditorApp />;
  if (id === "chat") return <ChatApp />;
  if (id === "mail") return <MailApp />;
  if (id === "browser") return <BrowserApp />;
  if (id === "progress") return <ProgressApp />;
  if (id === "journal") return <QuestJournalApp />;
  if (id === "settings") return <SettingsApp />;
  if (id === "explorer") return <ExplorerApp />;
  if (id === "terminal") return <TerminalApp />;
  return (
    <div className="cq-app-empty">
      <PixelIcon name={app.icon} size={64} />
      <h2>{app.title}</h2>
      <p>Coming soon — this application is not part of the current MVP.</p>
    </div>
  );
}

function WindowFrame({ id, z }: { id: AppId; z: number }) {
  const win = useWindows((state) => state.windows[id]);
  const focused = useWindows((state) => state.focused === id);
  const { focus, close, minimize, toggleMaximize, setGeometry } = useWindows.getState();
  if (!win.open || win.minimized) return null;
  const bounds = desktopBounds();
  const position = win.maximized ? { x: 0, y: 0 } : { x: win.x, y: win.y };
  const size = win.maximized
    ? { width: bounds.width, height: bounds.height }
    : { width: win.width, height: win.height };
  return (
    <Rnd
      key={id}
      className={`cq-window ${focused ? "cq-window-active" : ""}`}
      style={{ zIndex: z }}
      bounds="parent"
      position={position}
      size={size}
      minWidth={Math.min(APPS[id].minSize.width, bounds.width)}
      minHeight={Math.min(APPS[id].minSize.height, bounds.height)}
      disableDragging={win.maximized}
      enableResizing={!win.maximized}
      dragHandleClassName="cq-window-titlebar"
      onDragStart={() => focus(id)}
      onDragStop={(_event, data) => setGeometry(id, { x: data.x, y: data.y })}
      onResizeStart={() => focus(id)}
      onResizeStop={(_event, _direction, ref, _delta, position) =>
        setGeometry(id, {
          x: position.x,
          y: position.y,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        })
      }
      onMouseDown={() => focus(id)}
    >
      <div className="cq-window-inner" data-window-id={id} tabIndex={-1}>
        <div
          className="cq-window-titlebar"
          onDoubleClick={() => toggleMaximize(id)}
        >
          <PixelIcon name={APPS[id].icon} size={22} />
          <strong>{APPS[id].title}</strong>
          <div className="cq-window-controls">
            <button
              aria-label={`Minimize ${APPS[id].title}`}
              onClick={(event) => {
                event.stopPropagation();
                minimize(id);
              }}
            >
              <Minus size={15} />
            </button>
            <button
              aria-label={`${win.maximized ? "Restore" : "Maximize"} ${APPS[id].title}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleMaximize(id);
              }}
            >
              <Square size={12} />
            </button>
            <button
              className="cq-close"
              aria-label={`Close ${APPS[id].title}`}
              onClick={(event) => {
                event.stopPropagation();
                close(id);
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="cq-window-content">
          <AppPreview id={id} />
        </div>
      </div>
    </Rnd>
  );
}

export default function PixelOS({ playerName = "Player", onReturnToGame }: PixelOSProps) {
  const order = useWindows((state) => state.order);
  const { open, dispatch } = useWindows.getState();
  const settings = useSettings();
  const notifications = useNotifications();
  const [notificationCenter, setNotificationCenter] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [startClosing, setStartClosing] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [selected, setSelected] = useState<AppId | null>(null);
  const startOpenRef = useRef(false);
  const startCloseTimerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      dbGet<Record<AppId, Geometry>>("prefs", "windows"),
      dbGet<Partial<Settings>>("prefs", "settings"),
      dbGet<ProgressPersisted>("progress", "state"),
      dbGet<ChatPersisted>("chat", "state"),
      dbGetAll<string>("drafts"),
      useChapter1.getState().hydrate(),
      useGigboardApplication.getState().hydrate(),
      useCafeMilestones.getState().hydrate(),
      useCafeSetup.getState().hydrate(),
      useCafeSubmission.getState().hydrate(),
      useCafePayment.getState().hydrate(),
      useMail.getState().hydrate(),
    ])
      .then(
        ([geometry, prefs, savedProgress, savedChat, savedDrafts]) => {
          if (!alive) return;
          useWindows.getState().hydrateGeometry(geometry);
          useSettings.getState().hydrate(prefs);
          useProgress.getState().hydrate(savedProgress);
          useChat.getState().hydrate(savedChat);
          useDrafts.getState().hydrate(savedDrafts as Partial<Record<TicketId, string>>);
          void syncCafeWelcomeEmail().catch((error) =>
            console.warn("Could not synchronize CodeQuest Mail", error),
          );
        },
      )
      .catch((error) => {
        if (!alive) return;
        setRestoreError(error instanceof Error ? error.message : String(error));
        console.warn("Could not restore Pixel OS preferences", error);
      })
      .finally(() => {
        if (alive) setRestoring(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const resize = () => dispatch({ type: "CLAMP_ALL", bounds: desktopBounds() });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [dispatch]);

  const clearStartCloseTimer = useCallback(() => {
    if (startCloseTimerRef.current === null) return;
    window.clearTimeout(startCloseTimerRef.current);
    startCloseTimerRef.current = null;
  }, []);

  const finishStartClose = useCallback(() => {
    clearStartCloseTimer();
    startOpenRef.current = false;
    setStartClosing(false);
    setStartOpen(false);
  }, [clearStartCloseTimer]);

  const openStart = useCallback(() => {
    clearStartCloseTimer();
    startOpenRef.current = true;
    setStartClosing(false);
    setStartOpen(true);
  }, [clearStartCloseTimer]);

  const closeStartMenu = useCallback(
    (restoreFocus = false) => {
      if (!startOpenRef.current) return;
      startOpenRef.current = false;
      if (restoreFocus) startButtonRef.current?.focus();
      clearStartCloseTimer();
      if (settings.reducedMotion) {
        finishStartClose();
        return;
      }
      setStartClosing(true);
      startCloseTimerRef.current = window.setTimeout(finishStartClose, START_CLOSE_MS);
    },
    [clearStartCloseTimer, finishStartClose, settings.reducedMotion],
  );

  useEffect(() => () => clearStartCloseTimer(), [clearStartCloseTimer]);

  const toggleStart = () => {
    if (startOpenRef.current) closeStartMenu(false);
    else openStart();
  };

  const launch = (id: AppId) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && menuRef.current?.contains(active)) active.blur();
    open(id);
    closeStartMenu(false);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-window-id="${id}"]`)?.focus();
    }, 0);
  };

  return (
    <div
      className={`cq-os ${settings.theme === "light" ? "theme-light" : ""} ${settings.reducedMotion ? "cq-reduced-motion" : ""}`}
      style={{ "--cq-scale": settings.uiScale } as CSSProperties}
    >
      <img className="cq-wallpaper" src={wallpaper} alt="" />
      {restoring && (
        <div className="cq-boot-overlay" role="status">
          Loading saved CodeQuest workspace…
        </div>
      )}
      {!restoring && restoreError && (
        <div className="cq-restore-error" role="alert">
          Saved data could not be loaded: {restoreError}. Changes may overwrite older data.{" "}
          <button onClick={() => setRestoreError(null)}>Dismiss</button>
        </div>
      )}
      {!restoring && (
        <div className="cq-desktop-icons" aria-label="Desktop shortcuts">
          {PINNED_APPS.map((id) => (
            <button
              key={id}
              className={`cq-shortcut ${selected === id ? "cq-selected" : ""}`}
              onClick={() => setSelected(id)}
              onDoubleClick={() => launch(id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") launch(id);
              }}
              title={`Double click to open ${APPS[id].title}`}
            >
              <PixelIcon name={APPS[id].icon} size={43} />
              <span>{APPS[id].title}</span>
            </button>
          ))}
        </div>
      )}
      {!restoring && (
        <div className="cq-window-layer" style={{ bottom: TASKBAR_HEIGHT }}>
          {order.map((id, index) => (
            <WindowFrame key={id} id={id} z={10 + index} />
          ))}
        </div>
      )}
      {!restoring && startOpen && (
        <StartMenu
          menuRef={menuRef}
          startButtonRef={startButtonRef}
          onClose={closeStartMenu}
          onLaunch={launch}
          onReturnToGame={onReturnToGame}
          playerName={playerName}
          closing={startClosing}
        />
      )}
      <div className="cq-toast-stack" aria-live="polite">
        {notifications.toasts.map((notification) => (
          <div
            key={notification.id}
            className={`cq-toast cq-toast-${notification.kind}`}
          >
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.message}</p>
            </div>
            <button
              aria-label="Dismiss notification"
              onClick={() => notifications.dismiss(notification.id)}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {notificationCenter && (
        <div className="cq-notification-center">
          <header>
            <strong>Notifications</strong>
            <button onClick={() => notifications.clearHistory()}>Clear all</button>
          </header>
          {notifications.history.length ? (
            notifications.history.map((notification) => (
              <div key={notification.id}>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
              </div>
            ))
          ) : (
            <p>No notifications yet.</p>
          )}
        </div>
      )}
      <Taskbar
        startOpen={startOpen}
        startButtonRef={startButtonRef}
        onToggleStart={toggleStart}
        onCloseStart={() => closeStartMenu(false)}
        notificationCenterOpen={notificationCenter}
        onToggleNotificationCenter={() => setNotificationCenter((value) => !value)}
        clock={clock}
      />
    </div>
  );
}

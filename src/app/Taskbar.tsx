import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import { Bell, ChevronLeft, ChevronRight, Clock3, PanelsTopLeft } from "lucide-react";
import { APPS, PINNED_APPS, type AppId } from "@/core/applications/registry";
import { PixelIcon } from "@/shared/components/PixelIcon";
import { useWindows } from "@/core/windows/windowStore";
import { useSettings } from "@/features/settings/settingsStore";
import { useNotifications } from "@/features/notifications/notificationStore";
import { deriveTaskbarItems, type TaskbarItem } from "./taskbarModel";
import "./Taskbar.css";

interface TaskbarProps {
  readonly startOpen: boolean;
  readonly startButtonRef: RefObject<HTMLButtonElement | null>;
  readonly onToggleStart: () => void;
  readonly onCloseStart: () => void;
  readonly notificationCenterOpen: boolean;
  readonly onToggleNotificationCenter: () => void;
  readonly clock: Date;
}

interface ContextMenuState {
  id: AppId;
  x: number;
  y: number;
}

interface TooltipState {
  id: AppId;
  x: number;
  y: number;
}

const STATE_LABEL: Record<TaskbarItem["state"], string> = {
  "closed-pinned": "Closed",
  running: "Running",
  focused: "Focused",
  minimized: "Minimized",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function Taskbar({
  startOpen,
  startButtonRef,
  onToggleStart,
  onCloseStart,
  notificationCenterOpen,
  onToggleNotificationCenter,
  clock,
}: TaskbarProps) {
  const windows = useWindows((state) => state.windows);
  const focused = useWindows((state) => state.focused);
  const taskbarClick = useWindows((state) => state.taskbarClick);
  const open = useWindows((state) => state.open);
  const close = useWindows((state) => state.close);
  const focus = useWindows((state) => state.focus);
  const minimize = useWindows((state) => state.minimize);
  const taskbarPinnedAppIds = useSettings((state) => state.taskbarPinnedAppIds);
  const updateSettings = useSettings((state) => state.update);
  const notifications = useNotifications();

  const items = useMemo(
    () => deriveTaskbarItems(windows, focused, taskbarPinnedAppIds),
    [windows, focused, taskbarPinnedAppIds],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Partial<Record<AppId, HTMLButtonElement | null>>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const previousFocusedRef = useRef<AppId | null>(focused);
  const previousOpenRef = useRef<Partial<Record<AppId, boolean>>>({});

  const updateOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setOverflow({
      left: el.scrollLeft > 1,
      right: maxScroll - el.scrollLeft > 1,
    });
  }, []);

  useEffect(() => {
    updateOverflow();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateOverflow());
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    window.addEventListener("resize", updateOverflow);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [items, updateOverflow]);

  const scrollIntoViewIfNeeded = useCallback((id: AppId) => {
    const container = scrollRef.current;
    const item = itemRefs.current[id];
    if (!container || !item) return;
    const cRect = container.getBoundingClientRect();
    const iRect = item.getBoundingClientRect();
    if (iRect.left < cRect.left) {
      container.scrollBy({ left: iRect.left - cRect.left - 8, behavior: "smooth" });
    } else if (iRect.right > cRect.right) {
      container.scrollBy({ left: iRect.right - cRect.right + 8, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (focused && focused !== previousFocusedRef.current) {
      scrollIntoViewIfNeeded(focused);
    }
    previousFocusedRef.current = focused;
  }, [focused, scrollIntoViewIfNeeded]);

  useEffect(() => {
    for (const item of items) {
      const wasOpen = previousOpenRef.current[item.id] ?? false;
      if (item.open && !wasOpen) scrollIntoViewIfNeeded(item.id);
      previousOpenRef.current[item.id] = item.open;
    }
  }, [items, scrollIntoViewIfNeeded]);

  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      const button = itemRefs.current[contextMenu.id];
      if (button?.contains(target)) return;
      setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setContextMenu(null);
        itemRefs.current[contextMenu.id]?.focus();
      }
    };
    const onResize = () => setContextMenu(null);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [contextMenu]);

  const showTooltip = useCallback((id: AppId) => {
    const button = itemRefs.current[id];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setTooltip({ id, x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const openContextMenu = useCallback((id: AppId, x: number, y: number) => {
    setTooltip(null);
    setContextMenu({ id, x, y });
  }, []);

  const onItemContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, id: AppId) => {
      event.preventDefault();
      onCloseStart();
      openContextMenu(id, event.clientX, event.clientY);
    },
    [onCloseStart, openContextMenu],
  );

  const onItemKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, id: AppId) => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        openContextMenu(id, rect.left + rect.width / 2, rect.top);
      }
    },
    [openContextMenu],
  );

  const reducedMotion = useSettings((state) => state.reducedMotion);

  const pinApp = useCallback(
    (id: AppId) => {
      const current = [...(taskbarPinnedAppIds ?? PINNED_APPS)];
      if (current.includes(id)) return;
      updateSettings({ taskbarPinnedAppIds: [...current, id] });
    },
    [taskbarPinnedAppIds, updateSettings],
  );

  const unpinApp = useCallback(
    (id: AppId) => {
      const current = [...(taskbarPinnedAppIds ?? PINNED_APPS)];
      updateSettings({ taskbarPinnedAppIds: current.filter((p) => p !== id) });
    },
    [taskbarPinnedAppIds, updateSettings],
  );

  const scrollByAmount = useCallback(
    (direction: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollBy({
        left: direction * Math.max(120, el.clientWidth * 0.6),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion],
  );

  const contextItem = contextMenu ? items.find((i) => i.id === contextMenu.id) ?? null : null;

  useEffect(() => {
    if (!contextMenu) return;
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [contextMenu]);

  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    const x = clamp(contextMenu.x, padding, window.innerWidth - rect.width - padding);
    const above = contextMenu.y - rect.height - 8;
    const y =
      above < padding
        ? clamp(contextMenu.y + 8, padding, window.innerHeight - rect.height - padding)
        : above;
    setMenuPos({ left: x, top: y });
  }, [contextMenu, contextItem]);

  const menuStyle = useMemo<CSSProperties | undefined>(() => {
    if (!contextMenu) return undefined;
    const pos = menuPos ?? { left: contextMenu.x, top: contextMenu.y };
    return { left: pos.left, top: pos.top, visibility: menuPos ? "visible" : "hidden" };
  }, [contextMenu, menuPos]);

  const tooltipItem = tooltip ? items.find((i) => i.id === tooltip.id) : undefined;
  const tooltipStyle = useMemo<CSSProperties | undefined>(() => {
    if (!tooltip) return undefined;
    return { left: tooltip.x, top: tooltip.y - 10 };
  }, [tooltip]);

  const handleAppClick = useCallback(
    (id: AppId) => {
      setContextMenu(null);
      setTooltip(null);
      onCloseStart();
      taskbarClick(id);
    },
    [onCloseStart, taskbarClick],
  );

  const currentPinned = taskbarPinnedAppIds ?? PINNED_APPS;

  return (
    <>
      <div className="cq-taskbar" data-tutorial-id="taskbar">
        <div className="cq-taskbar-brand" title="CodeQuest Pixel OS">
          <PanelsTopLeft size={19} />
          <span>CodeQuest</span>
        </div>
        <div className="cq-taskbar-center">
          <button
            ref={startButtonRef}
            type="button"
            className={`cq-taskbar-button cq-start-button ${startOpen ? "cq-taskbar-focused" : ""}`}
            onClick={onToggleStart}
            aria-label={startOpen ? "Close Start menu" : "Open Start menu"}
            aria-expanded={startOpen}
            aria-controls="cq-start-menu"
            aria-haspopup="dialog"
            data-tutorial-id="start-button"
          >
            <span>▦</span>
          </button>

          <div className="cq-taskbar-apps-region">
            {overflow.left && (
              <button
                type="button"
                className="cq-taskbar-overflow"
                aria-label="Scroll taskbar left"
                data-tutorial-id="taskbar-overflow-left"
                onClick={() => scrollByAmount(-1)}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div
              ref={scrollRef}
              className="cq-taskbar-apps"
              role="toolbar"
              aria-label="Running and pinned applications"
            >
              {items.map((item) => {
                const app = APPS[item.id];
                const label = `${app.title} — ${STATE_LABEL[item.state]}`;
                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      itemRefs.current[item.id] = node;
                    }}
                    type="button"
                    className={[
                      "cq-taskbar-button",
                      "cq-taskbar-app",
                      `cq-taskbar-state-${item.state}`,
                      item.open ? "cq-taskbar-running" : "",
                      item.focused ? "cq-taskbar-focused" : "",
                      item.minimized ? "cq-taskbar-minimized" : "",
                      item.pinned ? "cq-taskbar-pinned" : "cq-taskbar-unpinned",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={label}
                    aria-current={item.focused ? "true" : undefined}
                    data-tutorial-id={`taskbar-app-${item.id}`}
                    data-app-state={item.state}
                    data-pinned={item.pinned ? "true" : "false"}
                    onClick={() => handleAppClick(item.id)}
                    onContextMenu={(event) => onItemContextMenu(event, item.id)}
                    onKeyDown={(event) => onItemKeyDown(event, item.id)}
                    onMouseEnter={() => showTooltip(item.id)}
                    onMouseLeave={hideTooltip}
                    onFocus={() => showTooltip(item.id)}
                    onBlur={hideTooltip}
                  >
                    <PixelIcon name={app.icon} size={29} />
                    <span
                      className="cq-taskbar-indicator"
                      aria-hidden="true"
                      data-tutorial-id={`taskbar-app-indicator-${item.id}`}
                      data-state={item.state}
                    />
                  </button>
                );
              })}
            </div>
            {overflow.right && (
              <button
                type="button"
                className="cq-taskbar-overflow"
                aria-label="Scroll taskbar right"
                data-tutorial-id="taskbar-overflow-right"
                onClick={() => scrollByAmount(1)}
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="cq-taskbar-tray">
          <button
            type="button"
            className="cq-tray-bell"
            aria-label="Notification center"
            aria-expanded={notificationCenterOpen}
            onClick={() => {
              onToggleNotificationCenter();
              notifications.markSeen();
            }}
          >
            <Bell size={16} />
            {notifications.unseen > 0 && <span>{notifications.unseen}</span>}
          </button>
          <div className="cq-clock">
            <span>
              {clock.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>
              {clock.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <Clock3 size={15} />
        </div>
      </div>

      {tooltipItem && tooltipStyle && !contextMenu && (
        <div className="cq-taskbar-tooltip" role="tooltip" style={tooltipStyle}>
          <strong>{APPS[tooltipItem.id].title}</strong>
          <span>{STATE_LABEL[tooltipItem.state]}</span>
        </div>
      )}

      {contextItem && menuStyle && (
        <div
          ref={menuRef}
          className="cq-taskbar-context-menu"
          role="menu"
          aria-label={`${APPS[contextItem.id].title} taskbar actions`}
          style={menuStyle}
        >
          {!contextItem.open && (
            <button
              type="button"
              role="menuitem"
              data-tutorial-id="taskbar-context-open"
              onClick={() => {
                open(contextItem.id);
                setContextMenu(null);
              }}
            >
              Open
            </button>
          )}
          {contextItem.open && contextItem.minimized && (
            <button
              type="button"
              role="menuitem"
              data-tutorial-id="taskbar-context-restore"
              onClick={() => {
                focus(contextItem.id);
                setContextMenu(null);
              }}
            >
              Restore
            </button>
          )}
          {contextItem.open && !contextItem.minimized && !contextItem.focused && (
            <button
              type="button"
              role="menuitem"
              data-tutorial-id="taskbar-context-focus"
              onClick={() => {
                focus(contextItem.id);
                setContextMenu(null);
              }}
            >
              Focus
            </button>
          )}
          {contextItem.open && !contextItem.minimized && (
            <button
              type="button"
              role="menuitem"
              data-tutorial-id="taskbar-context-minimize"
              onClick={() => {
                minimize(contextItem.id);
                setContextMenu(null);
              }}
            >
              Minimize
            </button>
          )}
          {contextItem.open && (
            <button
              type="button"
              role="menuitem"
              data-tutorial-id="taskbar-context-close"
              onClick={() => {
                close(contextItem.id);
                setContextMenu(null);
              }}
            >
              Close
            </button>
          )}
          <div className="cq-taskbar-context-separator" role="separator" />
          {currentPinned.includes(contextItem.id) ? (
            <button
              type="button"
              role="menuitem"
              data-tutorial-id="taskbar-context-unpin"
              onClick={() => {
                unpinApp(contextItem.id);
                setContextMenu(null);
              }}
            >
              Unpin from taskbar
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              data-tutorial-id="taskbar-context-pin"
              onClick={() => {
                pinApp(contextItem.id);
                setContextMenu(null);
              }}
            >
              Pin to taskbar
            </button>
          )}
        </div>
      )}
    </>
  );
}



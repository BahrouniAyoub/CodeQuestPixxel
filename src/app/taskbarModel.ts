import { APP_ORDER, PINNED_APPS, type AppId } from "@/core/applications/registry";
import type { WindowManagerState } from "@/core/windows/windowReducer";

export type TaskbarAppState = "closed-pinned" | "running" | "focused" | "minimized";

export interface TaskbarItem {
  id: AppId;
  pinned: boolean;
  open: boolean;
  minimized: boolean;
  focused: boolean;
  state: TaskbarAppState;
}

export function getEffectiveTaskbarPinnedAppIds(
  taskbarPinnedAppIds: readonly AppId[] | undefined,
): readonly AppId[] {
  return taskbarPinnedAppIds === undefined ? PINNED_APPS : taskbarPinnedAppIds;
}

export function deriveTaskbarItems(
  windows: WindowManagerState["windows"],
  focusedAppId: AppId | null,
  taskbarPinnedAppIds: readonly AppId[] | undefined,
): TaskbarItem[] {
  const effectivePinned = getEffectiveTaskbarPinnedAppIds(taskbarPinnedAppIds);
  const pinnedSet = new Set<AppId>(effectivePinned);
  const items: TaskbarItem[] = [];
  const seen = new Set<AppId>();

  const append = (id: AppId, pinned: boolean) => {
    if (seen.has(id)) return;
    const win = windows[id];
    const open = win.open;
    const minimized = open && win.minimized;
    const focused = open && !minimized && focusedAppId === id;
    const state: TaskbarAppState = !open
      ? "closed-pinned"
      : minimized
        ? "minimized"
        : focused
          ? "focused"
          : "running";
    seen.add(id);
    items.push({ id, pinned, open, minimized, focused, state });
  };

  for (const id of effectivePinned) append(id, true);

  for (const id of APP_ORDER) {
    if (pinnedSet.has(id)) continue;
    if (windows[id].open) append(id, false);
  }

  return items;
}

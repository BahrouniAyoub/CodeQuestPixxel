import { create } from "zustand";
import { useFileSession } from "@/features/editor/fileSession";
import type { AppId } from "@/core/applications/registry";
import { debouncedSave } from "@/services/persistence/saveStatus";
import {
  createInitialState,
  extractGeometry,
  windowReducer,
  type Bounds,
  type Geometry,
  type WindowAction,
  type WindowManagerState,
} from "./windowReducer";

export const TASKBAR_HEIGHT = 52;

export function desktopBounds(): Bounds {
  if (typeof window === "undefined") return { width: 1280, height: 720 - TASKBAR_HEIGHT };
  return { width: window.innerWidth, height: window.innerHeight - TASKBAR_HEIGHT };
}

interface WindowStore extends WindowManagerState {
  dispatch: (action: WindowAction) => void;
  open: (id: AppId) => void;
  close: (id: AppId) => void;
  focus: (id: AppId) => void;
  minimize: (id: AppId) => void;
  toggleMaximize: (id: AppId) => void;
  taskbarClick: (id: AppId) => void;
  setGeometry: (id: AppId, g: Partial<Geometry>) => void;
  resetGeometry: () => void;
  hydrateGeometry: (g: Partial<Record<AppId, Geometry>> | undefined) => void;
}

const GEOMETRY_ACTIONS = new Set<WindowAction["type"]>(["SET_GEOMETRY", "RESET_GEOMETRY", "OPEN"]);

export const useWindows = create<WindowStore>((set, get) => {
  const dispatch = (action: WindowAction) => {
    if (action.type === "CLOSE" && action.id === "editor") {
      if (!useFileSession.getState().closeFile()) return;
    }
    const prev = get();
    const next = windowReducer({ windows: prev.windows, order: prev.order, focused: prev.focused }, action);
    set(next);
    if (GEOMETRY_ACTIONS.has(action.type)) {
      debouncedSave("prefs", "windows", extractGeometry(next), 400);
    }
  };
  return {
    ...createInitialState(desktopBounds()),
    dispatch,
    open: (id) => dispatch({ type: "OPEN", id, bounds: desktopBounds() }),
    close: (id) => dispatch({ type: "CLOSE", id }),
    focus: (id) => dispatch({ type: "FOCUS", id }),
    minimize: (id) => dispatch({ type: "MINIMIZE", id }),
    toggleMaximize: (id) => dispatch({ type: "TOGGLE_MAXIMIZE", id }),
    taskbarClick: (id) => dispatch({ type: "TASKBAR_CLICK", id, bounds: desktopBounds() }),
    setGeometry: (id, geometry) => dispatch({ type: "SET_GEOMETRY", id, geometry, bounds: desktopBounds() }),
    resetGeometry: () => dispatch({ type: "RESET_GEOMETRY", bounds: desktopBounds() }),
    hydrateGeometry: (geometry) => {
      if (geometry) dispatch({ type: "HYDRATE_GEOMETRY", geometry, bounds: desktopBounds() });
    },
  };
});

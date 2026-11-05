import { APP_ORDER, APPS, type AppId } from "@/core/applications/registry";

export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState extends Geometry {
  id: AppId;
  open: boolean;
  minimized: boolean;
  maximized: boolean;
}

export interface WindowManagerState {
  windows: Record<AppId, WindowState>;
  /** z-order, last = top-most */
  order: AppId[];
  focused: AppId | null;
}

export interface Bounds {
  width: number;
  height: number;
}

export type WindowAction =
  | { type: "OPEN"; id: AppId; bounds: Bounds }
  | { type: "CLOSE"; id: AppId }
  | { type: "FOCUS"; id: AppId }
  | { type: "MINIMIZE"; id: AppId }
  | { type: "TOGGLE_MAXIMIZE"; id: AppId }
  | { type: "SET_GEOMETRY"; id: AppId; geometry: Partial<Geometry>; bounds: Bounds }
  | { type: "TASKBAR_CLICK"; id: AppId; bounds: Bounds }
  | { type: "CLAMP_ALL"; bounds: Bounds }
  | { type: "RESET_GEOMETRY"; bounds: Bounds }
  | { type: "HYDRATE_GEOMETRY"; geometry: Partial<Record<AppId, Geometry>>; bounds: Bounds };

const MIN_VISIBLE = 80;

export function defaultGeometry(id: AppId, bounds: Bounds): Geometry {
  const def = APPS[id];
  const index = APP_ORDER.indexOf(id);
  const width = Math.min(def.defaultSize.width, Math.max(def.minSize.width, bounds.width - 40));
  const height = Math.min(def.defaultSize.height, Math.max(def.minSize.height, bounds.height - 40));
  const x = Math.round((bounds.width - width) / 2) + (index - 2) * 28;
  const y = Math.round((bounds.height - height) / 2) + (index - 2) * 22;
  return clampGeometry(id, { x, y, width, height }, bounds);
}

/** Keep a window inside the usable desktop area (title bar always reachable). */
export function clampGeometry(id: AppId, g: Geometry, bounds: Bounds): Geometry {
  const min = APPS[id].minSize;
  const width = Math.max(min.width, Math.min(g.width, bounds.width));
  const height = Math.max(min.height, Math.min(g.height, bounds.height));
  const maxX = Math.max(0, bounds.width - Math.min(width, MIN_VISIBLE));
  const x = Math.min(Math.max(g.x, Math.min(0, bounds.width - width)), maxX);
  const y = Math.min(Math.max(g.y, 0), Math.max(0, bounds.height - 32));
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export function createInitialState(bounds: Bounds): WindowManagerState {
  const windows = {} as Record<AppId, WindowState>;
  for (const id of APP_ORDER) {
    windows[id] = { id, open: false, minimized: false, maximized: false, ...defaultGeometry(id, bounds) };
  }
  return { windows, order: [], focused: null };
}

function bringToFront(order: AppId[], id: AppId): AppId[] {
  return [...order.filter((o) => o !== id), id];
}

function topVisible(state: WindowManagerState, order: AppId[], exclude?: AppId): AppId | null {
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    if (!id) continue;
    const w = state.windows[id];
    if (id !== exclude && w.open && !w.minimized) return id;
  }
  return null;
}

function patch(state: WindowManagerState, id: AppId, p: Partial<WindowState>): Record<AppId, WindowState> {
  return { ...state.windows, [id]: { ...state.windows[id], ...p } };
}

export function windowReducer(state: WindowManagerState, action: WindowAction): WindowManagerState {
  switch (action.type) {
    case "OPEN": {
      const w = state.windows[action.id];
      const geometry = clampGeometry(action.id, w, action.bounds);
      return {
        windows: patch(state, action.id, { ...geometry, open: true, minimized: false }),
        order: bringToFront(state.order, action.id),
        focused: action.id,
      };
    }
    case "CLOSE": {
      const order = state.order.filter((o) => o !== action.id);
      const next = { ...state, windows: patch(state, action.id, { open: false, minimized: false, maximized: false }), order };
      return { ...next, focused: topVisible(next, order) };
    }
    case "FOCUS": {
      const w = state.windows[action.id];
      if (!w.open) return state;
      if (state.focused === action.id && !w.minimized && state.order[state.order.length - 1] === action.id) return state;
      return {
        windows: w.minimized ? patch(state, action.id, { minimized: false }) : state.windows,
        order: bringToFront(state.order, action.id),
        focused: action.id,
      };
    }
    case "MINIMIZE": {
      const next = { ...state, windows: patch(state, action.id, { minimized: true }) };
      return { ...next, focused: topVisible(next, state.order, action.id) };
    }
    case "TOGGLE_MAXIMIZE": {
      const w = state.windows[action.id];
      return {
        windows: patch(state, action.id, { maximized: !w.maximized, minimized: false }),
        order: bringToFront(state.order, action.id),
        focused: action.id,
      };
    }
    case "SET_GEOMETRY": {
      const w = state.windows[action.id];
      const geometry = clampGeometry(action.id, { ...w, ...action.geometry }, action.bounds);
      return { ...state, windows: patch(state, action.id, geometry) };
    }
    case "TASKBAR_CLICK": {
      const w = state.windows[action.id];
      if (!w.open) return windowReducer(state, { type: "OPEN", id: action.id, bounds: action.bounds });
      if (w.minimized) return windowReducer(state, { type: "FOCUS", id: action.id });
      if (state.focused === action.id) return windowReducer(state, { type: "MINIMIZE", id: action.id });
      return windowReducer(state, { type: "FOCUS", id: action.id });
    }
    case "CLAMP_ALL": {
      const windows = { ...state.windows };
      for (const id of APP_ORDER) {
        windows[id] = { ...windows[id], ...clampGeometry(id, windows[id], action.bounds) };
      }
      return { ...state, windows };
    }
    case "RESET_GEOMETRY": {
      const windows = { ...state.windows };
      for (const id of APP_ORDER) {
        windows[id] = { ...windows[id], ...defaultGeometry(id, action.bounds), maximized: false };
      }
      return { ...state, windows };
    }
    case "HYDRATE_GEOMETRY": {
      const windows = { ...state.windows };
      for (const id of APP_ORDER) {
        const g = action.geometry[id];
        if (g && [g.x, g.y, g.width, g.height].every((n) => Number.isFinite(n))) {
          windows[id] = { ...windows[id], ...clampGeometry(id, g, action.bounds) };
        }
      }
      return { ...state, windows };
    }
    default:
      return state;
  }
}

export function extractGeometry(state: WindowManagerState): Record<AppId, Geometry> {
  const out = {} as Record<AppId, Geometry>;
  for (const id of APP_ORDER) {
    const { x, y, width, height } = state.windows[id];
    out[id] = { x, y, width, height };
  }
  return out;
}

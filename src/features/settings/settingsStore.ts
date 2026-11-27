import { create } from "zustand";
import { APP_ORDER, PINNED_APPS, type AppId } from "@/core/applications/registry";
import { debouncedSave } from "@/services/persistence/saveStatus";

export type ThemeName = "dark" | "light";

export interface Settings {
  theme: ThemeName;
  uiScale: number;
  reducedMotion: boolean;
  notificationsEnabled: boolean;
  /** Global taskbar pin preference. Undefined means use registry defaults; [] means unpin all. */
  taskbarPinnedAppIds?: AppId[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  uiScale: 1,
  reducedMotion: false,
  notificationsEnabled: true,
};

export const UI_SCALES = [0.9, 1, 1.1, 1.25];

const KNOWN_APP_IDS = new Set<AppId>(APP_ORDER);

export function normalizeTaskbarPinnedAppIds(
  value: unknown,
  fallback: readonly AppId[] = PINNED_APPS,
): AppId[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set<AppId>();
  const normalized: AppId[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !KNOWN_APP_IDS.has(entry as AppId)) continue;
    const id = entry as AppId;
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  const hasPinPreference =
    s != null &&
    Object.prototype.hasOwnProperty.call(s, "taskbarPinnedAppIds") &&
    s.taskbarPinnedAppIds !== undefined;
  const taskbarPinnedAppIds = hasPinPreference
    ? normalizeTaskbarPinnedAppIds(s.taskbarPinnedAppIds, [])
    : undefined;
  if (taskbarPinnedAppIds === undefined) {
    delete (merged as Partial<Settings>).taskbarPinnedAppIds;
    return merged;
  }
  return { ...merged, taskbarPinnedAppIds };
}

interface SettingsStore extends Settings {
  hydrate: (s: Partial<Settings> | undefined) => void;
  update: (patch: Partial<Settings>) => void;
}

function persistSettings(state: SettingsStore): void {
  const { theme, uiScale, reducedMotion, notificationsEnabled, taskbarPinnedAppIds } = state;
  const payload: Settings = {
    theme,
    uiScale,
    reducedMotion,
    notificationsEnabled,
    ...(taskbarPinnedAppIds !== undefined ? { taskbarPinnedAppIds } : {}),
  };
  debouncedSave("prefs", "settings", payload, 200);
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrate: (s) => set(normalizeSettings(s)),
  update: (patch) => {
    const normalizedPatch: Partial<Settings> = { ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, "taskbarPinnedAppIds")) {
      normalizedPatch.taskbarPinnedAppIds = normalizeTaskbarPinnedAppIds(
        patch.taskbarPinnedAppIds,
        [],
      );
    }
    set(normalizedPatch);
    persistSettings(get());
  },
}));

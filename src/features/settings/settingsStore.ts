import { create } from "zustand";
import { debouncedSave } from "@/services/persistence/saveStatus";

export type ThemeName = "dark" | "light";

export interface Settings {
  theme: ThemeName;
  uiScale: number;
  reducedMotion: boolean;
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  uiScale: 1,
  reducedMotion: false,
  notificationsEnabled: true,
};

export const UI_SCALES = [0.9, 1, 1.1, 1.25];

interface SettingsStore extends Settings {
  hydrate: (s: Partial<Settings> | undefined) => void;
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrate: (s) => set({ ...DEFAULT_SETTINGS, ...(s ?? {}) }),
  update: (patch) => {
    set(patch);
    const { theme, uiScale, reducedMotion, notificationsEnabled } = get();
    debouncedSave("prefs", "settings", { theme, uiScale, reducedMotion, notificationsEnabled }, 200);
  },
}));

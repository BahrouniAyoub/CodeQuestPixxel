import type { IconName } from "@/shared/components/PixelIcon";

export type AppId =
  "tickets" | "editor" | "chat" | "browser" | "progress" | "settings" | "terminal" | "explorer";

export interface AppDefinition {
  id: AppId;
  title: string;
  shortTitle: string;
  description: string;
  icon: IconName;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  /** Shown on desktop / taskbar */
  pinned: boolean;
  comingSoon?: boolean;
}

/**
 * Typed application registry. New apps (Terminal, File Explorer, …) are added
 * here plus a component entry in app/appComponents.tsx — the desktop,
 * taskbar, start menu and window manager pick them up automatically.
 */
export const APPS: Record<AppId, AppDefinition> = {
  tickets: {
    id: "tickets",
    title: "My Tickets",
    shortTitle: "Tickets",
    description: "Your assigned coding tickets",
    icon: "tickets",
    defaultSize: { width: 820, height: 520 },
    minSize: { width: 560, height: 360 },
    pinned: true,
  },
  editor: {
    id: "editor",
    title: "Code Editor",
    shortTitle: "Editor",
    description: "Write and run Python",
    icon: "editor",
    defaultSize: { width: 900, height: 580 },
    minSize: { width: 600, height: 400 },
    pinned: true,
  },
  chat: {
    id: "chat",
    title: "Team Chat",
    shortTitle: "Chat",
    description: "Talk with your team",
    icon: "chat",
    defaultSize: { width: 700, height: 480 },
    minSize: { width: 480, height: 320 },
    pinned: true,
  },
  browser: {
    id: "browser",
    title: "Browser",
    shortTitle: "Browser",
    description: "Visit CodeQuest websites",
    icon: "browser",
    defaultSize: { width: 880, height: 560 },
    minSize: { width: 520, height: 360 },
    pinned: true,
  },
  progress: {
    id: "progress",
    title: "Progress",
    shortTitle: "Progress",
    description: "XP, level and achievements",
    icon: "progress",
    defaultSize: { width: 680, height: 500 },
    minSize: { width: 480, height: 360 },
    pinned: true,
  },
  settings: {
    id: "settings",
    title: "Settings",
    shortTitle: "Settings",
    description: "Appearance, notifications, data",
    icon: "settings",
    defaultSize: { width: 600, height: 480 },
    minSize: { width: 440, height: 340 },
    pinned: true,
  },
  terminal: {
    id: "terminal",
    title: "Terminal",
    shortTitle: "Terminal",
    description: "Filesystem command line",
    icon: "terminal",
    defaultSize: { width: 520, height: 320 },
    minSize: { width: 360, height: 240 },
    pinned: false,
  },
  explorer: {
    id: "explorer",
    title: "File Explorer",
    shortTitle: "Files",
    description: "Browse and edit local files",
    icon: "explorer",
    defaultSize: { width: 520, height: 320 },
    minSize: { width: 360, height: 240 },
    pinned: false,
  },
};

export const APP_ORDER: AppId[] = [
  "tickets",
  "editor",
  "chat",
  "browser",
  "progress",
  "settings",
  "terminal",
  "explorer",
];
export const PINNED_APPS: AppId[] = APP_ORDER.filter((id) => APPS[id].pinned);

export function searchApps(query: string): AppDefinition[] {
  const q = query.trim().toLowerCase();
  const all = APP_ORDER.map((id) => APPS[id]);
  if (!q) return all;
  return all.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.shortTitle.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q),
  );
}

import { create } from "zustand";
import { useSettings } from "@/features/settings/settingsStore";

export type NotificationKind = "success" | "error" | "warning" | "info";

export interface OsNotification {
  id: number;
  kind: NotificationKind;
  title: string;
  message?: string;
  createdAt: number;
}

interface NotificationStore {
  toasts: OsNotification[];
  history: OsNotification[];
  unseen: number;
  push: (n: Omit<OsNotification, "id" | "createdAt">) => void;
  dismiss: (id: number) => void;
  markSeen: () => void;
  clearHistory: () => void;
}

let seq = 0;
const recent = new Map<string, number>();

export const useNotifications = create<NotificationStore>((set, get) => ({
  toasts: [],
  history: [],
  unseen: 0,
  push: (n) => {
    // Errors are always shown so failures are never hidden.
    if (!useSettings.getState().notificationsEnabled && n.kind !== "error") return;
    const key = `${n.kind}:${n.title}:${n.message ?? ""}`;
    const now = Date.now();
    if ((recent.get(key) ?? 0) > now - 3000) return; // avoid spam
    recent.set(key, now);
    const item: OsNotification = { ...n, id: ++seq, createdAt: now };
    set((s) => ({
      toasts: [...s.toasts, item].slice(-4),
      history: [item, ...s.history].slice(0, 30),
      unseen: s.unseen + 1,
    }));
    const ttl = n.kind === "error" ? 8000 : 5000;
    setTimeout(() => get().dismiss(item.id), ttl);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  markSeen: () => set({ unseen: 0 }),
  clearHistory: () => set({ history: [], unseen: 0 }),
}));

export const notify = (n: Omit<OsNotification, "id" | "createdAt">) => useNotifications.getState().push(n);

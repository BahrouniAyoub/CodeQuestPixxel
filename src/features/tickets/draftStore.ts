import { create } from "zustand";
import { TICKETS_BY_ID, type TicketId } from "@/features/tickets/data/tickets";
import { debouncedSave } from "@/services/persistence/saveStatus";

export type DraftSaveState = "saved" | "unsaved" | "saving" | "error";

interface DraftStore {
  drafts: Partial<Record<TicketId, string>>;
  saveState: Partial<Record<TicketId, DraftSaveState>>;
  hydrate: (d: Partial<Record<TicketId, string>>) => void;
  getCode: (id: TicketId) => string;
  setCode: (id: TicketId, code: string) => void;
  resetToStarter: (id: TicketId) => void;
}

export const useDrafts = create<DraftStore>((set, get) => ({
  drafts: {},
  saveState: {},
  hydrate: (d) => set({ drafts: d }),
  getCode: (id) => get().drafts[id] ?? TICKETS_BY_ID[id].starterCode,
  setCode: (id, code) => {
    set((s) => ({ drafts: { ...s.drafts, [id]: code }, saveState: { ...s.saveState, [id]: "unsaved" } }));
    debouncedSave("drafts", id, code, 600, (ok) =>
      set((s) => ({ saveState: { ...s.saveState, [id]: ok ? "saved" : "error" } })),
    );
  },
  resetToStarter: (id) => get().setCode(id, TICKETS_BY_ID[id].starterCode),
}));

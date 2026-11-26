import { create } from "zustand";
import { TICKETS_BY_ID, isActiveTicketId, isLegacyTicketId, type TicketId } from "@/features/tickets/data/tickets";
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

function sanitizeDrafts(d: Partial<Record<TicketId, string>> | undefined): Partial<Record<TicketId, string>> {
  if (!d || typeof d !== "object") return {};
  const out: Partial<Record<TicketId, string>> = {};
  for (const [id, code] of Object.entries(d)) {
    if (typeof id !== "string" || typeof code !== "string") continue;
    if (isLegacyTicketId(id) || !isActiveTicketId(id)) continue;
    out[id] = code;
  }
  return out;
}

export const useDrafts = create<DraftStore>((set, get) => ({
  drafts: {},
  saveState: {},
  hydrate: (d) => set({ drafts: sanitizeDrafts(d) }),
  getCode: (id) => {
    const ticket = TICKETS_BY_ID[id];
    if (!ticket) return "";
    return get().drafts[id] ?? ticket.starterCode;
  },
  setCode: (id, code) => {
    if (!isActiveTicketId(id) || isLegacyTicketId(id)) return;
    set((s) => ({ drafts: { ...s.drafts, [id]: code }, saveState: { ...s.saveState, [id]: "unsaved" } }));
    debouncedSave("drafts", id, code, 600, (ok) =>
      set((s) => ({ saveState: { ...s.saveState, [id]: ok ? "saved" : "error" } })),
    );
  },
  resetToStarter: (id) => {
    const ticket = TICKETS_BY_ID[id];
    if (!ticket) return;
    get().setCode(id, ticket.starterCode);
  },
}));

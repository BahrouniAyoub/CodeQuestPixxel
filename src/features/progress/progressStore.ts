import { create } from "zustand";
import { TICKETS_BY_ID, type TicketId } from "@/features/tickets/data/tickets";
import { trackedSave } from "@/services/persistence/saveStatus";
import type { TestSuiteResult } from "@/services/runner/testing";
import { notify } from "@/features/notifications/notificationStore";
import { useChat } from "@/features/chat/chatStore";
import { COMPLETION_MESSAGES } from "@/features/chat/chatData";
import { applyVerifiedCompletion, nextTicketAfter, type CompletionAttempt, type Completions } from "./progressLogic";

export interface ProgressPersisted {
  version: 1;
  completions: Completions;
  currentTicketId: TicketId;
  started: TicketId[];
}

interface ProgressStore extends ProgressPersisted {
  celebrate: number;
  hydrate: (p: ProgressPersisted | undefined) => void;
  setCurrentTicket: (id: TicketId) => void;
  markStarted: (id: TicketId) => void;
  submitVerified: (id: TicketId, suite: TestSuiteResult) => Promise<CompletionAttempt>;
  reset: () => Promise<void>;
}

const submissionLocks = new Set<TicketId>();

const INITIAL: ProgressPersisted = { version: 1, completions: {}, currentTicketId: "CQ-001", started: [] };

function snapshot(s: ProgressPersisted): ProgressPersisted {
  return { version: 1, completions: s.completions, currentTicketId: s.currentTicketId, started: s.started };
}

export const useProgress = create<ProgressStore>((set, get) => ({
  ...INITIAL,
  celebrate: 0,
  hydrate: (p) => {
    if (p && p.version === 1) set({ completions: p.completions ?? {}, currentTicketId: p.currentTicketId ?? "CQ-001", started: p.started ?? [] });
  },
  setCurrentTicket: (id) => {
    set({ currentTicketId: id });
    void trackedSave("progress", "state", snapshot(get()));
  },
  markStarted: (id) => {
    if (get().started.includes(id)) return;
    set((s) => ({ started: [...s.started, id] }));
    void trackedSave("progress", "state", snapshot(get()));
  },
  submitVerified: async (id, suite) => {
    if (submissionLocks.has(id)) return { completions: get().completions, awarded: false, xpAwarded: 0, reason: "already-completed" };
    submissionLocks.add(id);
    try {
    const before = get().completions;
    const attempt = applyVerifiedCompletion(before, id, suite);
    if (!attempt.awarded) return attempt;
    set({ completions: attempt.completions });
    const ok = await trackedSave("progress", "state", snapshot(get()));
    if (!ok) {
      notify({ kind: "error", title: "Progress not saved", message: "Your completion could not be stored. It will be lost on refresh." });
    }
    set((s) => ({ celebrate: s.celebrate + 1 }));
    notify({ kind: "success", title: `${id} completed!`, message: `+${attempt.xpAwarded} XP — ${TICKETS_BY_ID[id].title}` });
    const next = nextTicketAfter(id);
    if (next) notify({ kind: "info", title: `Ticket unlocked: ${next}`, message: TICKETS_BY_ID[next].title });
    COMPLETION_MESSAGES[id].forEach((m) => useChat.getState().post(m.channel, m.author, m.text));
    return attempt;
    } finally { submissionLocks.delete(id); }
  },
  reset: async () => {
    set({ ...INITIAL });
    await trackedSave("progress", "state", snapshot(get()));
  },
}));

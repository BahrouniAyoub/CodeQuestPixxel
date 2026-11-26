import { create } from "zustand";
import { TICKETS, TICKETS_BY_ID, isActiveTicketId, type TicketId } from "@/features/tickets/data/tickets";
import { trackedSave } from "@/services/persistence/saveStatus";
import type { TestSuiteResult } from "@/services/runner/testing";
import { notify } from "@/features/notifications/notificationStore";
import { useChat } from "@/features/chat/chatStore";
import { COMPLETION_MESSAGES } from "@/features/chat/chatData";
import {
  applyVerifiedCompletion,
  nextTicketAfter,
  sanitizeCompletions,
  sanitizeCurrentTicketId,
  sanitizeStarted,
  type CompletionAttempt,
  type Completions,
} from "./progressLogic";

export interface ProgressPersisted {
  version: 1;
  completions: Completions;
  currentTicketId: TicketId | null;
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

function defaultCurrentTicketId(completions: Completions): TicketId | null {
  const first = TICKETS.find((t) => !completions[t.id]);
  return first?.id ?? TICKETS[0]?.id ?? null;
}

const INITIAL: ProgressPersisted = {
  version: 1,
  completions: {},
  currentTicketId: defaultCurrentTicketId({}),
  started: [],
};

function snapshot(s: ProgressPersisted): ProgressPersisted {
  return { version: 1, completions: s.completions, currentTicketId: s.currentTicketId, started: s.started };
}

export const useProgress = create<ProgressStore>((set, get) => ({
  ...INITIAL,
  celebrate: 0,
  hydrate: (p) => {
    if (!p || p.version !== 1) return;
    const completions = sanitizeCompletions(p.completions);
    const started = sanitizeStarted(p.started);
    const currentTicketId = sanitizeCurrentTicketId(p.currentTicketId, completions);
    set({ completions, currentTicketId, started });
  },
  setCurrentTicket: (id) => {
    if (!isActiveTicketId(id)) return;
    set({ currentTicketId: id });
    void trackedSave("progress", "state", snapshot(get()));
  },
  markStarted: (id) => {
    if (!isActiveTicketId(id) || get().started.includes(id)) return;
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
      const ticket = TICKETS_BY_ID[id];
      if (ticket) {
        notify({ kind: "success", title: `${id} completed!`, message: `+${attempt.xpAwarded} XP — ${ticket.title}` });
      }
      const next = nextTicketAfter(id);
      if (next) {
        const nextTicket = TICKETS_BY_ID[next];
        if (nextTicket) notify({ kind: "info", title: `Ticket unlocked: ${next}`, message: nextTicket.title });
      }
      const messages = COMPLETION_MESSAGES[id];
      if (messages) messages.forEach((m) => useChat.getState().post(m.channel, m.author, m.text));
      return attempt;
    } finally {
      submissionLocks.delete(id);
    }
  },
  reset: async () => {
    set({ ...INITIAL, completions: {}, currentTicketId: defaultCurrentTicketId({}), started: [] });
    await trackedSave("progress", "state", snapshot(get()));
  },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/persistence/saveStatus", () => ({
  trackedSave: vi.fn(async () => true),
  debouncedSave: vi.fn(),
}));

vi.mock("@/features/notifications/notificationStore", () => ({ notify: vi.fn() }));
vi.mock("@/features/chat/chatStore", () => ({ useChat: { getState: () => ({ post: vi.fn() }) } }));

import { useProgress } from "./progressStore";

describe("progressStore legacy ticket sanitization", () => {
  beforeEach(() => {
    useProgress.setState({
      completions: {},
      currentTicketId: null,
      started: [],
      celebrate: 0,
    } as never);
  });

  it("drops removed CQ ticket IDs on hydrate", () => {
    useProgress.getState().hydrate({
      version: 1,
      completions: {
        "CQ-001": { ticketId: "CQ-001", completedAt: 1 },
        "CQ-003": { ticketId: "CQ-003", completedAt: 2 },
      } as never,
      currentTicketId: "CQ-001" as never,
      started: ["CQ-001", "CQ-002"] as never,
    });

    const state = useProgress.getState();
    expect(state.completions).toEqual({});
    expect(state.currentTicketId).toBeNull();
    expect(state.started).toEqual([]);
  });
});

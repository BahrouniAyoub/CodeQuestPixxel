import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/persistence/saveStatus", () => ({
  trackedSave: vi.fn(async () => true),
  debouncedSave: vi.fn(),
}));

import { useDrafts } from "./draftStore";

describe("draftStore legacy ticket sanitization", () => {
  beforeEach(() => {
    useDrafts.setState({ drafts: {}, saveState: {} });
  });

  it("ignores legacy CQ drafts on hydrate", () => {
    useDrafts.getState().hydrate({
      "CQ-001": "print('old')",
      "CQ-005": "print('old2')",
    } as never);

    expect(useDrafts.getState().drafts).toEqual({});
  });

  it("does not expose code for removed ticket IDs", () => {
    expect(useDrafts.getState().getCode("CQ-001" as never)).toBe("");
  });
});

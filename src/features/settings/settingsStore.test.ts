import { beforeEach, describe, expect, it, vi } from "vitest";
import { PINNED_APPS } from "@/core/applications/registry";

vi.mock("@/services/persistence/saveStatus", () => ({
  debouncedSave: vi.fn(),
}));

import { DEFAULT_SETTINGS, normalizeTaskbarPinnedAppIds, useSettings } from "./settingsStore";

describe("settingsStore taskbar pinning", () => {
  beforeEach(() => {
    useSettings.setState({ ...DEFAULT_SETTINGS });
  });

  it("uses registry defaults when preference is missing", () => {
    expect(normalizeTaskbarPinnedAppIds(undefined)).toEqual(PINNED_APPS);
    useSettings.getState().hydrate({ theme: "dark" });
    expect(useSettings.getState().taskbarPinnedAppIds).toBeUndefined();
  });

  it("respects an explicit empty pin preference", () => {
    expect(normalizeTaskbarPinnedAppIds([])).toEqual([]);
    useSettings.getState().hydrate({ taskbarPinnedAppIds: [] });
    expect(useSettings.getState().taskbarPinnedAppIds).toEqual([]);
  });

  it("removes invalid IDs and deduplicates while preserving order", () => {
    useSettings.getState().hydrate({
      taskbarPinnedAppIds: ["editor", "not-an-app", "editor", "browser", "browser"] as any,
    });
    expect(useSettings.getState().taskbarPinnedAppIds).toEqual(["editor", "browser"]);
  });

  it("normalizes updates and appends pins through update", () => {
    useSettings.getState().update({ taskbarPinnedAppIds: ["editor"] });
    expect(useSettings.getState().taskbarPinnedAppIds).toEqual(["editor"]);
    useSettings.getState().update({ taskbarPinnedAppIds: ["editor", "terminal"] });
    expect(useSettings.getState().taskbarPinnedAppIds).toEqual(["editor", "terminal"]);
  });
});

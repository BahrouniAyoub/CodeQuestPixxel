import { describe, expect, it } from "vitest";
import { APP_ORDER, PINNED_APPS, type AppId } from "@/core/applications/registry";
import { createInitialState } from "@/core/windows/windowReducer";
import { deriveTaskbarItems, getEffectiveTaskbarPinnedAppIds } from "./taskbarModel";

const bounds = { width: 1280, height: 720 };

function openApps(ids: AppId[], focused: AppId | null = null) {
  const base = createInitialState(bounds);
  const windows = { ...base.windows };
  for (const id of ids) {
    windows[id] = { ...windows[id], open: true, minimized: false };
  }
  if (focused) {
    for (const id of ids) {
      windows[id] = { ...windows[id], minimized: false };
    }
  }
  return { windows, focused };
}

describe("taskbarModel", () => {
  it("uses registry default pins when preference is missing", () => {
    expect(getEffectiveTaskbarPinnedAppIds(undefined)).toEqual(PINNED_APPS);
  });

  it("respects an explicit empty pin preference", () => {
    expect(getEffectiveTaskbarPinnedAppIds([])).toEqual([]);
  });

  it("shows pinned apps whether open or closed and includes open unpinned apps once", () => {
    const { windows, focused } = openApps(["terminal", "editor"], "editor");
    const items = deriveTaskbarItems(windows, focused, undefined);

    expect(items.map((i) => i.id)).toEqual([
      ...PINNED_APPS,
      "terminal",
    ]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items.find((i) => i.id === "editor")?.state).toBe("focused");
    expect(items.find((i) => i.id === "terminal")?.state).toBe("running");
    expect(items.find((i) => i.id === "tickets")?.state).toBe("closed-pinned");
  });

  it("keeps open unpinned apps in deterministic APP_ORDER", () => {
    const { windows } = openApps(["explorer", "terminal"]);
    windows.explorer = { ...windows.explorer, open: true };
    windows.terminal = { ...windows.terminal, open: true };
    const items = deriveTaskbarItems(windows, null, undefined);
    const unpinnedOpen = items.filter((i) => !i.pinned).map((i) => i.id);
    expect(unpinnedOpen).toEqual(
      APP_ORDER.filter((id) => ["terminal", "explorer"].includes(id) && !PINNED_APPS.includes(id)),
    );
  });

  it("marks minimized and focused states distinctly", () => {
    const base = createInitialState(bounds);
    const windows = { ...base.windows };
    windows.editor = { ...windows.editor, open: true, minimized: true };
    windows.browser = { ...windows.browser, open: true, minimized: false };
    const items = deriveTaskbarItems(windows, "browser", undefined);

    expect(items.find((i) => i.id === "editor")?.state).toBe("minimized");
    expect(items.find((i) => i.id === "browser")?.state).toBe("focused");
  });

  it("removes closed unpinned apps and keeps closed pinned apps", () => {
    const base = createInitialState(bounds);
    const windows = { ...base.windows };
    windows.terminal = { ...windows.terminal, open: false };
    windows.tickets = { ...windows.tickets, open: false };
    const items = deriveTaskbarItems(windows, null, undefined);

    expect(items.some((i) => i.id === "terminal")).toBe(false);
    expect(items.find((i) => i.id === "tickets")?.state).toBe("closed-pinned");
  });

  it("does not duplicate an app when pinned and open", () => {
    const { windows } = openApps(["editor"]);
    const items = deriveTaskbarItems(windows, "editor", ["editor", "browser"]);
    expect(items.filter((i) => i.id === "editor")).toHaveLength(1);
  });
});

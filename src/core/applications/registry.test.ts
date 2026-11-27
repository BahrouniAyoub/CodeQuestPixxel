import { describe, expect, it } from "vitest";
import { APPS, APP_ORDER, PINNED_APPS, START_PINNED_APPS, searchApps } from "./registry";

describe("application registry", () => {
  it("keeps the Start pin order independent of desktop/taskbar pinning", () => {
    expect(START_PINNED_APPS).toEqual([
      "browser",
      "mail",
      "editor",
      "explorer",
      "chat",
      "tickets",
      "terminal",
      "progress",
      "journal",
      "settings",
    ]);
    expect(new Set(START_PINNED_APPS).size).toBe(APP_ORDER.length);
    expect(APP_ORDER.every((id) => START_PINNED_APPS.includes(id))).toBe(true);

    expect(PINNED_APPS).toEqual(APP_ORDER.filter((id) => APPS[id].pinned));
    expect(APPS.terminal.pinned).toBe(false);
    expect(APPS.explorer.pinned).toBe(false);
  });

  it("searches applications by ID, title, short title, and description only", () => {
    expect(searchApps("").map((app) => app.id)).toEqual(APP_ORDER);
    expect(searchApps("  ").map((app) => app.id)).toEqual(APP_ORDER);
    expect(searchApps("explorer").map((app) => app.id)).toEqual(["explorer"]);
    expect(searchApps("code editor").map((app) => app.id)).toEqual(["editor"]);
    expect(searchApps("mission").map((app) => app.id)).toEqual(["journal"]);
    expect(searchApps("no such application")).toEqual([]);
  });
});

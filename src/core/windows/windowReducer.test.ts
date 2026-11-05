import { describe, expect, it } from "vitest";
import { createInitialState, windowReducer } from "./windowReducer";

const bounds = { width: 1280, height: 672 };

describe("window manager", () => {
  it("opens, focuses and stacks windows", () => {
    let s = createInitialState(bounds);
    s = windowReducer(s, { type: "OPEN", id: "tickets", bounds });
    s = windowReducer(s, { type: "OPEN", id: "editor", bounds });
    expect(s.focused).toBe("editor");
    s = windowReducer(s, { type: "FOCUS", id: "tickets" });
    expect(s.order[s.order.length - 1]).toBe("tickets");
  });

  it("taskbar click minimizes the focused window and restores a minimized one", () => {
    let s = createInitialState(bounds);
    s = windowReducer(s, { type: "TASKBAR_CLICK", id: "chat", bounds });
    expect(s.windows.chat.open).toBe(true);
    s = windowReducer(s, { type: "TASKBAR_CLICK", id: "chat", bounds });
    expect(s.windows.chat.minimized).toBe(true);
    s = windowReducer(s, { type: "TASKBAR_CLICK", id: "chat", bounds });
    expect(s.windows.chat.minimized).toBe(false);
    expect(s.focused).toBe("chat");
  });

  it("keeps windows inside the desktop", () => {
    let s = createInitialState(bounds);
    s = windowReducer(s, { type: "SET_GEOMETRY", id: "settings", geometry: { x: 5000, y: -300 }, bounds });
    expect(s.windows.settings.y).toBe(0);
    expect(s.windows.settings.x).toBeLessThan(bounds.width);
  });
});

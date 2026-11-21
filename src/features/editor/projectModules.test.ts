import { describe, expect, it } from "vitest";
import {
  getSiblingModuleName,
  loadSiblingProjectModules,
  type ProjectModuleFileSystem,
} from "./projectModules";

interface FakeEntry {
  path: string;
  kind: "file" | "dir";
  content?: string;
}

function fileSystem(entries: FakeEntry[]): ProjectModuleFileSystem {
  return {
    listEntries: async () => entries,
    getEntry: async (path) => entries.find((entry) => entry.path === path),
  };
}

describe("editor project modules", () => {
  it("accepts only importable Python file names", () => {
    expect(getSiblingModuleName("calculator.py")).toBe("calculator");
    expect(getSiblingModuleName("helpers_2.py")).toBe("helpers_2");
    expect(getSiblingModuleName("my-module.py")).toBeNull();
    expect(getSiblingModuleName("2helpers.py")).toBeNull();
    expect(getSiblingModuleName("README.md")).toBeNull();
    expect(getSiblingModuleName(".py")).toBeNull();
  });

  it("loads sibling .py files and excludes the program itself", async () => {
    const fs = fileSystem([
      { path: "/Projects/Python/cafe-calculator/main.py", kind: "file", content: "main" },
      {
        path: "/Projects/Python/cafe-calculator/calculator.py",
        kind: "file",
        content: "calculator",
      },
      { path: "/Projects/Python/cafe-calculator/README.md", kind: "file", content: "docs" },
      { path: "/Projects/Python/cafe-calculator/my-module.py", kind: "file", content: "bad" },
      { path: "/Projects/Python/cafe-calculator/tests", kind: "dir" },
    ]);

    const modules = await loadSiblingProjectModules({
      currentPath: "/Projects/Python/cafe-calculator/main.py",
      fileSystem: fs,
    });

    expect(modules).toEqual([{ name: "calculator", content: "calculator" }]);
  });

  it("sorts modules by import name for deterministic runs", async () => {
    const fs = fileSystem([
      { path: "/Projects/Python/lib/zeta.py", kind: "file", content: "z" },
      { path: "/Projects/Python/lib/main.py", kind: "file", content: "m" },
      { path: "/Projects/Python/lib/alpha.py", kind: "file", content: "a" },
    ]);

    const modules = await loadSiblingProjectModules({
      currentPath: "/Projects/Python/lib/main.py",
      fileSystem: fs,
    });

    expect(modules.map((module) => module.name)).toEqual(["alpha", "zeta"]);
  });

  it("uses the saved file contents rather than a stale directory listing", async () => {
    const fs: ProjectModuleFileSystem = {
      listEntries: async () => [
        { path: "/Projects/Python/lib/calculator.py", kind: "file", content: "stale" },
      ],
      getEntry: async (path) => ({
        path,
        kind: "file",
        content: "fresh saved code",
      }),
    };

    const modules = await loadSiblingProjectModules({
      currentPath: "/Projects/Python/lib/main.py",
      fileSystem: fs,
    });

    expect(modules).toEqual([{ name: "calculator", content: "fresh saved code" }]);
  });

  it("returns no modules when the folder is unavailable", async () => {
    const fs: ProjectModuleFileSystem = {
      listEntries: async () => {
        throw new Error("Folder not found");
      },
      getEntry: async () => undefined,
    };

    await expect(
      loadSiblingProjectModules({ currentPath: "/missing/main.py", fileSystem: fs }),
    ).resolves.toEqual([]);
  });
});

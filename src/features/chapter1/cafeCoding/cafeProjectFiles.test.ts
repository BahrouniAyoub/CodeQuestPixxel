import { describe, expect, it, vi } from "vitest";
import type { FsEntry } from "@/services/filesystem/types";
import { CAFE_MILESTONES } from "./cafeMilestones";
import {
  ensureCafeMilestoneFiles,
  isCafeMilestoneFilePath,
  type CafeMilestoneFileSystem,
} from "./cafeProjectFiles";

function file(path: string, content: string): FsEntry {
  return { path, kind: "file", content, updatedAt: 0 };
}

function makeFileSystem(entries: FsEntry[] = []) {
  const files = new Map(entries.map((entry) => [entry.path, entry]));
  const getEntry = vi.fn(async (path: string) => files.get(path));
  const createEntry = vi.fn(async (path: string, kind: "file" | "dir", content = "") => {
    files.set(path, { path, kind, content, updatedAt: 0 });
  });
  const fileSystem: CafeMilestoneFileSystem = { getEntry, createEntry };
  return { fileSystem, files, getEntry, createEntry };
}

describe("café project files", () => {
  it("creates the three milestone files with starter code when missing", async () => {
    const h = makeFileSystem();

    const result = await ensureCafeMilestoneFiles(h.fileSystem);

    expect(result.ok).toBe(true);
    expect(h.createEntry).toHaveBeenCalledTimes(3);
    for (const milestone of CAFE_MILESTONES) {
      expect(h.files.get(milestone.filePath)?.content).toBe(milestone.starterCode);
    }
  });

  it("never overwrites existing student code", async () => {
    const existing = CAFE_MILESTONES.map((milestone) =>
      file(milestone.filePath, `# saved work for ${milestone.id}`),
    );
    const h = makeFileSystem(existing);

    const result = await ensureCafeMilestoneFiles(h.fileSystem);

    expect(result.ok).toBe(true);
    expect(h.createEntry).not.toHaveBeenCalled();
    for (const milestone of CAFE_MILESTONES) {
      expect(h.files.get(milestone.filePath)?.content).toBe(`# saved work for ${milestone.id}`);
    }
  });

  it("creates only missing files while preserving the rest", async () => {
    const first = CAFE_MILESTONES[0]!;
    const h = makeFileSystem([file(first.filePath, "# my milestone 1")]);

    await ensureCafeMilestoneFiles(h.fileSystem);

    expect(h.createEntry).toHaveBeenCalledTimes(2);
    expect(h.files.get(first.filePath)?.content).toBe("# my milestone 1");
    expect(h.files.get(CAFE_MILESTONES[1]!.filePath)?.content).toBe(
      CAFE_MILESTONES[1]!.starterCode,
    );
  });

  it("refuses to use a folder at a milestone file path", async () => {
    const first = CAFE_MILESTONES[0]!;
    const h = makeFileSystem([{ path: first.filePath, kind: "dir", updatedAt: 0 }]);

    const result = await ensureCafeMilestoneFiles(h.fileSystem);

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain(first.displayFileName);
  });

  it("recognizes only the matching normalized milestone path", () => {
    expect(isCafeMilestoneFilePath(CAFE_MILESTONES[0]!.filePath, "variables-print")).toBe(true);
    expect(isCafeMilestoneFilePath("Projects/Python/cafe_milestone_1.py", "variables-print")).toBe(
      true,
    );
    expect(isCafeMilestoneFilePath(CAFE_MILESTONES[1]!.filePath, "variables-print")).toBe(false);
    expect(isCafeMilestoneFilePath(null, "variables-print")).toBe(false);
  });
});

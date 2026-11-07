import { useWindows } from "@/core/windows/windowStore";
import { useFileSession } from "@/features/editor/fileSession";
import { createEntry, getEntry, normalizePath } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import { CAFE_MILESTONES, getCafeMilestone, type CafeMilestoneId } from "./cafeMilestones";
import { getCurrentCafeMilestone } from "./cafeMilestoneProgress";
import { useCafeMilestones } from "./cafeMilestoneStore";

export interface CafeMilestoneFileSystem {
  getEntry: (path: string) => Promise<FsEntry | undefined>;
  createEntry: (path: string, kind: "file" | "dir", content?: string) => Promise<void>;
}

export type EnsureCafeFilesResult =
  { ok: true; paths: Readonly<Record<CafeMilestoneId, string>> } | { ok: false; reason: string };

const realFileSystem: CafeMilestoneFileSystem = { getEntry, createEntry };

/**
 * Create the three milestone files if they do not exist. Existing files are
 * never overwritten, so a reload or a second project launch preserves all
 * student code.
 */
export async function ensureCafeMilestoneFiles(
  fileSystem: CafeMilestoneFileSystem = realFileSystem,
): Promise<EnsureCafeFilesResult> {
  const paths = {} as Record<CafeMilestoneId, string>;

  for (const milestone of CAFE_MILESTONES) {
    const path = normalizePath(milestone.filePath);
    const existing = await fileSystem.getEntry(path);

    if (!existing) {
      await fileSystem.createEntry(path, "file", milestone.starterCode);
    } else if (existing.kind !== "file") {
      return {
        ok: false,
        reason: `Cannot use ${milestone.displayFileName}: that path is a folder.`,
      };
    }

    paths[milestone.id] = path;
  }

  return { ok: true, paths };
}

export type OpenCafeProjectResult = { ok: true; path: string } | { ok: false; reason: string };

/** Ensure and open one milestone file in the existing editor window. */
export async function openCafeMilestoneInEditor(
  milestoneId: CafeMilestoneId,
): Promise<OpenCafeProjectResult> {
  const ensured = await ensureCafeMilestoneFiles();
  if (!ensured.ok) return ensured;

  const path = ensured.paths[milestoneId];
  if (!useFileSession.getState().openFile(path)) {
    return {
      ok: false,
      reason:
        "Your current file has unsaved changes. Save or discard them, then open the project again.",
    };
  }

  useWindows.getState().open("editor");
  return { ok: true, path };
}

/**
 * Small public adapter for GigBoard. It hydrates milestone progress first so
 * "Open Project in Editor" opens the student's current milestone rather than
 * always milestone 1.
 */
export async function openCafeProjectInEditor(): Promise<OpenCafeProjectResult> {
  await useCafeMilestones.getState().hydrate();
  const target =
    getCurrentCafeMilestone(useCafeMilestones.getState().progress) ?? CAFE_MILESTONES[0];
  if (!target) return { ok: false, reason: "The café project has no milestone files." };
  return openCafeMilestoneInEditor(target.id);
}

export function isCafeMilestoneFilePath(
  filePath: string | null,
  milestoneId: CafeMilestoneId,
): boolean {
  if (!filePath) return false;
  return normalizePath(filePath) === normalizePath(getCafeMilestone(milestoneId).filePath);
}

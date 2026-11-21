import { useWindows } from "@/core/windows/windowStore";
import { useFileSession } from "@/features/editor/fileSession";
import { getEntry, normalizePath } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import {
  cafeDevFilePath,
  getCafeDevTask,
  type CafeDevFileContents,
  type CafeDevFileName,
  type CafeDevTaskId,
  type CafeDevTaskDefinition,
} from "./cafeDevTasks";

export interface CafeDevFileSystem {
  getEntry: (path: string) => Promise<FsEntry | undefined>;
}

const realFileSystem: CafeDevFileSystem = { getEntry };

export type CafeDevReadFilesResult =
  | { ok: true; files: Record<CafeDevFileName, string> }
  | {
      ok: false;
      kind: "missing-file" | "not-a-file";
      fileName: CafeDevFileName;
      reason: string;
    };

/**
 * Read every saved file required by a task. Verification never falls back to an
 * unsaved editor buffer and never creates a missing file.
 */
export async function readCafeDevTaskFiles(
  task: Pick<CafeDevTaskDefinition, "files">,
  fileSystem: CafeDevFileSystem = realFileSystem,
): Promise<CafeDevReadFilesResult> {
  const contents = {} as Record<CafeDevFileName, string>;

  for (const fileName of task.files) {
    const path = normalizePath(cafeDevFilePath(fileName));
    const entry = await fileSystem.getEntry(path);

    if (!entry) {
      return {
        ok: false,
        kind: "missing-file",
        fileName,
        reason: `${fileName} was not found. Create it in the project folder and save your code first.`,
      };
    }
    if (entry.kind !== "file") {
      return {
        ok: false,
        kind: "not-a-file",
        fileName,
        reason: `${fileName} is a folder. Recreate it as a Python file.`,
      };
    }

    contents[fileName] = entry.content ?? "";
  }

  return { ok: true, files: contents };
}

/** Build the saved-file map used by the validator for a task. */
export async function loadCafeDevFileContents(
  task: Pick<CafeDevTaskDefinition, "files">,
  fileSystem: CafeDevFileSystem = realFileSystem,
): Promise<CafeDevFileContents | null> {
  const result = await readCafeDevTaskFiles(task, fileSystem);
  return result.ok ? result.files : null;
}

export type OpenCafeDevTaskResult = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Open the task's primary file in the existing editor. Missing files are
 * reported, never recreated, so project code is never overwritten or injected.
 */
export async function openCafeDevTaskInEditor(
  taskId: CafeDevTaskId,
  fileSystem: CafeDevFileSystem = realFileSystem,
): Promise<OpenCafeDevTaskResult> {
  const task = getCafeDevTask(taskId);
  const path = normalizePath(cafeDevFilePath(task.primaryFile));
  const entry = await fileSystem.getEntry(path);

  if (!entry) {
    return {
      ok: false,
      reason: `${task.primaryFile} was not found. Recreate it in /Projects/Python/cafe-calculator with File Explorer.`,
    };
  }
  if (entry.kind !== "file") {
    return { ok: false, reason: `${task.primaryFile} is a folder. Recreate it as a Python file.` };
  }

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

/** True when the editor's open file is one of the task's required files. */
export function isCafeDevTaskFilePath(
  filePath: string | null,
  task: Pick<CafeDevTaskDefinition, "files">,
): boolean {
  if (!filePath) return false;
  const normalized = normalizePath(filePath);
  return task.files.some((fileName) => normalized === normalizePath(cafeDevFilePath(fileName)));
}

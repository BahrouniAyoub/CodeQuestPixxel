import { useWindows } from "@/core/windows/windowStore";
import { useFileSession } from "@/features/editor/fileSession";
import { getEntry, normalizePath } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import { CAFE_DOC_README_PATH } from "./cafeDocTask";

export interface CafeDocFileSystem {
  getEntry: (path: string) => Promise<FsEntry | undefined>;
}

export type OpenCafeDocumentationResult =
  { ok: true; path: string } | { ok: false; reason: string };

/**
 * Open the player's existing README.md in the Editor. The file is never
 * created, templated, or overwritten here.
 */
export async function openCafeDocumentationInEditor(
  fileSystem: CafeDocFileSystem = { getEntry },
): Promise<OpenCafeDocumentationResult> {
  const path = normalizePath(CAFE_DOC_README_PATH);
  const entry = await fileSystem.getEntry(path);

  if (!entry) {
    return {
      ok: false,
      reason:
        "README.md was not found. Recreate it in /Projects/Python/cafe-calculator with File Explorer, then add your documentation.",
    };
  }
  if (entry.kind !== "file") {
    return { ok: false, reason: "README.md is a folder. Recreate it as a text file." };
  }

  if (!useFileSession.getState().openFile(path)) {
    return {
      ok: false,
      reason:
        "Your current file has unsaved changes. Save or discard them, then open README.md again.",
    };
  }

  useWindows.getState().open("editor");
  return { ok: true, path };
}

export function isCafeReadmePath(filePath: string | null): boolean {
  if (!filePath) return false;
  return normalizePath(filePath) === normalizePath(CAFE_DOC_README_PATH);
}

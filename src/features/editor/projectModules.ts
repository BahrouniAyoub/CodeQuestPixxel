/**
 * Load project-local Python files that live next to the file being run.
 *
 * The editor's file mode is used for real projects such as the café calculator,
 * where `main.py` imports `calculator.py`. Only the current saved file is passed
 * as the program; every other valid sibling `.py` file is exposed as an
 * importable module for that single run. Nothing is written to the filesystem.
 */
import {
  baseName,
  getEntry,
  listEntries,
  normalizePath,
  parentPath,
} from "@/services/filesystem/filesystem";
import type { ProjectModule } from "@/services/runner/types";

/** A Python identifier that can be imported with a normal `import` statement. */
const PYTHON_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Convert `calculator.py` to `calculator`, or null when it cannot be imported. */
export function getSiblingModuleName(fileName: string): string | null {
  if (!fileName.endsWith(".py")) return null;
  const name = fileName.slice(0, -".py".length);
  return PYTHON_IDENTIFIER.test(name) ? name : null;
}

export interface ProjectModuleFileSystem {
  listEntries: (
    dir: string,
  ) => Promise<Array<{ path: string; kind: "file" | "dir"; content?: string }>>;
  getEntry: (
    path: string,
  ) => Promise<{ path: string; kind: "file" | "dir"; content?: string } | undefined>;
}

const realFileSystem: ProjectModuleFileSystem = { listEntries, getEntry };

export interface LoadSiblingModulesOptions {
  /** The saved file that will be executed as the program. */
  readonly currentPath: string;
  readonly fileSystem?: ProjectModuleFileSystem;
}

/**
 * Read every importable `.py` sibling of the current file.
 *
 * Missing folders and unreadable entries are ignored: running a single file
 * must keep working exactly as before when there is no project around it.
 */
export async function loadSiblingProjectModules(
  options: LoadSiblingModulesOptions,
): Promise<ProjectModule[]> {
  const fileSystem = options.fileSystem ?? realFileSystem;
  const currentPath = normalizePath(options.currentPath);
  const directory = parentPath(currentPath);
  const currentName = baseName(currentPath);

  let entries: Awaited<ReturnType<ProjectModuleFileSystem["listEntries"]>>;
  try {
    entries = await fileSystem.listEntries(directory);
  } catch {
    return [];
  }

  const modules: ProjectModule[] = [];
  for (const entry of entries) {
    if (entry.kind !== "file") continue;
    const fileName = baseName(entry.path);
    if (fileName === currentName) continue;

    const name = getSiblingModuleName(fileName);
    if (!name) continue;

    // Re-read through getEntry so the module always uses the saved contents,
    // even if the directory listing is stale.
    let saved = entry;
    try {
      const fresh = await fileSystem.getEntry(normalizePath(entry.path));
      if (!fresh || fresh.kind !== "file") continue;
      saved = fresh;
    } catch {
      continue;
    }

    modules.push({ name, content: saved.content ?? "" });
  }

  return modules.sort((a, b) => a.name.localeCompare(b.name));
}

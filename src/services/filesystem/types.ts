/**
 * Future shared project filesystem (File Explorer, Terminal, multi-file projects).
 *
 * Deliberately separate from progression data: files live in the "fs" object
 * store and never affect XP or ticket completion. Not implemented in the MVP —
 * the editor currently stores one draft per ticket in the "drafts" store.
 */
export interface FsEntry {
  path: string;
  kind: "file" | "dir";
  language?: "python" | "javascript" | "text";
  content?: string;
  updatedAt: number;
}

export interface FileSystemProvider {
  list(dir: string): Promise<FsEntry[]>;
  read(path: string): Promise<FsEntry | undefined>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
}

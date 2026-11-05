import { dbGet, dbGetAll, dbSet } from "@/services/persistence/db";
import type { FsEntry } from "./types";

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const segment of (path.startsWith("/") ? path : "/" + path).split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return "/" + parts.join("/");
}
export function parentPath(path: string): string {
  const normalized = normalizePath(path);
  return normalized === "/" ? "/" : normalized.slice(0, normalized.lastIndexOf("/")) || "/";
}
export function baseName(path: string): string { return normalizePath(path).split("/").pop() || "/"; }
const initialDirs = ["/", "/Desktop", "/Documents", "/Projects", "/Projects/Python"];
let initialization: Promise<void> | null = null;
export function ensureFilesystem(): Promise<void> {
  if (!initialization) initialization = (async () => {
    for (const path of initialDirs) {
      if (!await dbGet<FsEntry>("fs", path)) await dbSet("fs", path, { path, kind: "dir", updatedAt: Date.now() } satisfies FsEntry);
    }
  })().catch(error => { initialization = null; throw error; });
  return initialization;
}
export async function getEntry(path: string): Promise<FsEntry | undefined> {
  await ensureFilesystem(); return dbGet<FsEntry>("fs", normalizePath(path));
}
export async function listEntries(dir: string): Promise<FsEntry[]> {
  await ensureFilesystem();
  const path = normalizePath(dir);
  const parent = await dbGet<FsEntry>("fs", path);
  if (!parent || parent.kind !== "dir") throw new Error("Folder not found: " + path);
  return Object.values(await dbGetAll<FsEntry>("fs"))
    .filter(entry => entry.path !== path && parentPath(entry.path) === path)
    .sort((a,b) => Number(b.kind === "dir") - Number(a.kind === "dir") || a.path.localeCompare(b.path));
}
export async function createEntry(path: string, kind: "file" | "dir", content = ""): Promise<void> {
  await ensureFilesystem(); path = normalizePath(path);
  if (path === "/" || !baseName(path).trim()) throw new Error("Invalid file name");
  if (await dbGet("fs", path)) throw new Error("Already exists: " + path);
  const parent = await dbGet<FsEntry>("fs", parentPath(path));
  if (!parent || parent.kind !== "dir") throw new Error("Parent folder does not exist");
  await dbSet("fs", path, { path, kind, ...(kind === "file" ? {content, language: path.endsWith(".py") ? "python" : "text"} : {}), updatedAt: Date.now() } satisfies FsEntry);
}
export async function writeFile(path: string, content: string): Promise<void> {
  await ensureFilesystem(); path = normalizePath(path);
  const current = await dbGet<FsEntry>("fs", path);
  if (!current) { await createEntry(path, "file", content); return; }
  if (current.kind !== "file") throw new Error("Cannot write to a folder");
  await dbSet("fs", path, {...current, content, updatedAt: Date.now()});
}
export async function deleteEntry(path: string): Promise<void> {
  await ensureFilesystem(); path = normalizePath(path);
  if (initialDirs.includes(path)) throw new Error("Cannot delete a system folder");
  const all = await dbGetAll<FsEntry>("fs");
  if (!all[path]) throw new Error("Not found: " + path);
  // Remove children before parent; all changes use the existing fs object store.
  const { dbDelete } = await import("@/services/persistence/db");
  for (const key of Object.keys(all).filter(k => k === path || k.startsWith(path + "/"))) await dbDelete("fs", key);
}
export async function renameEntry(path: string, newName: string): Promise<void> {
  await ensureFilesystem(); path = normalizePath(path);
  if (initialDirs.includes(path)) throw new Error("Cannot rename a system folder");
  if (!newName.trim() || newName === "." || newName === ".." || newName.includes("/")) throw new Error("Invalid name");
  const destination = normalizePath(parentPath(path) + "/" + newName.trim());
  const all = await dbGetAll<FsEntry>("fs");
  if (!all[path]) throw new Error("Not found");
  if (all[destination]) throw new Error("Destination exists");
  const descendants = Object.values(all).filter(e => e.path === path || e.path.startsWith(path + "/"));
  const { dbDelete } = await import("@/services/persistence/db");
  for (const entry of descendants) await dbSet("fs", destination + entry.path.slice(path.length), {...entry, path: destination + entry.path.slice(path.length), updatedAt: Date.now()});
  for (const entry of descendants) await dbDelete("fs", entry.path);
}

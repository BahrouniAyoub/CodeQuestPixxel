import { useCallback, useEffect, useState } from "react";
import { Folder, FileCode2, FileText, ArrowUp, RefreshCcw, Plus, Pencil, Trash2, Save } from "lucide-react";
import { baseName, createEntry, deleteEntry, getEntry, listEntries, parentPath, renameEntry, writeFile } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import "./explorer.css";
import { useFileSession } from "@/features/editor/fileSession";
import { useWindows } from "@/core/windows/windowStore";
import { useTerminalSession } from "@/features/terminal/terminalSession";
export function ExplorerApp() {
  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const refresh = useCallback(async () => { try { setEntries(await listEntries(cwd)); setError(""); } catch (e) { setError(String(e)); } }, [cwd]);
  useEffect(() => { void refresh(); }, [refresh]);
  const perform = async (operation: () => Promise<void>) => { try { await operation(); await refresh(); setError(""); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };

  const open = async (entry: FsEntry) => {
    setSelected(entry.path);

    if (entry.kind === "dir") {
      setCwd(entry.path);
      setEditing(null);
      setSelected(null);
      return;
    }

    if (entry.path.toLowerCase().endsWith(".py")) {
      if (!useFileSession.getState().openFile(entry.path)) return;
      useWindows.getState().open("editor");

      setEditing(null);
      setStatus("");
      return;
    }

    setEditing(entry.path);
    setContent((await getEntry(entry.path))?.content ?? "");
    setStatus("");
  };

  const openInTerminal = () => {
    if (!selected || !selected.toLowerCase().endsWith(".py")) return;
    useTerminalSession.getState().openFile(selected);
    useWindows.getState().open("terminal");
  };

  const create = (kind: "file" | "dir") => { const name = window.prompt(kind === "dir" ? "New folder name" : "New file name (e.g. hello.py)"); if (name) void perform(() => createEntry(cwd + "/" + name, kind)); };
  const rename = () => { if (!selected) return; const name = window.prompt("Rename", baseName(selected)); if (name) void perform(async () => { await renameEntry(selected, name); setSelected(null); setEditing(null); }); };
  const remove = () => { if (!selected || !window.confirm("Delete " + baseName(selected) + " and its contents?")) return; void perform(async () => { await deleteEntry(selected); setSelected(null); setEditing(null); }); };
  return <div className="cq-fs-app"><div className="cq-fs-toolbar"><button onClick={() => { setCwd(parentPath(cwd)); setEditing(null); }} disabled={cwd === "/"}><ArrowUp size={15} /> Up</button><strong className="cq-fs-path">{cwd}</strong><button onClick={() => void refresh()} title="Refresh"><RefreshCcw size={15} /></button><button onClick={() => create("dir")}><Plus size={15} /> Folder</button><button onClick={() => create("file")}><Plus size={15} /> File</button><button onClick={openInTerminal} disabled={!selected || !selected.toLowerCase().endsWith(".py")} title="Open selected Python file in Terminal">Open in Terminal</button><button onClick={rename} disabled={!selected}><Pencil size={15} /></button><button onClick={remove} disabled={!selected}><Trash2 size={15} /></button></div>{error && <div className="cq-fs-error" role="alert">{error}</div>}<div className="cq-fs-body"><aside className="cq-fs-sidebar">{["/", "/Desktop", "/Documents", "/Projects", "/Projects/Python"].map(path => <button key={path} className={cwd === path ? "active" : ""} onClick={() => { setCwd(path); setEditing(null); setSelected(null); }}><Folder size={15} />{path === "/" ? "Home" : baseName(path)}</button>)}</aside><section className="cq-fs-list">{entries.length === 0 ? <p className="cq-fs-muted">This folder is empty. Create a file or folder.</p> : entries.map(entry => <button key={entry.path} className={selected === entry.path ? "selected" : ""} onClick={() => setSelected(entry.path)} onDoubleClick={() => void open(entry)} title="Double-click to open">{entry.kind === "dir" ? <Folder size={22} /> : entry.path.endsWith(".py") ? <FileCode2 size={22} /> : <FileText size={22} />}<span>{baseName(entry.path)}</span></button>)}</section>{editing && <section className="cq-fs-edit"><div><strong>{baseName(editing)}</strong><button onClick={() => void perform(async () => { await writeFile(editing, content); setStatus("Saved"); })}><Save size={15} /> Save</button><button onClick={() => setEditing(null)}>Close</button></div><textarea aria-label="File contents" spellCheck={false} value={content} onChange={e => { setContent(e.target.value); setStatus("Unsaved changes"); }} /><small>{status}</small></section>}</div><footer className="cq-fs-footer">{entries.length} items
  </footer></div>;
}

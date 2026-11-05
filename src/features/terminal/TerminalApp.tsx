import { useEffect, useRef, useState } from "react";
import { baseName, createEntry, getEntry, listEntries, normalizePath } from "@/services/filesystem/filesystem";
import { getPythonRunner } from "@/services/runner/pyodideRunner";
import "./terminal.css";
import { useTerminalSession } from "./terminalSession";
import { useFileSession } from "@/features/editor/fileSession";

const HELP = [
  "help, pwd, ls [dir], cd [dir], mkdir <name>, touch <name>",
  "cat <file>, echo <text>, clear",
  "python <file.py>, python -c \"code\", python --version",
  "Ctrl+C or Stop to cancel a running program",
].join("\n");

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of command.matchAll(re)) tokens.push(match[1] ?? match[2] ?? match[3]);
  return tokens;
}

export function TerminalApp() {
  const [cwd, setCwd] = useState("/");
  const pendingPath = useTerminalSession(state => state.pendingPath);
  useEffect(() => {
    if (!pendingPath) return;
    // Use absolute paths so Terminal's current directory does not matter.
    setInput(`python "${pendingPath}"`);
    useTerminalSession.getState().consume();
  }, [pendingPath]);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<string[]>([
    "CodeQuest Terminal v0.2",
    "Type help for available commands.",
  ]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const busyRef = useRef(false);
  const runSequence = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  const stop = () => {
    if (!busyRef.current) return;
    getPythonRunner().cancel();
    setLines(previous => [...previous, "^C (cancellation requested)"]);
  };

  const execute = async (command: string) => {
    if (busyRef.current) return;
    const args = tokenize(command.trim());
    const [cmd, ...rest] = args;
    const target = (arg?: string) =>
      normalizePath(arg?.startsWith("/") ? arg : cwd + "/" + (arg || "."));
    if (cmd === "clear") {
      setLines([]);
      return;
    }
    if (!cmd) {
      setLines(previous => [...previous, `${cwd} $`]);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    const sequence = ++runSequence.current;
    setLines(previous => [...previous, `${cwd} $ ${command}`]);
    let response = "";

    try {
      switch (cmd) {
        case "help":
          response = HELP;
          break;
        case "pwd":
          response = cwd;
          break;
        case "ls":
          response = (await listEntries(target(rest[0])))
            .map(entry => (entry.kind === "dir" ? "📁 " : "📄 ") + baseName(entry.path))
            .join("  ") || "(empty)";
          break;
        case "cd": {
          const path = target(rest[0] || "/");
          const entry = await getEntry(path);
          if (entry?.kind !== "dir") throw new Error("Not a directory: " + path);
          setCwd(path);
          break;
        }
        case "mkdir":
          if (!rest[0]) throw new Error("Usage: mkdir <name>");
          await createEntry(target(rest[0]), "dir");
          break;
        case "touch":
          if (!rest[0]) throw new Error("Usage: touch <name>");
          if (!(await getEntry(target(rest[0])))) await createEntry(target(rest[0]), "file");
          break;
        case "cat": {
          if (!rest[0]) throw new Error("Usage: cat <file>");
          const entry = await getEntry(target(rest[0]));
          if (entry?.kind !== "file") throw new Error("File not found: " + target(rest[0]));
          response = entry.content ?? "";
          break;
        }
        case "echo":
          response = rest.join(" ");
          break;
        case "python":
        case "python3": {
          if (!rest.length) {
            response = "Usage: python <file.py> or python -c \"code\"";
            break;
          }
          if (rest[0] === "--version" || rest[0] === "-V") {
            // Pyodide version depends on the deployed worker. Do not invent it.
            response = "Python runtime: Pyodide (exact version not exposed by this terminal)";
            break;
          }
          let source: string;
          if (rest[0] === "-c") {
            if (rest.length < 2) throw new Error('Usage: python -c "print(2 + 2)"');
            source = rest.slice(1).join(" ");
          } else {
            if (rest.length !== 1) throw new Error("Usage: python <file.py>");
            const path = target(rest[0]);
            const entry = await getEntry(path);
            if (entry?.kind !== "file") throw new Error("File not found: " + path);
            if (!path.toLowerCase().endsWith(".py")) throw new Error("Expected a .py file: " + path);
            const editor = useFileSession.getState();
            if (editor.filePath === path && editor.dirty) {
              throw new Error("Unsaved edits in Code Editor. Save the file before running it in Terminal.");
            }
            source = entry.content ?? "";
          }
          setRunning(true);
          try {
            const result = await getPythonRunner().run({
              code: source,
              stdin: [],
              echoPrompts: true,
              timeoutMs: 5000,
              outputLimit: 20000,
            });
            response = [result.stdout, result.error].filter(Boolean).join("\n");
            if (!response) response = result.ok ? "(program finished without output)" : "(execution failed)";
          } finally {
            setRunning(false);
          }
          break;
        }
        default:
          response = `Unknown command: ${cmd}. Type help.`;
      }
    } catch (error) {
      response = error instanceof Error ? error.message : String(error);
    } finally {
      if (sequence === runSequence.current) {
        if (response) setLines(previous => [...previous, response]);
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <div className="cq-terminal">
      <div className="cq-terminal-log" ref={logRef} aria-live="polite">
        {lines.map((line, index) => (
          <div key={index} style={{ whiteSpace: "pre-wrap" }}>{line}</div>
        ))}
      </div>
      <form onSubmit={event => {
        event.preventDefault();
        if (busy) return;
        const command = input;
        setInput("");
        void execute(command);
      }}>
        <label>
          {cwd} ${" "}
          <input
            autoComplete="off"
            spellCheck={false}
            aria-label="Terminal command"
            value={input}
            disabled={busy}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.ctrlKey && event.key.toLowerCase() === "c" && running) {
                event.preventDefault();
                stop();
              }
            }}
          />
        </label>
        {running && <button type="button" onClick={stop}>Stop</button>}
      </form>
    </div>
  );
}

export type RuntimeStatus = "unloaded" | "loading" | "ready" | "running" | "unavailable";

/** Project-local Python module made available to the program as `import <name>`. */
export interface ProjectModule {
  /** Import name without the `.py` extension. */
  name: string;
  /** Python source loaded fresh for this execution only. */
  content: string;
}

export interface RunRequest {
  code: string;
  stdin: string[];
  /** Python executed after the program in the same namespace (assertions) */
  check?: string;
  /** Python executed after project modules load and before the program. */
  prelude?: string;
  /**
   * Project-local modules importable during this run only. The worker installs
   * a lazy import hook so a module's saved source executes only if the program
   * actually imports it; nothing leaks into a later run.
   */
  projectModules?: readonly ProjectModule[];
  /** Echo input() prompts and typed values into stdout (interactive Run) */
  echoPrompts: boolean;
  timeoutMs: number;
  outputLimit: number;
}

export interface RunResult {
  /** Always "pyodide" for real execution; results from anything else are never trusted for XP. */
  engine: "pyodide";
  ok: boolean;
  stdout: string;
  error: string | null;
  errorType: string | null;
  /** Line where the error happened, in the program or a project module. */
  line: number | null;
  /** File name where the error happened (`main.py`, `calculator.py`, …). */
  file?: string | null;
  phase: "program" | "check" | null;
  truncated: boolean;
  timedOut: boolean;
  cancelled: boolean;
  durationMs: number;
}

export interface PythonRunner {
  readonly status: RuntimeStatus;
  init(): Promise<void>;
  run(req: RunRequest): Promise<RunResult>;
  cancel(): void;
  subscribe(fn: (s: RuntimeStatus, message?: string) => void): () => void;
}

export class RuntimeUnavailableError extends Error {}

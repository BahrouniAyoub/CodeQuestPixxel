export type RuntimeStatus = "unloaded" | "loading" | "ready" | "running" | "unavailable";

export interface RunRequest {
  code: string;
  stdin: string[];
  /** Python executed after the program in the same namespace (assertions) */
  check?: string;
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
  /** Line in main.py where the error happened */
  line: number | null;
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


import type {
  PythonRunner,
  RunRequest,
  RunResult,
  RuntimeStatus,
} from "./types";
import { RuntimeUnavailableError } from "./types";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

type WorkerRunResult = Omit<
  RunResult,
  "engine" | "timedOut" | "cancelled" | "durationMs"
>;

type AbortReason = "timeout" | "cancel";

const INIT_TIMEOUT_MS = 45_000;
const MIN_RUN_TIMEOUT_MS = 100;
const MAX_RUN_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 50_000;

/**
 * Pyodide runner using a dedicated Web Worker.
 *
 * - One Python execution at a time.
 * - Worker initialization has a timeout.
 * - Execution can be cancelled.
 * - Infinite loops can be stopped by terminating the worker.
 * - Failed workers can be recreated.
 *
 * SECURITY:
 * A Web Worker is not a security sandbox for hostile code.
 */
class PyodideRunner implements PythonRunner {
  status: RuntimeStatus = "unloaded";
  lastError: string | null = null;

  private worker: Worker | null = null;
  private sequence = 0;

  private pending = new Map<number, Pending>();

  private initPromise: Promise<void> | null = null;

  private listeners = new Set<
    (status: RuntimeStatus, message?: string) => void
  >();

  private abortCurrent:
    | ((reason: AbortReason) => void)
    | null = null;

  private active = false;
  private generation = 0;

  subscribe(
    listener: (status: RuntimeStatus, message?: string) => void,
  ) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(
    status: RuntimeStatus,
    message?: string,
  ) {
    this.status = status;

    for (const listener of this.listeners) {
      listener(status, message);
    }
  }

  private spawn(): Worker {
    const worker = new Worker("/python-worker.js");

    worker.onmessage = (
      event: MessageEvent<{
        id: number;
        ok: boolean;
        result?: unknown;
        error?: string;
      }>,
    ) => {
      const pending = this.pending.get(event.data.id);

      if (!pending) return;

      this.pending.delete(event.data.id);

      if (event.data.ok) {
        pending.resolve(event.data.result);
      } else {
        pending.reject(
          new Error(
            event.data.error || "Python worker error",
          ),
        );
      }
    };

    worker.onerror = (event) => {
      event.preventDefault();

      const error = new RuntimeUnavailableError(
        event.message || "Python worker crashed",
      );

      this.resetWorker(error);

      this.lastError = error.message;

      this.setStatus(
        "unavailable",
        error.message,
      );
    };

    return worker;
  }

  private send<T>(
    type: "init" | "run",
    payload?: unknown,
  ): Promise<T> {
    if (!this.worker) {
      this.worker = this.spawn();
    }

    const worker = this.worker;
    const id = ++this.sequence;

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      try {
        worker.postMessage({
          id,
          type,
          payload,
        });
      } catch (error) {
        this.pending.delete(id);

        reject(
          error instanceof Error
            ? error
            : new Error(String(error)),
        );
      }
    });
  }

  private resetWorker(reason: Error) {
    this.generation++;

    if (this.worker) {
      this.worker.terminate();
    }

    this.worker = null;
    this.initPromise = null;

    for (const pending of this.pending.values()) {
      pending.reject(reason);
    }

    this.pending.clear();
  }

  init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.active) {
      return Promise.reject(
        new Error(
          "Cannot initialize during an active run",
        ),
      );
    }

    this.setStatus(
      "loading",
      "Loading Python runtime…",
    );

    const generation = this.generation;

    let timer:
      | ReturnType<typeof setTimeout>
      | undefined;

    const timeout = new Promise<never>(
      (_, reject) => {
        timer = setTimeout(() => {
          reject(
            new RuntimeUnavailableError(
              "Python runtime initialization timed out. Please retry.",
            ),
          );
        }, INIT_TIMEOUT_MS);
      },
    );

    const initialization = Promise.race([
      this.send<void>("init"),
      timeout,
    ])
      .then(() => {
        if (generation !== this.generation) {
          throw new Error(
            "Runtime initialization was interrupted",
          );
        }

        this.lastError = null;
        this.setStatus("ready");
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (generation === this.generation) {
          this.resetWorker(
            new RuntimeUnavailableError(message),
          );

          this.lastError = message;

          this.setStatus(
            "unavailable",
            message,
          );
        }

        throw new RuntimeUnavailableError(message);
      })
      .finally(() => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      });

    this.initPromise = initialization;

    return initialization;
  }

  async run(
    request: RunRequest,
  ): Promise<RunResult> {
    if (this.active) {
      throw new Error(
        "A Python execution is already running. Stop it before starting another.",
      );
    }

    this.active = true;

    const started = performance.now();

    try {
      await this.initForRun();

      this.setStatus("running");

      const timeoutMs = Math.max(
        MIN_RUN_TIMEOUT_MS,
        Math.min(
          MAX_RUN_TIMEOUT_MS,
          request.timeoutMs,
        ),
      );

      const outputLimit = Math.max(
        1,
        Math.min(
          MAX_OUTPUT_CHARS,
          request.outputLimit,
        ),
      );

      const result: WorkerRunResult =
        await new Promise<WorkerRunResult>(
          (resolve, reject) => {
            let settled = false;

            const finish = () => {
              if (settled) return false;

              settled = true;
              clearTimeout(timer);
              this.abortCurrent = null;

              return true;
            };

            const abort = (
              reason: AbortReason,
            ) => {
              if (!finish()) return;

              const error = Object.assign(
                new Error(reason),
                { reason },
              );

              this.resetWorker(error);

              reject(error);
            };

            const timer = setTimeout(
              () => abort("timeout"),
              timeoutMs,
            );

            this.abortCurrent = abort;

            this.send<WorkerRunResult>(
              "run",
              {
                ...request,
                timeoutMs,
                outputLimit,
              },
            ).then(
              (value) => {
                if (finish()) {
                  resolve(value);
                }
              },
              (error: unknown) => {
                if (finish()) {
                  reject(error);
                }
              },
            );
          },
        );

      this.setStatus("ready");

      return {
        ...result,
        engine: "pyodide",
        timedOut: false,
        cancelled: false,
        durationMs:
          performance.now() - started,
      };
    } catch (error) {
      const reason =
        error instanceof Error &&
        "reason" in error
          ? (error as Error & {
              reason?: AbortReason;
            }).reason
          : undefined;

      if (
        reason === "timeout" ||
        reason === "cancel"
      ) {
        this.setStatus("unloaded");

        return {
          engine: "pyodide",
          ok: false,
          stdout: "",
          error:
            reason === "timeout"
              ? "Execution timed out. Check for an endless loop."
              : "Execution cancelled.",
          errorType:
            reason === "timeout"
              ? "Timeout"
              : "Cancelled",
          line: null,
          phase: "program",
          truncated: false,
          timedOut: reason === "timeout",
          cancelled: reason === "cancel",
          durationMs:
            performance.now() - started,
        };
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      this.resetWorker(
        new RuntimeUnavailableError(message),
      );

      this.lastError = message;

      this.setStatus(
        "unavailable",
        message,
      );

      throw new RuntimeUnavailableError(
        message,
      );
    } finally {
      this.abortCurrent = null;
      this.active = false;
    }
  }

  private initForRun(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    // Reserve the runner while initialization starts.
    this.active = false;

    const promise = this.init();

    this.active = true;

    return promise;
  }

  cancel() {
    this.abortCurrent?.("cancel");
  }
}

let singleton: PyodideRunner | null = null;

export function getPythonRunner(): PyodideRunner {
  if (!singleton) {
    singleton = new PyodideRunner();
  }

  return singleton;
}

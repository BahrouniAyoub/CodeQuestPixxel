
import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import {
  Play,
  Send,
  RotateCcw,
  Square,
  FileCode2,
  Terminal,
  ShieldCheck,
  Save,
  ArrowLeft,
} from "lucide-react";

import { useProgress } from "@/features/progress/progressStore";
import { useDrafts } from "@/features/tickets/draftStore";
import { TICKETS_BY_ID } from "@/features/tickets/data/tickets";
import { isUnlocked } from "@/features/progress/progressLogic";
import { getPythonRunner } from "@/services/runner/pyodideRunner";
import {
  runTestSuite,
  type TestSuiteResult,
} from "@/services/runner/testing";
import type { RuntimeStatus } from "@/services/runner/types";
import { notify } from "@/features/notifications/notificationStore";
import { useWindows } from "@/core/windows/windowStore";
import { useFileSession } from "@/features/editor/fileSession";
import { getEntry, writeFile } from "@/services/filesystem/filesystem";
import "../shared-apps.css";

export function EditorApp() {
  // --------------------------------------------------
  // Ticket mode
  // --------------------------------------------------

  const progress = useProgress();
  const id = progress.currentTicketId;
  const ticket = TICKETS_BY_ID[id];

  const ticketCode = useDrafts(
    (state) =>
      state.drafts[id] ?? TICKETS_BY_ID[id].starterCode
  );

  const saveState = useDrafts(
    (state) => state.saveState[id] ?? "saved"
  );

  const unlocked = isUnlocked(
    id,
    progress.completions
  );

  // --------------------------------------------------
  // File mode
  // --------------------------------------------------

  const filePath = useFileSession(
    (state) => state.filePath
  );

  const isFileMode = filePath !== null;

  const [fileCode, setFileCode] = useState("");
  const [loadedFilePath, setLoadedFilePath] =
    useState<string | null>(null);

  const [fileLoading, setFileLoading] =
    useState(false);

  const [fileSaving, setFileSaving] =
    useState(false);

  const [fileDirty, setFileDirty] =
    useState(false);

  const [fileError, setFileError] =
    useState("");

  // Prevent stale file loads from replacing newer files.
  const fileLoadVersion = useRef(0);

  // Track the latest edited code for reliable saving.
  const fileCodeRef = useRef("");

  // --------------------------------------------------
  // Python runtime
  // --------------------------------------------------

  const [runtime, setRuntime] =
    useState<RuntimeStatus>(
      () => getPythonRunner().status
    );

  const [busy, setBusy] = useState(false);

  const [output, setOutput] = useState(
    "Ready to write Python. The runtime downloads on first use."
  );

  const [suite, setSuite] =
    useState<TestSuiteResult | null>(null);

  const [tab, setTab] =
    useState<"output" | "tests">("output");

  const [stdin, setStdin] = useState("");

  const activeRun = useRef(0);

  useEffect(() => {
    return getPythonRunner().subscribe(setRuntime);
  }, []);

  // --------------------------------------------------
  // Load selected file
  // --------------------------------------------------

  useEffect(() => {
    const version = ++fileLoadVersion.current;

    activeRun.current += 1;
    setSuite(null);
    setTab("output");
    setStdin("");

    if (!filePath) {
      setLoadedFilePath(null);
      setFileCode("");
      fileCodeRef.current = "";
      setFileDirty(false);
      useFileSession.getState().setDirty(false);
      setFileError("");
      setFileLoading(false);

      setOutput(
        "Select Run to execute this ticket. No tests have been submitted."
      );

      return;
    }

    let cancelled = false;

    setFileLoading(true);
    setLoadedFilePath(null);
    setFileCode("");
    fileCodeRef.current = "";
    setFileDirty(false);
    useFileSession.getState().setDirty(false);
    setFileError("");

    setOutput(
      `Loading ${filePath}...`
    );

    void getEntry(filePath)
      .then((entry) => {
        if (
          cancelled ||
          version !== fileLoadVersion.current
        ) {
          return;
        }

        if (!entry || entry.kind !== "file") {
          throw new Error(
            "Python file not found: " + filePath
          );
        }

        const contents = entry.content ?? "";

        setFileCode(contents);
        fileCodeRef.current = contents;
        setLoadedFilePath(filePath);
        setFileDirty(false);
        useFileSession.getState().setDirty(false);

        setOutput(
          `Opened ${filePath}. Click Run to execute this file.`
        );
      })
      .catch((error: unknown) => {
        if (
          cancelled ||
          version !== fileLoadVersion.current
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setFileError(message);
        setOutput(`File error: ${message}`);
      })
      .finally(() => {
        if (
          !cancelled &&
          version === fileLoadVersion.current
        ) {
          setFileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // --------------------------------------------------
  // Reset ticket output on ticket change
  // --------------------------------------------------

  useEffect(() => {
    if (isFileMode) return;

    activeRun.current += 1;
    setSuite(null);
    setTab("output");
    setStdin("");

    setOutput(
      "Select Run to execute this ticket. No tests have been submitted."
    );
  }, [id, isFileMode]);

  // --------------------------------------------------
  // Current editor values
  // --------------------------------------------------

  const code = isFileMode
    ? fileCode
    : ticketCode;

  const fileReady =
    !isFileMode ||
    (
      !fileLoading &&
      loadedFilePath === filePath &&
      !fileError
    );

  const canEdit =
    isFileMode
      ? fileReady && !fileSaving
      : unlocked;

  const canRun =
    !busy &&
    fileReady &&
    (isFileMode || unlocked);

  // --------------------------------------------------
  // Code editing
  // --------------------------------------------------

  const handleCodeChange = (value: string) => {
    activeRun.current += 1;
    setSuite(null);

    if (isFileMode) {
      if (!fileReady) return;

      setFileCode(value);
      fileCodeRef.current = value;
      setFileDirty(true);
      useFileSession.getState().setDirty(true);
    } else {
      useDrafts.getState().setCode(id, value);
    }
  };

  // --------------------------------------------------
  // Save Python file
  // --------------------------------------------------

  const saveFile = async () => {
    if (
      !filePath ||
      !fileReady ||
      fileSaving
    ) {
      return;
    }

    const pathToSave = filePath;
    const codeToSave = fileCodeRef.current;

    setFileSaving(true);

    try {
      await writeFile(
        pathToSave,
        codeToSave
      );

      if (
        useFileSession.getState().filePath === pathToSave
      ) {
        const stillDirty = fileCodeRef.current !== codeToSave;
        setFileDirty(stillDirty);
        useFileSession.getState().setDirty(stillDirty);
      }

      notify({
        kind: "success",
        title: "File saved",
        message: pathToSave,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      notify({
        kind: "error",
        title: "Save failed",
        message,
      });
    } finally {
      setFileSaving(false);
    }
  };

  // --------------------------------------------------
  // Return to ticket mode
  // --------------------------------------------------

  const backToTicket = () => {
    if (useFileSession.getState().closeFile()) {
      activeRun.current += 1;
    }
  };

  // --------------------------------------------------
  // Run Python / submit ticket tests
  // --------------------------------------------------

  const execute = async (submit: boolean) => {
    if (!canRun) return;

    // Personal Python files must never submit ticket tests.
    if (submit && isFileMode) return;

    const runFilePath = filePath;
    const submittedCode = code;
    const runId = ++activeRun.current;

    setBusy(true);
    setSuite(null);
    setTab(submit ? "tests" : "output");

    const stillCurrent = () =>
      runId === activeRun.current &&
      useFileSession.getState().filePath ===
        runFilePath &&
      (
        runFilePath !== null ||
        useProgress.getState().currentTicketId === id
      );

    try {
      const runner = getPythonRunner();

      if (submit) {
        const result = await runTestSuite(
          runner,
          submittedCode,
          ticket.tests
        );

        if (!stillCurrent()) return;

        if (
          useDrafts.getState().getCode(id) !==
          submittedCode
        ) {
          return;
        }

        setSuite(result);

        setOutput(
          result.outcomes
            .map(
              (outcome) =>
                `${outcome.passed ? "PASS" : "FAIL"} · ${outcome.name}${
                  outcome.passed
                    ? ""
                    : `\n${outcome.message}`
                }`
            )
            .join("\n\n") ||
            "No tests executed."
        );

        if (result.allPassed) {
          const attempt =
            await useProgress
              .getState()
              .submitVerified(id, result);

          if (
            !attempt.awarded &&
            attempt.reason !== "already-completed"
          ) {
            notify({
              kind: "warning",
              title: "Submission not accepted",
              message: attempt.reason,
            });
          }
        }
      } else {
        const result = await runner.run({
          code: submittedCode,
          stdin: stdin.split("\n"),
          echoPrompts: true,
          timeoutMs: 5000,
          outputLimit: 20000,
        });

        if (!stillCurrent()) return;

        setOutput(
          `${result.stdout}${
            result.error
              ? `\n${result.error}`
              : ""
          }` ||
            (
              result.ok
                ? "Program finished without output."
                : "Execution failed."
            )
        );
      }
    } catch (error) {
      if (!stillCurrent()) return;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      setOutput(
        `Runtime error: ${message}`
      );

      notify({
        kind: "error",
        title: "Python execution failed",
        message,
      });
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="cq-app cq-editor">
      <div className="cq-app-toolbar">
        <div className="cq-app-heading">
          <FileCode2 size={19} />
          CODEQUEST / PYTHON WORKSPACE
        </div>

        <div className="cq-actions">
          {isFileMode ? (
            <>
              <span className="cq-muted">
                ●{" "}
                {fileLoading
                  ? "Loading"
                  : fileSaving
                    ? "Saving"
                    : fileDirty
                      ? "Unsaved changes"
                      : "Saved"}
              </span>

              <button
                disabled={
                  !fileReady ||
                  fileSaving ||
                  !fileDirty
                }
                onClick={() => void saveFile()}
              >
                <Save size={15} />
                Save file
              </button>

              <button onClick={backToTicket}>
                <ArrowLeft size={15} />
                Back to ticket
              </button>
            </>
          ) : (
            <>
              <span className="cq-muted">
                ● {saveState}
              </span>

              <button
                title="Reset starter code"
                onClick={() => {
                  if (
                    window.confirm(
                      "Reset this ticket to starter code?"
                    )
                  ) {
                    useDrafts
                      .getState()
                      .resetToStarter(id);

                    setSuite(null);
                  }
                }}
              >
                <RotateCcw size={15} />
              </button>

              <button
                onClick={() =>
                  useWindows
                    .getState()
                    .open("tickets")
                }
              >
                Ticket details
              </button>
            </>
          )}
        </div>
      </div>

      {/* Header */}

      {isFileMode ? (
        <div className="cq-editor-ticket">
          <div>
            <span className="cq-eyebrow">
              FILE EXPLORER · PYTHON FILE
            </span>

            <h2>
              {filePath?.split("/").pop()}
            </h2>
          </div>

          <span className="cq-tag">
            File mode
          </span>
        </div>
      ) : (
        <div className="cq-editor-ticket">
          <div>
            <span className="cq-eyebrow">
              {id} · {ticket.topic}
            </span>

            <h2>{ticket.title}</h2>
          </div>

          <span className="cq-tag">
            ✦ {ticket.xp} XP
          </span>
        </div>
      )}

      {/* File information */}

      <div className="cq-editor-file">
        <FileCode2 size={15} />

        {isFileMode
          ? filePath
          : ticket.fileName}

        <span className="cq-muted">
          Python
        </span>
      </div>

      {fileError && (
        <div
          className="cq-fs-error"
          role="alert"
        >
          {fileError}
        </div>
      )}

      {/* CodeMirror */}

      <div className="cq-editor-code">
        <CodeMirror
          key={
            isFileMode
              ? `file:${filePath}`
              : `ticket:${id}`
          }
          value={code}
          onChange={handleCodeChange}
          extensions={[python()]}
          theme="dark"
          height="100%"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
          editable={canEdit}
          aria-label="Python code editor"
        />
      </div>

      {/* Run controls */}

      <div className="cq-editor-controls">
        <label className="cq-stdin">
          Program input (one line per input() call)

          <input
            aria-label="Program input"
            value={stdin}
            onChange={(event) =>
              setStdin(event.target.value)
            }
            placeholder="Optional input"
          />
        </label>

        <span className="cq-muted">
          Runtime: {runtime}
        </span>

        <div className="cq-actions">
          {busy && (
            <button
              onClick={() =>
                getPythonRunner().cancel()
              }
            >
              <Square size={14} />
              Stop
            </button>
          )}

          <button
            disabled={!canRun}
            onClick={() => void execute(false)}
          >
            <Play size={15} />
            Run
          </button>

          {!isFileMode && (
            <button
              className="cq-action-primary"
              disabled={!canRun}
              onClick={() => void execute(true)}
            >
              <Send size={15} />
              Submit tests
            </button>
          )}
        </div>
      </div>

      {/* Output */}

      <div className="cq-editor-panel">
        <div className="cq-editor-tabs">
          <button
            className={
              tab === "output" ? "active" : ""
            }
            onClick={() => setTab("output")}
          >
            <Terminal size={14} />
            Output
          </button>

          {!isFileMode && (
            <button
              className={
                tab === "tests" ? "active" : ""
              }
              onClick={() => setTab("tests")}
            >
              <ShieldCheck size={14} />
              Test Results{" "}
              {suite
                ? `(${suite.passed}/${suite.total})`
                : ""}
            </button>
          )}
        </div>

        {tab === "output" || isFileMode ? (
          <pre aria-live="polite">
            {output}
          </pre>
        ) : (
          <div className="cq-test-list">
            {suite ? (
              suite.outcomes.map(
                (outcome, index) => (
                  <div
                    key={index}
                    className={
                      outcome.passed
                        ? "cq-test-pass"
                        : "cq-test-fail"
                    }
                  >
                    {outcome.passed ? "✓" : "✕"}{" "}
                    {outcome.name}

                    <small>
                      {outcome.message}
                    </small>
                  </div>
                )
              )
            ) : (
              <p className="cq-muted">
                Submit your code to run tests.
                Only verified successful tests
                complete a ticket.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

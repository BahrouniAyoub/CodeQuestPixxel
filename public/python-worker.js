/* CodeQuest Pixel OS — isolated Python runtime (Pyodide / CPython compiled to WebAssembly).
 * Runs in a dedicated Web Worker so user code never touches the page.
 * The host terminates this worker for timeouts and cancellation. */
const PYODIDE_VERSION = "0.27.2";
const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

const HARNESS = `
import sys, io, json, traceback, builtins

class _CQOutputLimit(BaseException):
    pass

class _CQOut(io.StringIO):
    def __init__(self, limit):
        super().__init__()
        self.limit = limit
        self.size = 0
        self.truncated = False
    def write(self, s):
        s = str(s)
        if self.truncated:
            raise _CQOutputLimit()
        room = self.limit - self.size
        if len(s) > room:
            super().write(s[:max(0, room)])
            self.size = self.limit
            self.truncated = True
            raise _CQOutputLimit()
        self.size += len(s)
        return super().write(s)

def _cq_run(code, inputs_json, check, echo, limit):
    inputs = json.loads(inputs_json)
    out = _CQOut(limit)
    it = iter(inputs)
    def _input(prompt=""):
        if echo:
            out.write(str(prompt))
        try:
            v = next(it)
        except StopIteration:
            raise EOFError("input() was called but no more input lines were provided")
        if echo:
            out.write(v + "\\n")
        return v
    g = {"__name__": "__main__", "__builtins__": builtins}
    old_out, old_err, old_input = sys.stdout, sys.stderr, builtins.input
    sys.stdout = out
    sys.stderr = out
    builtins.input = _input
    res = {"ok": True, "error": None, "errorType": None, "line": None, "phase": None}
    phase = "program"
    try:
        try:
            exec(compile(code, "main.py", "exec"), g)
        except SystemExit as e:
            if e.code not in (None, 0):
                raise
        if check:
            phase = "check"
            sys.stdout = io.StringIO()
            exec(compile(check, "test_check.py", "exec"), g)
    except _CQOutputLimit:
        res.update(ok=False, error="Output limit reached — is there an endless print loop?", errorType="OutputLimit", phase=phase)
    except SyntaxError as e:
        res.update(ok=False, error=f"{type(e).__name__}: {e.msg}", errorType=type(e).__name__, line=e.lineno if e.filename == "main.py" else None, phase=phase)
    except BaseException as e:
        line = None
        for fr in traceback.extract_tb(e.__traceback__):
            if fr.filename == "main.py":
                line = fr.lineno
        msg = "".join(traceback.format_exception_only(type(e), e)).strip()
        if phase == "check" and isinstance(e, AssertionError):
            msg = "Assertion failed" + (": " + str(e) if str(e) else "")
        res.update(ok=False, error=msg, errorType=type(e).__name__, line=line, phase=phase)
    finally:
        sys.stdout, sys.stderr, builtins.input = old_out, old_err, old_input
    res["stdout"] = out.getvalue()
    res["truncated"] = out.truncated
    return json.dumps(res)
`;

let pyodide = null;
let loading = null;

function load() {
  if (loading) return loading;
  loading = (async () => {
    importScripts(INDEX_URL + "pyodide.js");
    // eslint-disable-next-line no-undef
    pyodide = await loadPyodide({ indexURL: INDEX_URL });
    pyodide.runPython(HARNESS);
  })();
  return loading;
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  try {
    if (type === "init") {
      await load();
      self.postMessage({ id, ok: true });
      return;
    }
    if (type === "run") {
      await load();
      const fn = pyodide.globals.get("_cq_run");
      const json = fn(payload.code, JSON.stringify(payload.stdin || []), payload.check || "", !!payload.echoPrompts, payload.outputLimit || 20000);
      fn.destroy && fn.destroy();
      self.postMessage({ id, ok: true, result: JSON.parse(json) });
      return;
    }
    self.postMessage({ id, ok: false, error: "Unknown message type" });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};

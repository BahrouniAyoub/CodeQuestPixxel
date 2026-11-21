/* CodeQuest Pixel OS — isolated Python runtime (Pyodide / CPython compiled to WebAssembly).
 * Runs in a dedicated Web Worker so user code never touches the page.
 * The host terminates this worker for timeouts and cancellation. */
const PYODIDE_VERSION = "0.27.2";
const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

const HARNESS = `
import sys, io, json, traceback, builtins, importlib.abc, importlib.util

class _CQOutputLimit(BaseException):
    pass

class _CQProjectFinder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    """Import sibling project files lazily, so unused files never run."""
    def __init__(self, sources):
        self.sources = sources
    def find_spec(self, fullname, path=None, target=None):
        if fullname in self.sources:
            return importlib.util.spec_from_loader(fullname, self)
        return None
    def create_module(self, spec):
        return None
    def exec_module(self, module):
        name = module.__name__
        filename = name + ".py"
        module.__file__ = filename
        exec(compile(self.sources[name], filename, "exec"), module.__dict__)

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

def _cq_run(code, inputs_json, check, echo, limit, prelude="", modules_json="[]"):
    inputs = json.loads(inputs_json)
    modules = json.loads(modules_json) if modules_json else []
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
    res = {"ok": True, "error": None, "errorType": None, "line": None, "file": None, "phase": None}
    phase = "program"
    known_files = {"main.py", "_prelude.py"}
    sources = {}
    for module_spec in modules:
        name = str(module_spec.get("name", ""))
        sources[name] = str(module_spec.get("content", ""))
        known_files.add(name + ".py")
    # Replace any same-named installed module for this run only. Importing a
    # project module then executes the saved source lazily; siblings that are
    # never imported never run.
    saved_modules = {}
    for name in sources:
        if name in sys.modules:
            saved_modules[name] = sys.modules[name]
        sys.modules.pop(name, None)
    finder = _CQProjectFinder(sources) if sources else None
    if finder is not None:
        sys.meta_path.insert(0, finder)
    try:
        try:
            if prelude:
                exec(compile(prelude, "_prelude.py", "exec"), g)
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
        filename = e.filename if e.filename in known_files else None
        res.update(ok=False, error=f"{type(e).__name__}: {e.msg}", errorType=type(e).__name__, line=e.lineno if filename else None, file=filename, phase=phase)
    except BaseException as e:
        line = None
        filename = None
        # Keep the innermost frame that belongs to the program or a project
        # module so the editor can report calculator.py errors accurately.
        for fr in traceback.extract_tb(e.__traceback__):
            if fr.filename in known_files:
                line = fr.lineno
                filename = fr.filename
        msg = "".join(traceback.format_exception_only(type(e), e)).strip()
        if phase == "check" and isinstance(e, AssertionError):
            msg = "Assertion failed" + (": " + str(e) if str(e) else "")
        res.update(ok=False, error=msg, errorType=type(e).__name__, line=line, file=filename, phase=phase)
    finally:
        # Never leak a project module or import hook into a later run.
        if finder is not None and finder in sys.meta_path:
            sys.meta_path.remove(finder)
        for name in sources:
            if name in saved_modules:
                sys.modules[name] = saved_modules[name]
            else:
                sys.modules.pop(name, None)
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
      const json = fn(
        payload.code,
        JSON.stringify(payload.stdin || []),
        payload.check || "",
        !!payload.echoPrompts,
        payload.outputLimit || 20000,
        payload.prelude || "",
        JSON.stringify(payload.projectModules || []),
      );
      fn.destroy && fn.destroy();
      self.postMessage({ id, ok: true, result: JSON.parse(json) });
      return;
    }
    self.postMessage({ id, ok: false, error: "Unknown message type" });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};

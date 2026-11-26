# Course Exercise Mapping — Practical Python to CodeQuest (Revised)

> **Status**: Proposed design mapping (documentation only). No gameplay/code changes were made.  
> **Date**: 2026-11-26 (revised after Task 003 review)  
> **Source**: `practical-python-master` (David Beazley, CC BY-SA 4.0).  
> **Provenance**: Local reference is **not a git checkout** (`.git` absent); exact upstream commit hash cannot be verified from this copy. Do not guess. Record hash from a git clone before publishing adapted content.  
> **Coverage**: **131 exercise headings inventoried** by `^### Exercise` scan across `Notes/*/*.md`; **130 numbered exercises including 1 intentionally blank entry (3.13)**. Every exercise 1.1–9.5 is mapped below.

## Legend

- **Action**: `Direct` = adapt with minimal change; `Adapt` = same objective, new framing/data; `Simulate` = replace unsupported workflow; `Defer` = later chapter; `Exclude` = not suitable for CodeQuest.
- **Pyodide**: `OK` = compatible; `FS` = needs virtual FS/data; `CLI` = needs CLI/script framing; `NET` = network/CORS issue; `PROC` = long-running process/server; `PKG` = pip/venv/packaging tooling; `DBG` = debugger limitation.
- **Target**: proposed CodeQuest chapter/lesson/practice or client task. `—` means excluded/deferred without current placement.

## Section 1 — Introduction to Python (1.1–1.33)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 1.1 | Using Python as a Calculator | REPL, expressions | Adapt | OK | Ch1/L1-03 practice | In-editor "Try it" calculator sandbox | Original assumes REPL; use Editor/Run panel. |
| 1.2 | Getting help | help(), docs | Adapt | OK | Ch1/L1-01 bonus tip | "Ask Python for help" optional tooltip | Keep lightweight; avoid overwhelming beginners. |
| 1.3 | Cutting and Pasting | REPL workflow | Exclude | CLI | — | — | Workflow-specific, not learning objective for CodeQuest. |
| 1.4 | Where is My Bus? | urllib, external data | Simulate | NET | Ch2 side quest (deferred) | Use local mock transit/stock JSON in virtual FS | No live HTTP; CORS/unreliable. |
| 1.5 | The Bouncing Ball | scripts, loops/print | Adapt | OK | Ch1 optional practice | Simple animation-text/console simulation | Keep as fun optional exercise after L1-01/L1-05. |
| 1.6 | Debugging | reading errors | Adapt | OK | Ch1/L1-08 | Guided "fix the crash" exercise | Fits beginner error-reading objective. |
| 1.7 | Dave's mortgage | variables, loops, arithmetic | Adapt | OK | Ch1/L1-03, Ch2/L2 loops | Split into simple total calc (Ch1) and amortization loop (Ch2) | Original assumes loop comfort; stage it. |
| 1.8 | Extra payments | loops, state | Defer | OK | Ch2 | Loan/payment schedule extension | Needs loops/iteration. |
| 1.9 | Extra Payment Calculator | parameterization | Defer | OK | Ch2 | Function/loop exercise | After functions/loops. |
| 1.10 | Making a table | loops, formatting | Adapt | OK | Ch2 report mission | Format payment/report table | Good for formatted output; defer past Ch1. |
| 1.11 | Bonus | extra payment logic | Defer | OK | Ch2 bonus | Optional challenge | Bonus after core. |
| 1.12 | A Mystery | expressions/types | Adapt | OK | Ch1/L1-02 | Type/assignment puzzle | Short conceptual check. |
| 1.13 | Extracting characters/substrings | strings, indexing | Adapt | OK | Ch2 | Parse product codes/names | Useful but not needed for Ch1 café. |
| 1.14 | String concatenation | strings | Adapt | OK | Ch1/L1-04 | Build receipt lines | Directly relevant. |
| 1.15 | Membership testing | `in` operator | Adapt | OK | Ch2 | Search/filter text | Defer; minor concept. |
| 1.16 | String Methods | strip/lower/replace | Adapt | OK | Ch2/Ch3 data cleanup | Clean messy input fields | Useful in data cleanup chapter. |
| 1.17 | f-strings | formatting | Direct | OK | Ch1/L1-04 | Receipt formatting practice | Core Ch1 skill. |
| 1.18 | Regular Expressions | regex | Defer | OK | Ch3 optional | Validate messy IDs/emails | Too advanced for Ch1; optional later. |
| 1.19 | Extracting/reassigning list elements | lists | Defer | OK | Ch2 | Order/item list manipulation | Needs list intro. |
| 1.20 | Looping over list items | for loops | Defer | OK | Ch2 | Process menu/orders list | Core Ch2. |
| 1.21 | Membership tests | lists, `in` | Defer | OK | Ch2 | Check menu item availability | Small practice. |
| 1.22 | Appending/inserting/deleting | list mutation | Defer | OK | Ch2 | Cart/order editing | Ch2. |
| 1.23 | Sorting | sort/sorted | Defer | OK | Ch2/Ch3 | Sort report rows | Ch2/3. |
| 1.24 | Putting it all back together | list workflow | Defer | OK | Ch2 | Build order summary from list | Ch2. |
| 1.25 | Lists of anything | nested/heterogeneous lists | Defer | OK | Ch2 | Order records | Ch2. |
| 1.26 | File Preliminaries | file open/read | Adapt | FS | Ch2/L2-files | Read local menu CSV in virtual FS | Preload data in FS. |
| 1.27 | Reading a data file | file parsing | Adapt | FS | Ch2 | Read sales CSV | Core Ch2; use virtual FS. |
| 1.28 | Other kinds of files | gzip | Simulate | FS | Ch3 optional | Decompress archived report in virtual FS | `gzip` ok in Pyodide; FS setup needed. |
| 1.29 | Defining a function | functions | Direct | OK | Ch1/L1-06 | `calculate_total` practice | Core Ch1. |
| 1.30 | Turning a script into a function | refactor to function | Adapt | OK | Ch1/L1-06 | Refactor price script into function | Core Ch1. |
| 1.31 | Error handling | try/except | Adapt | OK | Ch1/L1-08 | Friendly invalid input | Core Ch1. |
| 1.32 | Using a library function | csv module/import | Defer | FS | Ch2 | Use `csv` module on virtual file | After basics. |
| 1.33 | Reading from command line | sys.argv/CLI | Simulate | CLI | Ch3 | Terminal-style args in simulated command | Replace shell argv with in-game command runner. |

## Section 2 — Working With Data (2.1–2.26)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 2.1 | Tuples | tuples | Defer | OK | Ch2 | Immutable menu item record | After Ch1. |
| 2.2 | Dictionaries as a data structure | dicts | Defer | OK | Ch2 | Product price lookup | Core Ch2. |
| 2.3 | Some additional dictionary operations | dict methods | Defer | OK | Ch2 | Update inventory/prices | Ch2. |
| 2.4 | A list of tuples | data structures | Defer | OK | Ch2 | Order rows | Ch2. |
| 2.5 | List of Dictionaries | records | Defer | OK | Ch2 | Sales records | Ch2. |
| 2.6 | Dictionaries as a container | lookup tables | Defer | OK | Ch2 | Price map by item name | Ch2. |
| 2.7 | Finding out if you can retire | data aggregation | Adapt | FS | Ch3 | Portfolio/savings summary from CSV | Reframe to relatable client report. |
| 2.8 | How to format numbers | formatting | Adapt | OK | Ch1/L1-04, Ch2 | Receipt/report formatting | Basic in Ch1, advanced in Ch2. |
| 2.9 | Collecting Data | building lists/dicts | Defer | FS | Ch2 | Parse CSV into records | Ch2. |
| 2.10 | Printing a formatted table | formatting/reporting | Defer | OK | Ch2 | Sales report table | Ch2 client deliverable. |
| 2.11 | Adding some headers | report formatting | Defer | OK | Ch2 | Report headers | Ch2. |
| 2.12 | Formatting Challenge | formatting | Defer | OK | Ch2 bonus | Polished report challenge | Optional. |
| 2.13 | Counting | counting/loops | Defer | OK | Ch2 | Count sold items | Ch2. |
| 2.14 | More sequence operations | slicing/sequence | Defer | OK | Ch2 | Top-N report rows | Ch2. |
| 2.15 | A practical enumerate() example | enumerate | Defer | OK | Ch2 | Numbered receipt/report lines | Ch2. |
| 2.16 | Using the zip() function | zip | Defer | OK | Ch3 | Combine columns/fields | Ch3. |
| 2.17 | Inverting a dictionary | dict transform | Defer | OK | Ch3 | Reverse lookup map | Ch3. |
| 2.18 | Tabulating with Counters | collections.Counter | Defer | OK | Ch3 | Count categories/errors | Ch3; stdlib ok. |
| 2.19 | List comprehensions | comprehensions | Defer | OK | Ch3/Ch7 | Filter/transform records | Introduce gently in Ch3. |
| 2.20 | Sequence Reductions | sum/min/max | Defer | OK | Ch2 | Totals and summaries | Ch2. |
| 2.21 | Data Queries | filtering | Defer | OK | Ch3 | Query records by condition | Ch3. |
| 2.22 | Data Extraction | transform/filter | Defer | OK | Ch3 | Extract report fields | Ch3. |
| 2.23 | Extracting Data From CSV Files | csv+comprehension | Adapt | FS | Ch3 | Clean CSV import mission | Virtual FS dataset. |
| 2.24 | First-class Data | functions as data | Defer | OK | Ch4/Ch7 | Pluggable formatter/validator | Advanced; defer. |
| 2.25 | Making dictionaries | dict construction | Defer | OK | Ch2 | Build lookup from rows | Ch2. |
| 2.26 | The Big Picture | data model thinking | Adapt | OK | Ch2 reflection | Mentor debrief: choosing data structures | Narrative reflection, no heavy code. |

## Section 3 — Program Organization (3.1–3.18)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 3.1 | Structuring a program as functions | decomposition | Adapt | OK | Ch1/L1-06, Ch4 | Split calculator/report into functions | Ch1 simple, Ch4 deeper. |
| 3.2 | Creating a top-level function | main/function structure | Adapt | OK | Ch4 | `main()` entrypoint pattern | Ch4. |
| 3.3 | Reading CSV Files | parsing | Adapt | FS | Ch2 | Read sales/menu CSV | FS dataset. |
| 3.4 | Building a Column Selector | function params | Defer | FS | Ch3 | Select report columns | Ch3. |
| 3.5 | Performing Type Conversion | conversion/error handling | Adapt | OK | Ch1/L1-07,L1-08 | Convert input safely | Core Ch1. |
| 3.6 | Working without Headers | flexible parsing | Defer | FS | Ch3 | Handle CSV variants | Ch3. |
| 3.7 | Picking a different column delimiter | parsing args | Simulate | FS/CLI | Ch3 | Configurable parser setting | Avoid CLI complexity; config param. |
| 3.8 | Raising exceptions | raise | Adapt | OK | Ch1/L1-08, Ch5 | Reject invalid values | Beginner-safe in Ch1; deeper in Ch5. |
| 3.9 | Catching exceptions | try/except | Direct | OK | Ch1/L1-08 | Invalid input handling | Core Ch1. |
| 3.10 | Silencing Errors | error policy | Adapt | OK | Ch5 | Decide log/skip/fail on bad rows | Professional error handling. |
| 3.11 | Module imports | imports/modules | Defer | OK | Ch4 | Split calculator/report modules | Ch4. |
| 3.12 | Using your library module | reuse | Defer | OK | Ch4 | Import helper module in main | Ch4. |
| 3.13 | Intentionally left blank (skip) | — | Exclude | — | — | — | Blank in source. |
| 3.14 | Using more library imports | stdlib imports | Defer | OK | Ch4 | Use `csv`/`json`/`datetime` appropriately | Ch4. |
| 3.15 | `main()` functions | main guard | Defer | CLI | Ch4 | Script entrypoint in project files | Adapt to Editor run model. |
| 3.16 | Making Scripts | script execution | Simulate | CLI | Ch4 | Run scripts in Terminal/Editor | Terminal already limited; simulate. |
| 3.17 | From filenames to file-like objects | file-like objects/gzip | Simulate | FS | Ch5 optional | Accept path or file-like object in parser | Keep advanced. |
| 3.18 | Fixing existing functions | refactor/bugfix | Adapt | OK | Ch5 | Bug ticket fixing mission | Great for debugging chapter. |

## Section 4 — Classes and Objects (4.1–4.11)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 4.1 | Objects as Data Structures | class basics | Defer | OK | Ch6 | Create `Product`/`OrderItem` class | Ch6. |
| 4.2 | Adding some Methods | methods | Defer | OK | Ch6 | Add `total()`/`discount()` methods | Ch6. |
| 4.3 | Creating a list of instances | object collections | Defer | OK | Ch6 | Inventory list of objects | Ch6. |
| 4.4 | Using your class | integration | Defer | OK | Ch6 | Use classes in report/app | Ch6. |
| 4.5 | An Extensibility Problem | design smell | Adapt | OK | Ch6 | Refactor rigid formatting/report code | Narrative code review. |
| 4.6 | Using Inheritance to Produce Different Output | inheritance | Defer | OK | Ch6 | Different report/output types | Ch6; careful with beginner complexity. |
| 4.7 | Polymorphism in Action | polymorphism | Defer | OK | Ch6 | Common interface for outputs | Ch6. |
| 4.8 | Putting it all together | OOP integration | Defer | OK | Ch6 | Mini inventory/report system | Ch6 capstone. |
| 4.9 | Better output for printing objects | `__repr__`/`__str__` | Defer | OK | Ch6 | Readable object display | Ch6. |
| 4.10 | An example of using getattr() | dynamic attrs | Defer | OK | Ch7 optional | Dynamic column/field access | Advanced; optional. |
| 4.11 | Defining a custom exception | custom exceptions | Defer | OK | Ch5/Ch6 | Domain validation exception | Ch5 or Ch6. |

## Section 5 — Inner Workings of Python Objects (5.1–5.8)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 5.1 | Representation of Instances | `__dict__` | Defer | OK | Ch6 advanced | Debug object state inspector | Optional advanced lesson. |
| 5.2 | Modification of Instance Data | attribute mutation | Defer | OK | Ch6 advanced | Controlled attribute changes | Optional. |
| 5.3 | The role of classes | class attrs/methods | Defer | OK | Ch6 | Explain class vs instance | Concept lesson. |
| 5.4 | Bound methods | method binding | Exclude/Defer | OK | — | — | Too internal for most players; optional dev note. |
| 5.5 | Inheritance | MRO/internals | Defer | OK | Ch6 | Inheritance debugging scenario | Keep simple. |
| 5.6 | Simple Properties | property | Defer | OK | Ch6 | Validate price via property | Useful practical subset. |
| 5.7 | Properties and Setters | setter validation | Defer | OK | Ch6 | Prevent negative prices | Practical. |
| 5.8 | Adding slots | `__slots__` | Exclude | OK | — | — | Low gameplay value; niche optimization. |

## Section 6 — Generators (6.1–6.15)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 6.1 | Iteration Illustrated | iteration protocol | Defer | OK | Ch7 | Walk through order stream | Ch7. |
| 6.2 | Supporting Iteration | custom iterable | Defer | OK | Ch7 | Iterable report/order collection | Ch7. |
| 6.3 | Making a more proper container | container protocol | Defer | OK | Ch7 | Inventory container | Advanced. |
| 6.4 | A Simple Generator | yield | Defer | OK | Ch7 | Generate sales events | Ch7. |
| 6.5 | Monitoring a streaming data source | streaming/tail | Simulate | PROC/FS | Ch7 | Simulated event feed in memory/file chunks | No long-running server/tail. |
| 6.6 | Using a generator to produce data | generator pipeline source | Simulate | PROC | Ch7 | Deterministic simulated feed | Replace stocksim. |
| 6.7 | Watching your portfolio | streaming updates | Simulate | PROC | Ch7 | Live dashboard simulation with queued events | No infinite process. |
| 6.8 | Setting up a simple pipeline | producer/consumer | Defer | OK | Ch7 | Filter/transform event stream | Ch7. |
| 6.9 | Setting up a more complex pipeline | pipeline | Defer | OK | Ch7 | Multi-stage report pipeline | Ch7. |
| 6.10 | Making more pipeline components | reusable pipeline parts | Defer | OK | Ch7 | Composable transforms | Ch7. |
| 6.11 | Filtering data | filtering generator | Defer | OK | Ch7 | Filter invalid/high-value orders | Ch7. |
| 6.12 | Putting it all together | pipeline integration | Defer | OK | Ch7 capstone | Streaming sales report | Ch7. |
| 6.13 | Generator Expressions | genexpr | Defer | OK | Ch7 | Compact transforms | Ch7. |
| 6.14 | Generator Expressions in Function Arguments | genexpr args | Defer | OK | Ch7 | Efficient summaries | Ch7. |
| 6.15 | Code simplification | refactor with generators | Defer | OK | Ch7 | Clean pipeline refactor | Ch7. |

## Section 7 — Advanced Topics (7.1–7.11)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 7.1 | A simple example of variable arguments | `*args` | Defer | OK | Ch8 | Flexible logging/report function | Ch8. |
| 7.2 | Passing tuple and dicts as arguments | arg unpacking | Defer | OK | Ch8 | Configure report builders | Ch8. |
| 7.3 | Creating a list of instances | dynamic construction | Defer | OK | Ch6/Ch8 | Build objects from records | Overlaps 4.3. |
| 7.4 | Argument pass-through | kwargs forwarding | Defer | OK | Ch8 | Wrapper/util functions | Ch8. |
| 7.5 | Sorting on a field | key functions | Defer | OK | Ch3/Ch8 | Sort records by field | Useful earlier in simplified form. |
| 7.6 | Sorting on a field with lambda | lambda | Defer | OK | Ch8 | Small key functions | Ch8. |
| 7.7 | Using Closures to Avoid Repetition | closures | Defer | OK | Ch8 | Configurable validators | Advanced. |
| 7.8 | Simplifying Function Calls | closures/partials concept | Defer | OK | Ch8 | Reusable configured functions | Advanced. |
| 7.9 | Putting it into practice | closures/practice | Defer | OK | Ch8 | Refactor repeated logic | Ch8. |
| 7.10 | A decorator for timing | decorators | Simulate | OK | Ch8 | Simulated performance badge/timing decorator | Timing in worker is noisy; keep conceptual. |
| 7.11 | Class Methods in Practice | classmethod | Defer | OK | Ch6/Ch8 | Alternate constructors | Ch8. |

## Section 8 — Testing, Logging, and Debugging (8.1–8.4)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 8.1 | Writing Unit Tests | unittest | Adapt | OK | Ch4/Ch5 | Write/run simple tests in Editor; explain assertions | `unittest` possible; may also use project test runner. |
| 8.2 | Adding logging to a module | logging | Simulate | FS | Ch5 | Logging concept; write log lines/file in virtual FS | Keep simple; avoid complex handlers. |
| 8.3 | Adding Logging to a Program | logging config | Simulate | FS | Ch5 | Add debug/info messages to app | Ch5. |
| 8.4 | Bugs? What Bugs? | debugging | Adapt | DBG | Ch5 | Guided bug hunt tickets | Excellent fit; use Editor diagnostics. |

## Section 9 — Packages (9.1–9.5)

| Original | Title | Concept | Action | Pyodide | Target | Proposed CodeQuest adaptation | Notes |
|---|---|---|---|---|---|---|---|
| 9.1 | Making a simple package | package layout | Adapt | FS | Ch8 | Create package folder in virtual FS | File structure only. |
| 9.2 | Making an application directory | app layout | Adapt | FS | Ch8 | Organize project files | Good professional practice. |
| 9.3 | Top-level Scripts | scripts in package | Simulate | CLI | Ch8 | Run entry script from Editor/Terminal | No real install. |
| 9.4 | Creating a Virtual Environment | venv/pip | Simulate | PKG | Ch8 concept lesson | Simulated "environment setup" tutorial; explain why | Cannot create real venv in browser. |
| 9.5 | Make a package | distribution/setup.py | Simulate | PKG | Ch8 capstone concept | Build distributable project metadata conceptually | No real pip install/build. |

## Coverage Summary (Exact, computed from mapping rows)

| Action | Count | Notes |
|---|---:|---|
| Direct | 3 | Directly usable with minimal framing |
| Adapt | 31 | Same learning objective, CodeQuest framing/Pyodide/FS adaptation |
| Simulate | 15 | Network/process/CLI/packaging replaced by in-game equivalents |
| Defer | 78 | Valuable; later chapter/prerequisite |
| Exclude/Exclude+Defer | 4 | 1.3, 3.13, 5.4/5.8 (niche/internal/blank/workflow-only) |
| **Total mapped rows** | **131** | Matches 131 exercise headings; 130 numbered exercises incl. blank 3.13 |

*Counts computed from the row-by-row table in this file on 2026-11-26. The row-by-row table is authoritative.*
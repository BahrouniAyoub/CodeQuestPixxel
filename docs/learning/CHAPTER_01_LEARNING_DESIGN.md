# Chapter 1 Learning Design — The First Paycheck (Revised)

> **Status**: Proposed design (documentation only). No gameplay/code changes made.  
> **Date**: 2026-11-26 (revised after Task 003 review)  
> **Approved design directions**: mentor-driven narrative, job-first learning, existing 8 quest IDs, scripted mentor interactions, reusable PixelOS tutorial system, existing Pyodide runtime.

## 1. Design Goal

Redesign Chapter 1 so the player discovers the Café Calculator job first, realizes they need Python skills, learns from mentor Alex, practices in a safe workspace, and then completes the real client mission. The existing Café story and $50 reward remain intact.

## 2. Preserved Facts (Verified)

- Canonical Chapter 1 quests are `CH1-01`..`CH1-08` in `src/features/chapter1/chapter1Quests.ts`.
- Reward is `$50` (`CHAPTER1_PAYMENT_REWARD = 50`), paid by CH1-07 only.
- CH1-01/02/08 are validated Godot bridge events; CH1-03..07 complete through PixelOS workflows.
- Existing Café project is implemented and complex (setup, dev tasks `CAFE-DEV-01..04`, doc `CAFE-DOC-01`, delivery, submission, approval, payment). Current tasks/validators are **not** changed by this design task.
- React Chapter 1 store is authoritative for quest progression; Godot consumes mirrored state.
- Pyodide worker is the existing Python runtime; no second runtime.

## 3. Narrative Flow (Approved Direction)

| Beat | Player action | App/World | Learning purpose | Quest impact |
|---:|---|---|---|---|
| 1 | Talks to Father | Godot living room | Motivation | CH1-01 preserved |
| 2 | Uses bedroom computer | Godot bedroom | Opens PixelOS | CH1-02 preserved |
| 3 | Discovers Café job on GigBoard | Browser/GigBoard | Creates need for Python | CH1-03 preserved |
| 4 | Realizes skill gap; contacts Alex | Mail | Seeks mentorship | Internal substep/gate before CH1-04 application |
| 5 | Receives learning pack | Mail/Browser | Structured learning | Internal unlock |
| 6 | Creates practice workspace | File Explorer | File/project organization | Guided tutorial + practice state |
| 7 | Completes mandatory learning path or passes readiness assessments | Browser Learn + Editor | Builds required skills | Unlocks CH1-04 application |
| 8 | Alex confirms readiness | Mail/Chat | Confidence transition | Unlocks accepting Café job |
| 9 | Accepts Café job | GigBoard | Commitment | CH1-04 completes on actual application |
| 10 | Completes client tasks | Tickets/Editor/FS | Apply skills | CH1-05 boundary preserved |
| 11 | Tests/documents | Tickets/Editor | Professional quality | CH1-05/06 flow preserved |
| 12 | Submits/delivers | GigBoard/Submission | Client communication | CH1-06 preserved |
| 13 | Claims $50 | Mail/Payment | Reward | CH1-07 preserved |
| 14 | Returns to Father | Godot | Closure | CH1-08 preserved |

## 4. Quest Compatibility Strategy (Proposed)

**No quest ID changes.** Learning is gated inside existing quest boundaries.

| Quest | Current objective | Proposed learning-aware behavior | Compatibility |
|---|---|---|---|
| CH1-01 | Talk to Dad | Unchanged | Godot bridge preserved |
| CH1-02 | Use computer | Unchanged | Godot bridge preserved |
| CH1-03 | Find Python job on GigBoard | Unchanged trigger; after discovery show "Need Python?" CTA + Mail to Alex | Completion semantics compatible |
| CH1-04 | Apply to café calculator project | Application UI gated by readiness: complete mandatory lessons/practice **or** pass readiness assessments. Quest completes only on actual application. | Old saves already at/past CH1-04 not blocked; no auto-complete |
| CH1-05 | Finish and test café project | Unchanged boundary; internal tasks may be simplified in future approved implementation | Current validators remain until replaced |
| CH1-06 | Submit finished project | Unchanged | Submission/approval preserved |
| CH1-07 | Claim $50 payment | Unchanged | One-time payment guard preserved |
| CH1-08 | Tell Dad | Unchanged | Bridge/payment guards preserved |

**Rule**: quest completion is authoritative. Learning completion is advisory for already-advanced players; mandatory only when current quest is at/before CH1-04 and player has not yet applied.

## 5. Mandatory Path Duration and Assessment Pass (Issue 2)

### 5.0 Approved progressive learning rule (Task 003 closure)

- Teach **print, variables, arithmetic, conditions, and functions** before accepting the Café job (CH1-04 application readiness).
- Introduce **string formatting, user input, and error handling** through contextual mentor lessons before the corresponding client tasks require them.
- These contextual lessons may be skipped only when the relevant skills have already been demonstrated through assessment.
- L1-03 and L1-05 do **not** require defining functions or using `input()` before those concepts are taught.

### 5.1 Shortened mandatory path (target 30–45 min, subject to playtesting)

The previous 8 lessons totaled ~94 min. The revised path splits content into **mandatory core**, **optional support**, and **readiness assessments**.

| Path | Content | Est. minutes | Required for CH1-04 application? |
|---|---|---:|---|
| Mandatory Core | L1-01, L1-02, L1-03, L1-05, L1-06 (condensed) | 35 min | Yes, unless assessments passed |
| Optional Support | L1-04 formatting deep dive, L1-07 input deep dive, L1-08 error deep dive, extra practice, glossary | 20–40 min | No |
| Readiness Assessments | 5 short practice assessments covering core skills | 10–15 min | Can substitute for mandatory lesson reading/practice |

**Total mandatory minimum**: ~35 min (core path) or ~10–15 min (experienced player passing assessments), plus Café task time. Final timing requires playtesting.

### 5.2 Experienced-player fast path

- Player may open "Check My Skills" from the learning hub.
- Each assessment is a small independent exercise with automated validation.
- Passing all required assessments unlocks CH1-04 application without forcing every lesson screen.
- Failing an assessment recommends the relevant lesson/support material but does not punish.
- **Skipping tutorials never completes programming assessments.** UI tutorial skip only affects tutorial state.

### 5.3 Optional support

- Extra explanations, analogies, and "why it works" panels.
- Additional practice exercises with different scenarios.
- Glossary: syntax, indentation, assignment, comparison, function call, parameter, return value, error message, traceback.
- Replayable worked examples in Editor.

## 6. Missing Prerequisite Resolution: Single-file vs Multi-file Café Project (Issue 3)

### 6.1 Facts (verified)

- Current dev workflow uses `/Projects/Python/cafe-calculator/calculator.py` and `main.py` (`CAFE_DEV_PROJECT_DIRECTORY`, `CAFE_DEV_FILE_NAMES`).
- `CAFE-DEV-04` includes a module-boundary sentinel test replacing `calculator` module to prove `main.py` imports it.
- Project module loading exists in Editor/runner (`projectModules`, `loadSiblingProjectModules`).
- Imports/modules/`__main__` are deferred to later Practical Python sections (3.11–3.16, 9.x) and are not beginner-friendly in Chapter 1.

### 6.2 Options

| Option | Description | Educational difficulty | Compatibility with existing validators | Recommendation impact |
|---|---|---|---|---|
| A. Simpler single-file Café project | One file, e.g. `cafe_calculator.py`, contains functions + simple input/output flow in one script | **Low/Medium** - best for absolute beginners; no import mental model | **Low for current CAFE-DEV validators** - incompatible with current `calculator.py`/`main.py` and module-boundary test; compatible with quest boundaries if adapter used | Best beginner learning experience |
| B. Multi-file with beginner import lessons | Keep `calculator.py` + `main.py`; add short lessons on `import`, files, `__name__ == "__main__"` | **Medium/High** - extra concepts, two-file coordination, import errors | **High** - aligns with current dev workflow/validators | Best technical compatibility, higher cognitive load |

### 6.3 Recommendation (proposed)

**Recommend Option A for the redesigned Chapter 1 beginner learning path, with a compatibility adapter strategy for future implementation.**

- **Educational rationale**: Chapter 1 targets absolute beginners. Requiring imports, module boundaries, and two-file coordination before first paid job increases failure risk and stretches mandatory time beyond 30–45 min.
- **Compatibility rationale**: Existing CAFE-DEV validators/tests are implementation assets and must not be changed now. Future implementation should introduce a simplified single-file client-task set for new learning-path players while preserving the existing multi-file workflow for legacy/in-progress saves through workflow selection/adapter logic (similar to existing legacy/dev workflow selection pattern).
- **Bridge strategy**: quest boundaries CH1-05/06/07 remain unchanged. Internal task validators may differ by workflow, but completion must still flow through existing authoritative quest/payment sync points.
- **Optional stretch**: offer an optional "Pro Structure" bonus after completion: split solution into `calculator.py` and `main.py`. This teaches imports without blocking first paycheck.

**Decision required before implementation**: approve single-file beginner path + adapter, or approve multi-file with added import lessons.

## 7. Lesson Specifications (Revised Pedagogy, Issue 1)

### 7.1 Pedagogical template (applies to every lesson)

Each lesson must contain:
1. **Beginner-friendly explanation** - plain language, no assumed knowledge.
2. **Concept prerequisites explained** - syntax, indentation, assignment, comparison, calls, params, returns, error messages as needed before use.
3. **Worked example (different scenario)** - not café/prices/discount/receipt/client data.
4. **Prediction/understanding question** - learner predicts output/behavior before running.
5. **Run and modify opportunity** - editable example in Editor with "try changing X" prompt.
6. **Independent practice exercise** - different scenario and different values.
7. **Progressive hints** - nudge → concept → targeted; no full solution for paid tasks.
8. **Automated validation** - multi-case where applicable; anti-hardcoding.
9. **Café application** - explicit "How this applies to the Café job" section, conceptual mapping only; no exact client solution code.

### 7.2 Mandatory core lessons (35 min target)

#### L1-01 — First Instructions (Mandatory, 6 min)
- **Objective**: Run Python code and use `print()` to show messages.
- **Prereqs explained**: what code is; syntax as punctuation rules; strings in quotes; parentheses as "give this to the command"; reading a simple error message.
- **Worked example (personal info)**: print name and favorite hobby on two lines. Example uses `name`/`hobby` text, not café.
- **Prediction question**: "What will Python show when this runs?" show two `print()` lines.
- **Run/modify**: change the hobby text and run again.
- **Independent practice (travel)**: print a two-line travel postcard: destination and message.
- **Hints**: H1 use `print()`; H2 put text in quotes; H3 use two print calls.
- **Validation**: no runtime error; stdout has >=2 non-empty lines; contains required keyword from prompt (case-insensitive). No café keywords required.
- **Hardcoding guard**: test uses two different expected keyword sets across variants? For simple print, accept any two non-empty lines plus required scenario keyword; avoid exact full sentence match.
- **Café application**: "In the Café job, you'll use `print()` to show clear messages/receipt labels. You'll decide the exact client text later."
- **Pass example**: two print lines including destination. **Fail example**: one line or missing keyword. **Hardcoded-fail N/A** (output task) but exact-copy of worked example should fail if it lacks required travel keyword.

#### L1-02 — Boxes for Information (Mandatory, 7 min)
- **Objective**: Create variables with assignment; understand `int`, `float`, `str`.
- **Prereqs explained**: assignment `=` means "store value in name"; variable names; difference between `3` and `"3"`; reading NameError/TypeError.
- **Worked example (books)**: `book_title = "The Hobbit"`, `pages = 310`, `rating = 4.5`; print them.
- **Prediction**: "What value is in `pages` after these lines?"
- **Run/modify**: change pages/rating and observe output.
- **Independent practice (cinema tickets)**: store movie name (str), tickets bought (int), ticket price (float), print them.
- **Hints**: H1 use `=`; H2 numbers without quotes; H3 float has decimal point.
- **Validation**: namespace checks for required variable names/types/values in selected cases? Use function/namespace assertions in same run: require variables exist and match case values. Avoid accepting hardcoded prints only.
- **Café application**: "The Café job stores item quantities/prices in variables. You'll choose the café variable names and values in the client task."
- **Pass**: correct variables and values. **Fail**: wrong type or missing variable. **Hardcoded-fail**: printing expected values without creating required variables fails namespace checks.

#### L1-03 — Doing the Math (Mandatory, 7 min)
- **Objective**: Use `+ - * /` and expressions; store result in a variable.
- **Prereqs explained**: arithmetic operators; expression evaluation; assignment stores result; `*` before `+` (basic precedence); print vs stored value. No functions required yet.
- **Worked example (salary, different scenario)**: weekly pay = `hours * hourly_rate`; store in `weekly_pay` and print it.
- **Prediction question**: "What is `total`?" for `8 * 10 + 2 * 5`.
- **Run/modify**: change hours/rate and rerun to see the new result.
- **Independent practice (shopping)**: given `notebooks = 3`, `pens = 2`, compute `total_cost` as notebooks at 4 each and pens at 2 each.
- **Progressive hints**: H1 multiply quantity by unit price; H2 add subtotals; H3 store in `total_cost`.
- **Automated validation**: namespace checks with controlled inputs. Case 1 sets `notebooks=3, pens=2`, expects `total_cost == 16`. Case 2 sets `notebooks=1, pens=5`, expects `total_cost == 14`. Validation may inject/override input variables before or assert after execution; no function definition required.
- **Anti-hardcode**: at least 2 cases with different values; hardcoded `total_cost = 16` fails case 2.
- **Café application (no solution)**: "The Café job needs price calculations. You'll use the same math pattern with the client's numbers later."
- **Pass**: correct `total_cost` for all cases. **Fail**: wrong operator/formula. **Hardcoded-fail**: constant value fails alternate case. **Friendly feedback**: "Check how you multiply quantity by price before adding."

#### L1-05 — Making Choices (Mandatory, 7 min)
- **Objective**: Use `if/elif/else` and comparison operators.
- **Prereqs explained**: comparison operators `== != < > <= >=`; boolean result; indentation blocks; colon; why `=` is not `==`. No functions or input required yet.
- **Worked example (cinema age rule, different scenario)**: if `age >= 18` print "Adult ticket", else "Youth ticket".
- **Prediction question**: Which branch runs for age 18?
- **Run/modify**: change age and boundary; rerun.
- **Independent practice (travel luggage)**: given `bag_weight`, if `bag_weight <= 20` print "OK", else print "Extra fee".
- **Progressive hints**: H1 use `if bag_weight <= 20:`; H2 indent print; H3 include else.
- **Automated validation**: controlled namespace/stdout cases. Set `bag_weight` to 20, 21, 19 across cases; expect correct output/branch. No function definition or `input()` required.
- **Anti-hardcode**: boundary and over/under cases; always printing "OK" fails overweight case.
- **Café application (no solution)**: "The Café job uses a condition for a discount rule. You'll apply the same decision pattern to client rules later."
- **Pass**: all boundary cases correct. **Fail**: uses `<` instead of `<=`. **Hardcoded-fail**: always "OK" fails overweight case. **Friendly feedback**: "Check the boundary: exactly 20 should still be OK."

#### L1-06 — Reusable Actions (Mandatory, 8 min)
- **Objective**: Define functions, parameters, return values, call functions.
- **Prereqs explained**: function definition `def`, parameters as inputs, indentation of body, `return` sends value back, function call uses parentheses, print vs return.
- **Worked example (travel time)**: `def travel_minutes(hours, minutes): return hours * 60 + minutes`.
- **Prediction**: what does `travel_minutes(2, 30)` return?
- **Run/modify**: add a third parameter or change formula.
- **Independent practice (salary bonus)**: `def total_pay(base, bonus):` returns sum.
- **Hints**: H1 define with two params; H2 compute sum; H3 use `return`.
- **Validation**: call function with multiple cases; assert return values; check function exists. Structural check: AST confirms `FunctionDef` named as required and has `return`.
- **Café application**: "The Café job uses functions for calculations. You'll write café functions after you understand this pattern."
- **Pass**: correct returns for all cases. **Fail**: prints instead of returns. **Hardcoded-fail**: `return 100` fails other cases.

### 7.3 Optional support lessons (not required if assessments passed)

#### L1-04 — Clear Messages (Optional, 6 min)
- **Objective**: Build readable strings with f-strings/concatenation.
- **Scenario**: personal info/profile card; **not** receipts/prices.
- **Café application**: formatting clear output/messages later.

#### L1-07 — Getting Input (Optional, 8 min)
- **Objective**: `input()`, `int()`/`float()` conversion.
- **Prereqs explained**: input returns string; conversion; ValueError.
- **Scenario**: asking for number of books to borrow; **not** café order quantities.
- **Café application**: client program may ask user for quantities.

#### L1-08 — Handling Mistakes (Optional, 8 min)
- **Objective**: read errors, use `try/except ValueError`, friendly messages.
- **Scenario**: cinema ticket count entry; **not** café quantity validation.
- **Café application**: client program should handle invalid input gracefully.

### 7.4 Readiness assessments (fast path)

| Assessment | Covers | Scenario | Pass criteria |
|---|---|---|---|
| A1 Output & Variables | L1-01,L1-02 | personal profile | required vars/types + output |
| A2 Math | L1-03 | shopping subtotal | multi-case namespace checks (controlled inputs) |
| A3 Decisions | L1-05 | shipping fee rule | boundary cases via controlled inputs/stdout checks |
| A4 Functions | L1-06 | unit conversion | multi-case return + AST function check |
| A5 Input/Validation (optional unless café task requires) | L1-07,L1-08 | simple number entry | valid/invalid stdin cases, no traceback |

Passing A1–A4 unlocks application readiness for the simplified single-file Café proposal. A5 becomes required when the active client task requires input/validation.

## 8. Practice Validation Design (Issue 4)

### 8.1 Validation capabilities with existing runner

The existing Pyodide runner supports code execution, stdin, stdout capture, result/error metadata, timeout/output limits, and project modules. Validation should use:

- **Multi-case execution**: run same code/function against multiple inputs.
- **Namespace checks**: after execution, inspect variables in Python namespace via `pythonCheck` assertions.
- **Function assertions**: call required functions with different args and assert returns.
- **Stdout checks**: case-insensitive contains/regex for message presence; avoid exact full output unless necessary.
- **Structural checks (limited)**: `ast.parse` inside `pythonCheck` to confirm constructs (e.g., has function, has `if`, has `try/except`) — use sparingly to avoid false negatives.
- **No-traceback checks**: invalid input cases must not produce traceback.

### 8.2 Anti-hardcoding rules

- Every computation exercise uses >=2 cases with different values.
- At least one case should be hidden in client/assessment mode where appropriate; practice may show all.
- Function tasks assert return values, not just printed constants.
- Output tasks check required meaning/keywords, not entire copied sentence where possible.
- Hardcoded constants that satisfy one case but fail others must fail.

### 8.3 Exercise validation examples (template)

For every exercise, content author provides:

| Example | Should | Why |
|---|---|---|
| Valid solution | Pass | Meets behavior for all cases |
| Incorrect solution | Fail | Wrong logic/operator/boundary/type |
| Hardcoded solution | Fail (when computation required) | Passes one case, fails alternate case |
| Friendly feedback | Shown on fail | Explains what went wrong and what to try next, no solution leak |

### 8.4 Sample: L1-03 shopping total

- **Valid pass**: computes `notebooks * 4 + pens * 2` for given inputs; passes case 1 (`3,2 -> 16`) and case 2 (`1,5 -> 14`).
- **Incorrect fail**: uses `+` instead of `*` or forgets one item; feedback "Check how you multiply quantity by price before adding."
- **Hardcoded fail**: `total_cost = 16`; fails case 2; feedback "Your code works for one example, but it needs to calculate from the values given."
- **Friendly error feedback**: NameError -> "Python can't find that name yet. Check spelling and make sure you created the variable first."

### 8.5 Sample: L1-05 luggage rule

- **Valid pass**: `weight <= 20` returns/prints OK, else Extra fee; boundary 20 passes.
- **Incorrect fail**: uses `< 20`; boundary 20 fails; feedback "Check the boundary: exactly 20 should still be OK."
- **Hardcoded fail**: always "OK"; overweight case fails.
- **Friendly feedback**: IndentationError -> "Python uses indentation to know what code belongs inside the `if`. Indent the line under `if` by 4 spaces."

## 9. Simplified Café Client Task Sequence (Proposed, no implementation)

Single-file beginner recommendation (Option A). Existing CAFE-DEV/CAFE-DOC remain unchanged.

| Proposed ID | Client request | Required skills | Target file | Validation focus |
|---|---|---|---|---|
| CAFE-S1 | Calculate order total | variables, arithmetic, function, return | `cafe_calculator.py` | multi-case function assertions |
| CAFE-S2 | Apply discount rule | conditions, comparison, boundary | `cafe_calculator.py` | boundary 19.99/20/20.01, multi-case |
| CAFE-S3 | Show clear summary | strings/f-strings, print/return | `cafe_calculator.py` | required labels/values, tolerant formatting |
| CAFE-S4 | Ask for quantities | input, conversion | `cafe_calculator.py` | stdin cases, int conversion |
| CAFE-S5 | Handle invalid input | try/except, friendly message | `cafe_calculator.py` | invalid stdin, no traceback, friendly message |
| CAFE-S6 | Document and deliver | README, testing habit | `README.md` | deterministic checklist, no solution leak |

Optional stretch after CH1-07/08 or post-completion: split into `calculator.py` + `main.py` (Pro Structure bonus).

## 10. Practice Workspace Design

- **Location**: `/Projects/Python/practice/ch1/` (proposed virtual FS path).
- **Rule**: practice files separate from client deliverables.
- **Creation**: idempotent; never overwrite existing user files.
- **Editor**: "Open Practice", "Run", "Submit Practice", "Try Assessment".

## 11. Save/Progress Rules for Chapter 1 Learning (summary; details in Architecture Proposal)

- **Quest authority**: `chapter1Store`/Godot bridge remains authoritative for CH1-01..08.
- **Learning progress**: separate per-save record; does not grant quest completion or payment.
- **Tutorial UI prefs**: global/local UI preferences can be separated from per-save gameplay progress.
- **No schema changes/migrations in this task**.

## 12. Open Decisions

1. Approve single-file beginner Café path (Option A) with future compatibility adapter, or multi-file Option B with added import lessons.
2. Approve mandatory-core + assessment-pass gating for CH1-04 application.
3. Approve save ownership split (global UI prefs vs per-save learning/gameplay progress).
4. Approve validation contract extensions (AST/namespace/multi-case) using existing Pyodide runner.
5. Approve CC BY-SA attribution/content handling before publishing adapted material.
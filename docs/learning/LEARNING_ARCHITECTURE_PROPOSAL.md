# Learning Architecture Proposal (Revised)

> **Status**: Proposed design (documentation only). No implementation. No code changes.  
> **Date**: 2026-11-26 (revised after Task 003 review)

## 1. Goals

- Support future chapters, lessons, practice exercises, client tasks, tutorials, and mentor interactions.
- Reuse existing Pyodide runner, virtual filesystem, Editor/Tickets/Cafe patterns, Chapter 1 quest authority, and IndexedDB persistence.
- Keep learning content data-driven and separable from game engine code.
- Add robust practice validation (anti-hardcoding, multi-case, clear feedback) and clear save ownership.

## 2. Existing Reusable Components (Verified)

| Component | Path | Reuse |
|---|---|---|
| Pyodide runner | `src/services/runner/pyodideRunner.ts`, `public/python-worker.js` | Execute practice/client code; do not duplicate |
| Runner test harness | `src/services/runner/testing.ts` (and types) | Extend for lesson/practice validation contracts |
| Project module loading | `src/features/editor/projectModules.ts` | Multi-file practice/client projects |
| Virtual filesystem | `src/services/filesystem/*` | Practice/client files, datasets |
| Editor app | `src/features/editor/EditorApp.tsx` | Run/save/submit flow; add lesson mode via props/store, not fork |
| Tickets/cafe boards | `src/features/tickets/*`, `src/features/chapter1/cafeCoding/*` | Client task UI patterns, validation feedback |
| Chapter 1 quest store | `src/features/chapter1/chapter1Store.ts` | Canonical quest progression authority |
| Bridge | `src/features/chapter1/godotBridge.ts`, `src/routes/game.tsx` | Godot sync; no new authority source |
| Persistence | `src/services/persistence/db.ts`, `saveStatus.ts` | Versioned records, atomic commits, save status |
| Notifications | `src/features/notifications/notificationStore.ts` | Feedback/toasts |
| App registry/window manager | `src/core/applications/registry.ts`, `src/core/windows/*` | Open/focus apps for tutorials/lessons |

## 3. Proposed Domain Model

```ts
interface Chapter {
  id: string;                    // "ch1"
  title: string;
  stage: "beginner"|"freelancer"|"junior"|"developer"|"experienced";
  questIds: string[];            // maps to canonical quest IDs where applicable
  missionIds: string[];
  skillIds: string[];
  rewardIds: string[];
}

interface Lesson {
  id: string;
  missionId: string;
  title: string;
  objective: string;
  conceptTags: string[];
  prerequisites: string[];
  explanationBlocks: ContentBlock[];
  workedExample: { code: string; explanation: string; scenario: string };
  predictionQuestion?: { prompt: string; choices?: string[]; answer: string; explanation: string };
  practiceExerciseId: string;
  readinessAssessmentId?: string;
  mentorDialogueIds: string[];
  estimatedMinutes: number;
  difficulty: "beginner"|"easy"|"medium"|"hard";
  required: boolean;             // mandatory core vs optional support
}

interface PracticeExercise {
  id: string;
  lessonId: string;
  title: string;
  instructions: string;
  starterCode: string;
  targetFiles: FileTarget[];
  hints: Hint[];
  validation: ValidationSpec;
  referenceSolution?: never;     // never exposed to player-facing content
}

interface ValidationSpec {
  mode: "composite";
  runtime: { timeoutMs: number; outputLimit: number };
  cases: ValidationCase[];
  antiHardcode?: AntiHardcodeRule[];
  structureChecks?: StructureCheck[];
  feedback: FeedbackMap;
}

interface ValidationCase {
  id: string;
  name: string;
  hidden?: boolean;
  stdin?: string[];
  setupCode?: string;            // Python setup in same run, e.g. override variables
  assertions: ValidationAssertion[];
}

interface ValidationAssertion {
  id: string;
  type:
    | "stdout_contains"
    | "stdout_regex"
    | "namespace_equals"
    | "namespace_type"
    | "function_exists"
    | "function_returns"
    | "function_raises"
    | "no_traceback"
    | "ast_has"
    | "ast_forbids"              // use sparingly; avoid false negatives
    | "file_exists"
    | "file_contains";
  target?: string;               // variable/function/file name
  args?: unknown[];
  expected?: unknown;
  messageKey: string;            // maps to friendly feedback
}

interface StructureCheck {
  id: string;
  kind: "function_def" | "if" | "for" | "while" | "try_except" | "import" | "return";
  name?: string;
  required: boolean;
  messageKey: string;
}

interface AntiHardcodeRule {
  id: string;
  kind: "multi_case_mismatch" | "constant_return" | "stdout_only_constant";
  messageKey: string;
}

interface FeedbackMap {
  [messageKey: string]: {
    title: string;
    detail: string;              // beginner-friendly, actionable
    hintLevel?: 1|2|3;
  };
}
```

## 4. Practice Validation Contract (Issue 4)

### 4.1 Goals

- Accept correct behavior, not a single hardcoded answer.
- Reject hardcoded solutions where computation/logic is required.
- Provide beginner-friendly, actionable feedback.
- Run within existing Pyodide worker constraints.
- Keep reference solutions out of player-facing content.

### 4.2 Runner capabilities (existing, to reuse)

The existing Pyodide runtime provides: code execution, stdin, stdout/stderr capture, result/error metadata, timeout/output limits, and project module loading. Validation should compose these capabilities; no second runtime.

### 4.3 Validation strategy

| Check type | How it works in existing runner | Use for | Anti-hardcoding role |
|---|---|---|---|
| Multi-case function assertions | Execute student code, then call `pythonCheck`/assertions invoking functions with different args | Functions, calculations, decisions | Primary defense: hardcoded return fails alternate cases |
| Namespace checks | After execution, inspect variables in namespace (`globals()`/module scope) via check code | Variables, types, computed values | Ensures values were created/computed, not just printed |
| Stdout checks | Compare stdout against contains/regex/normalized lines | Print/output tasks | Use tolerant checks; combine with namespace when possible |
| Stdin multi-case | Run same saved code with multiple stdin arrays | Input/validation programs | Different inputs must produce correct outputs |
| No-traceback | Assert run completed without unhandled exception | Invalid-input handling | Ensures try/except/friendly handling |
| Limited structural AST checks | `ast.parse` in check code inside Pyodide; inspect node types/names | Require function/if/try/return exists | Secondary signal; avoid over-constraining style |
| File/content checks | Read virtual FS content | README/docs tasks | Deterministic checklist, no solution leak |

### 4.4 Anti-hardcoding rules

- **Computation required**: >=2 cases with different inputs/expected outputs; at least one hidden in assessment mode.
- **Output required**: check meaning/keywords/structure, not exact full copied sentence unless formatting is explicitly taught.
- **Function required**: assert function exists, call with multiple cases, check return value and type where relevant.
- **No constant-only pass**: if a single literal return/print satisfies case 1 but fails case 2, fail with feedback "Your code works for one example, but it needs to calculate from the values given."
- **AST checks are limited**: use only for essential constructs; never reject correct alternative logic just because style differs.

### 4.5 Feedback contract

Every failed assertion maps to beginner-friendly feedback:

- **What happened**: plain language.
- **Why it matters**: link to concept.
- **What to try next**: actionable nudge, no full solution.
- **Error translation**: NameError/SyntaxError/IndentationError/TypeError/ValueError mapped to friendly explanations.

### 4.6 Per-exercise validation examples

#### Example A — L1-03 Shopping Total (function/computation)

**Exercise**: Write `calculate_shopping_total(notebooks, pens)` returning total cost where notebooks cost 4 and pens cost 2.

| Case | Input | Expected | Visible |
|---|---:|---:|---|
| C1 | `3, 2` | `16` | Yes |
| C2 | `1, 5` | `14` | Yes/practice, hidden in assessment |
| C3 | `0, 0` | `0` | Hidden |

| Submission | Result | Feedback |
|---|---|---|
| `return notebooks*4 + pens*2` | **Pass** | "Nice work — your function calculates from the inputs." |
| `return notebooks*4 + pens` | **Fail** | "Close. Check the pen price: each pen should be multiplied by 2." |
| `return 16` | **Fail (hardcoded)** | "Your code works for one example, but it needs to calculate from the values given. Try using `notebooks` and `pens` in your formula." |
| Missing function / syntax error | **Fail** | "Python couldn't find `calculate_shopping_total`. Check the function name and `def` line." |

#### Example B — L1-05 Luggage Rule (condition/boundary)

**Exercise**: `check_bag_weight(weight)` returns `"OK"` if weight <= 20 else `"Extra fee"`.

| Case | Input | Expected | Notes |
|---:|---:|---|---|
| C1 | `20` | `OK` | Boundary |
| C2 | `21` | `Extra fee` | Over |
| C3 | `19` | `OK` | Under |

| Submission | Result | Feedback |
|---|---|---|
| Correct `if weight <= 20` | **Pass** | Boundary handled correctly. |
| Uses `weight < 20` | **Fail** | "Check the boundary: exactly 20 should still be OK." |
| Always returns `"OK"` | **Fail (hardcoded)** | "Your code needs to make a decision based on `weight`. Right now it gives the same answer for every case." |
| Uses `=` instead of `==` in comparison context (or assignment misuse) | **Fail** | "In Python, `=` stores a value and `==` compares values. Use `<=` for this check." |

#### Example C — L1-07/A5 Input Validation (stdin/no traceback)

**Exercise**: Ask for ticket count; convert to int; if invalid, print friendly message.

| Case | stdin | Expected behavior | Visible |
|---|---|---|---|
| C1 | `"3"` | accepts number, no traceback | Yes |
| C2 | `"abc"` | friendly invalid-input message, no traceback | Yes |
| C3 | `"-1"` or `"0"` (if rule specified) | defined behavior per prompt | Hidden |

| Submission | Result | Feedback |
|---|---|---|
| Uses `try/except ValueError` and friendly message | **Pass** | Handles valid and invalid input. |
| Converts without try/except | **Fail** | "When someone types text instead of a number, Python raises a ValueError. Use `try/except ValueError` to show a friendly message." |
| Hardcodes `print("3 tickets")` | **Fail** | "Your program should read the input and respond to it, not always print the same answer." |

### 4.7 Reference solutions

- Reference solutions may exist only in authoring/internal test fixtures, never in player-facing lesson content, hints, mail, chat, or UI.
- Paid Café task solutions must not be revealed before/through learning content.

## 5. Save Ownership and Persistence (Issue 6)

### 5.1 Systems analyzed (verified)

| System | Owner | Storage | Verified facts |
|---|---|---|---|
| Godot save | Godot game | Local `user://codequest_saves.json`, slots `auto/1/2/3` (per existing project context) | Godot-side world/progression save slots; React receives/imports snapshots via bridge. |
| React Chapter 1 quest state | React/Zustand + IndexedDB | IndexedDB `codequest-pixel-os` v1, store `progress`, key `chapter1` (`CHAPTER1_STORAGE_KEY`) | Canonical quest progression authority; validated prefix-only save record. |
| Café/project payment/milestone/dev/doc/submission | React/Zustand + IndexedDB | `progress` keys `chapter1-cafe-*` (verified in code) | Per-save gameplay records tied to Chapter 1 flow. |
| Virtual filesystem | React service + IndexedDB | `fs` store | Project/practice files; player work product. |
| Drafts | IndexedDB | `drafts` store | Editor drafts / unsaved work buffers. |
| Preferences/UI | IndexedDB | `prefs` store | Settings/window geometry/UI prefs, not progression. |
| Chat state | IndexedDB | `chat` store | Chat messages/read state. |
| Bridge mirror/snapshot | React + Godot bridge | In-memory message + Godot save payload | Coordination mechanism, not a second authority. |

### 5.2 Ownership matrix (proposed)

| Data | Ownership | Scope | Persisted in | Notes |
|---|---|---|---|---|
| CH1-01..CH1-08 quest completion | **React chapter1Store authoritative**; Godot mirrors | Per save slot / per playthrough | React `progress/chapter1` + Godot save snapshot | No second authority; bridge sync only |
| Café payment/reward | React payment commit + chapter1Store | Per save | `progress/chapter1-cafe-project-payment` + `chapter1` atomic commit | One-time; dedupe by durable record |
| Lesson/practice completion | Learning progress store (proposed) | **Per save** | `progress/learning:ch1` (new key, no schema change now) | Never completes CH1 quests or payment |
| Readiness assessment pass | Learning progress store (proposed) | **Per save** | `progress/learning:ch1` | Unlocks CH1-04 application gate only |
| Practice files | Virtual FS | **Per save/playthrough** if saves are isolated; otherwise global with clear warning | `fs` store | See isolation decision; no overwrite of user files |
| Tutorial UI seen/skipped/replay pref | Tutorial prefs (proposed) | **Global (per browser/profile)** | `prefs/tutorials:v1` | UI convenience only; no gameplay rewards |
| Accessibility/UI settings | Settings store | **Global** | `prefs` | Reduce motion, UI scale, etc. |
| Mentor scripted message dedupe IDs | Progress/chat record (proposed) | **Per save** | `progress/mentor:ch1` or chat metadata | Prevent duplicate scripted sends on reload/resume |
| Chat history | Chat store | Per save preferred; currently chat store | `chat` | If global today, migration decision needed later |
| Café dev/doc/milestone/submission | Existing stores | Per save | `progress/chapter1-cafe-*` | Existing behavior preserved |

### 5.3 Scenario behavior (proposed)

| Scenario | Quest/progression | Learning/practice | Tutorial prefs | Mentor messages/XP/payment | Learning gates |
|---|---|---|---|---|---|
| **Start new game** | New Godot slot/progression; React per-save state initialized/reset per slot strategy | New empty per-save learning record; practice files bootstrapped idempotently | Global prefs retained (replayable), or reset only by explicit user action | No duplicated XP/payment; mentor intro can appear once per save | Gates evaluated from new save state |
| **Save to different slots** | Each slot has independent Godot/React progression snapshot | Each slot has independent per-save learning record and practice/workspace state | Global UI prefs shared; gameplay-gated tutorial eligibility derived from slot | Dedupe keys scoped by save/slot; no cross-slot XP/payment duplication | Gates computed per slot |
| **Load earlier save** | Restore slot's quest/chapter/payment state; chapter1Store adopts restored snapshot | Restore that slot's learning record; do not leak progress from newer slot | Global UI prefs remain; active tutorial resumes only if compatible | No re-grant of already-claimed rewards; dedupe prevents repeated mentor reward messages | Gates reflect loaded save; if CH1-04 already applied, no re-gating |
| **Refresh browser** | Hydrate from IndexedDB/bridge; React remains authority | Hydrate learning record; in-progress lesson UI resumes safely | Retain global prefs; resume tutorial if target recoverable else pause | Dedupe IDs prevent duplicate scripted messages/XP/payment notifications | Same as before refresh |
| **Resume existing Café assignment** | Quest state unchanged unless actual completion event occurs | Learning can remain available; readiness gate irrelevant if CH1-04 complete | Tutorials contextual and skippable | No new payment/XP grants | No re-locking of completed quest boundaries |
| **Load completed Chapter 1** | Completed state preserved; CH1-08 complete | Learning records may be read-only/archived; optional replay allowed | Tutorials optional | No duplicate payment/XP; completion mail not resent unless dedupe missing (must prevent) | No learning gate blocks already-completed chapter |

### 5.4 Dedupe and authority rules

- **Quest completion**: only `chapter1Store`/existing bridge completion handlers can complete CH1 quests.
- **Payment**: only existing atomic payment commit flow grants $50; deduped by durable payment record.
- **XP/rewards**: learning XP (if added) uses per-save reward grant IDs; never re-grant on reload/load.
- **Mentor scripted messages**: each scripted send has stable `scriptId` + `saveScopeId`; send only if not recorded.
- **Tutorial completion**: UI state only; must not emit quest/payment/assessment-pass events.
- **Assessment pass**: recorded as learning progress; can unlock CH1-04 application eligibility but does not call `completeQuest`.

### 5.5 Save isolation constraint

Current IndexedDB is browser-profile scoped (`codequest-pixel-os`). Godot has slots. A full per-slot isolation of React IndexedDB data requires an explicit design/ADR and possible key-prefixing or slot-aware DB strategy. **No schema/migration changes in this task.** Proposal for implementation: scope per-save React records by a `saveSlotId`/`playthroughId` provided by bridge/save snapshot; migrate carefully with ADR approval.

## 6. Integration with Existing Café Flow

- Short term: keep current CAFE-DEV/CAFE-DOC data and validators as-is.
- New beginner path: simplified single-file client tasks (proposed) with separate task IDs/validators; selected by workflow/adaptation layer.
- `cafeQuestSync.ts` remains boundary for CH1-05/06 completion.
- Learning system must call existing authoritative flows, not duplicate them.

## 7. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Dual progression systems drift | Single authority: chapter1Store for quests; learningProgressStore for lessons/practice only |
| Overly rigid validators | Multi-case, tolerant output checks, AST limited, clear failure messages |
| Hardcoded answers pass | Multi-case + hidden case + namespace/function assertions |
| Save slot leakage | Slot-scoped per-save records in future ADR; no migration now |
| Duplicate rewards/messages | Durable dedupe IDs per save scope |
| Pyodide performance | Cache worker readiness, limit test count, run progressively |
| Save incompatibility | No schema change now; ADR before any migration |

## 8. Implementation Boundary

This proposal is design-only. Before implementation: create ADRs for save ownership/slot scoping, quest gating, validation contract, tutorial dependency choice, and content licensing/distribution.
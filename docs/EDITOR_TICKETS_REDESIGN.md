# Editor / Tickets Redesign — Stage B, Step 8A

## 1. Summary

Stage B, Step 8A moves the Chapter 1 café project guidance out of the Code
Editor and into the existing Tickets app. The editor is now a focused Python
workspace: title, file path, CodeMirror, Run / Run Tests, stdin, output, errors,
save state, file/ticket modes, and back-to-ticket navigation all remain, but the
large café instructional panel is gone.

The Tickets app gains a **Café Calculator** project view beside **My Tickets**.
It presents the three existing café milestones as development tasks (CAFÉ-1,
CAFÉ-2, CAFÉ-3) with descriptions, full instructions, expected behavior,
examples, acceptance criteria, progressive hints, status, **Open in Editor**,
and **Verify Task**. The task definitions come from the canonical
`cafeMilestones.ts`; no second source of truth was added.

All existing café behavior is preserved: sequential completion, persistence,
setup gating, provisional legacy-save compatibility, milestone validation via
the Pyodide runner, and CH1-05 completion only after 3/3. No XP, money, ticket
completion, Godot/bridge, or GigBoard application logic changed.

## 2. Files created and modified

### Created

- `src/features/chapter1/cafeCoding/cafeTaskStatus.ts` — pure status
  (`locked` / `available` / `in-progress` / `completed`) and action-gating
  helpers for **Open in Editor** and **Verify Task**.
- `src/features/chapter1/cafeCoding/cafeTaskVerification.ts` — saved-file
  verification: reads the canonical milestone file, validates it, completes at
  most one milestone, and syncs CH1-05 only at 3/3.
- `src/features/tickets/CafeProjectBoard.tsx` — café project UI inside Tickets.
- `src/features/tickets/cafe-project-board.css` — café board and project-tab
  styling.
- `src/features/tickets/ticketsViewState.ts` — module-level memory for the
  selected Tickets view and café task, so switching apps/windows does not reset
  the selection.
- `src/features/chapter1/cafeCoding/cafeTaskStatus.test.ts`
- `src/features/chapter1/cafeCoding/cafeTaskVerification.test.ts`
- `src/features/tickets/CafeProjectBoard.test.tsx`
- `src/features/tickets/TicketsApp.test.tsx`

### Modified

- `src/features/editor/EditorApp.tsx` — removed the café panel import and
  render; editor behavior otherwise unchanged.
- `src/features/editor/EditorApp.test.tsx` — asserts the café instructions are
  absent from the editor and that Run still works.
- `src/features/chapter1/cafeCoding/cafeMilestones.ts` — added display-only
  `expectedBehavior` and `hints` fields to the three milestones. Ids, files,
  instructions, examples, starter code, and Python checks are unchanged.
- `src/features/chapter1/cafeCoding/cafeMilestones.test.ts` — checks the new
  display fields.
- `src/features/tickets/TicketsApp.tsx` — added the **My Tickets** /
  **Café Calculator** project switcher and renders `CafeProjectBoard` when the
  café view is active. General ticket behavior is unchanged.

Not changed: `CQ-001`…`CQ-005` definitions, progress/XP logic, Chapter 1 quest
definitions, café setup definitions and validation, milestone store/validator,
GigBoard application logic, Godot bridge, and the temporary DEV GigBoard panel.

## 3. Before / after behavior

### Before

- The Editor showed a prominent café project panel with milestone progress,
  instructions, hints, and a **Run Tests** action.
- Café instructions were only available while the editor was open, and the
  panel competed with the actual code workspace.
- The café project was not visible in the Tickets app.

### After

- The Editor contains only the Python workspace and its existing ticket/file
  controls. There is no café milestone panel, no café **Run Tests** button, and
  no café instructions in the editor.
- The Tickets app contains a dedicated café client project. Tasks read like
  development tickets, with status and verification in the same place as the
  work description.
- Opening a café task from Tickets opens the canonical file in the existing
  editor window; instructions stay in Tickets.
- Verification is triggered from Tickets and always checks the saved canonical
  file.

## 4. Tickets presentation

The café board is a self-contained section inside the existing `TicketsApp`; it
does not create a second Tickets app.

- **Project header** — client (Alex Morgan), project name, completed count,
  percentage, and progress bar.
- **Task list** — CAFÉ-1 / CAFÉ-2 / CAFÉ-3 mapped to the canonical milestones,
  each with its title, file name, and status:
  - **Locked** — not the current milestone.
  - **Available** — current milestone, file not created/saved yet.
  - **In Progress** — current milestone with its canonical file present.
  - **Completed** — recorded in the persisted milestone progress.
- **Task detail** — description, instructions, expected behavior, example,
  acceptance criteria (from `milestone.tests[].name`), and developer hints.
- **Hints** are progressive and explicitly free of XP penalties.
- **Open in Editor** — opens the canonical milestone file in the existing
  editor window.
- **Verify Task** — runs the existing Pyodide milestone validator against the
  saved file.
- **Feedback** — per-test outcomes, pass/fail summary, missing-file and gating
  messages, and a delivery-ready state at 3/3.

The general **My Tickets** view keeps the existing CQ-001…CQ-005 experience:
search, status filters, issue list, detail sections, hints, locked/completed
states, and **Open in Code Editor**.

## 5. Navigation

- A **Project views** tab list switches between **My Tickets** and
  **Café Calculator** without leaving the Tickets app.
- Selecting a café task updates the detail pane and is remembered in
  module-level state. Closing/reopening the Tickets window or switching to
  another app and back restores the last view and task.
- **Open in Editor** reuses the window manager and file session:
  `openCafeMilestoneInEditor` opens the canonical path, focuses the existing
  editor window, and returns the player to code.
- No second editor, runtime, filesystem, or database was added.

## 6. Verification

Verification is handled by `verifyCafeTaskFromSavedFile` and the existing
milestone validator/store.

1. The task must be the current milestone. Locked tasks never run Python.
2. If the canonical file is open with unsaved changes, verification is blocked
   with a save/discard message. Changes in a *different* open file do not block
   verification.
3. The canonical `milestone.filePath` is read from the filesystem with
   `getEntry`. Verification never uses the editor's in-memory draft and never
   uses whichever file happens to be open.
4. The saved content is validated by `validateCafeMilestone` with the shared
   Pyodide runner.
5. Failed tests keep the task incomplete and leave progress untouched.
6. A passing result calls `completeMilestone` exactly once. The store rejects
   skips and duplicates, so only one milestone can be recorded per pass.
7. Chapter 1 is advanced through `syncCafeProjectQuestFromStores` only when the
   third milestone is complete. Before 3/3, CH1-05 remains active.
8. If the CH1-05 save fails after 3/3, the board shows a retry action and does
   not ask the player to rerun the tests. A later board mount also retries the
   quest sync once.

Milestone completion changes only the isolated
`chapter1-cafe-milestones` progress record and, at 3/3, CH1-05 quest
bookkeeping. It never awards ticket XP, never changes `money`, and never claims
the $50 payment.

## 7. Setup gating and compatibility

- A new save must complete the Stage B Step 7 café setup in GigBoard before
  café tasks can be opened or verified. The board explains which setup task is
  current and points the player to GigBoard.
- Setup gating blocks **Open in Editor** and **Verify Task** without creating or
  overwriting files.
- Legacy development saves with existing milestone progress or a legacy
  milestone file are detected and allowed to continue without the new setup
  phase. The board shows an informational legacy notice and preserves milestone
  progress.
- Existing milestone saves, completion order, timestamps, and persisted view
  selections remain compatible.
- Opening a task reuses `openCafeMilestoneInEditor`, which creates only missing
  canonical starter files and never overwrites files that already exist.
- The café project still requires Alex Morgan's accepted proposal and, for
  verification, CH1-05 to be the active Chapter 1 quest.

## 8. Test results

Focused run (six files):

- `cafeTaskStatus.test.ts`
- `cafeTaskVerification.test.ts`
- `cafeMilestones.test.ts`
- `CafeProjectBoard.test.tsx`
- `TicketsApp.test.tsx`
- `EditorApp.test.tsx`

Result: **6 files passed, 53 tests passed**.

Full suite (`npm test`): **27 files passed, 251 tests passed**.

Build (`npm run build`): **passed** (client and Nitro production builds
completed).

Targeted lint: the new Step 8A files and their tests are clean. The legacy
`EditorApp.tsx` and minified `TicketsApp.tsx` retain their pre-existing Prettier
formatting violations; the editor count is unchanged by this step, and the
Tickets additions follow the existing minified style rather than reformatting
the whole file.

Notable coverage added:

- editor no longer renders café instructions, progress, or **Verify Task**;
- café tasks read from canonical milestone definitions;
- status and gating for accepted/unlocked/setup/locked/completed states;
- verification uses the saved canonical file, not the open/dirty file;
- unsaved canonical file blocks verification;
- missing file and failed tests leave progress untouched;
- one milestone per pass;
- CH1-05 completes only after 3/3, with no XP or money change;
- Open in Editor opens the canonical file with no writes or overwrites;
- setup gating for new saves and legacy-save bypass;
- project switcher and general ticket workflow preservation.

## 9. Manual testing

The following browser smoke test should be repeated after deployment; it was not
automated in this environment:

1. Start the app and reach CH1-05 with the GigBoard café proposal accepted.
2. Open **Tickets** and switch to **Café Calculator**.
3. Confirm CAFÉ-1 is **Available**/current and CAFÉ-2/3 are **Locked**, and that
   instructions, expected behavior, examples, acceptance criteria, and hints are
   visible.
4. Click **Open in Editor**; confirm the correct `cafe_milestone_1.py` opens and
   the editor contains no café instructions or café **Run Tests** control.
5. Save a failing solution and click **Verify Task**; confirm failures are shown
   and progress does not advance.
6. Save a passing solution and verify; confirm CAFÉ-1 becomes **Completed**,
   CAFÉ-2 becomes available, and only one task advanced.
7. With `cafe_milestone_1.py` open and dirty, confirm verification is blocked;
   with a different file open and dirty, confirm it is not blocked.
8. Complete CAFÉ-2 and CAFÉ-3; confirm CH1-05 completes only after 3/3, no XP or
   money changes, and the delivery-ready message appears.
9. Reload the app; confirm milestone progress, the selected café task, and the
   selected Tickets view are restored.
10. On a new save, confirm setup gating sends the player to GigBoard and does
    not create files. On a legacy save, confirm setup is skipped and progress is
    preserved.
11. Switch back to **My Tickets** and confirm CQ-001…CQ-005 filtering, details,
    hints, and **Open in Code Editor** still work.

## 10. Limitations

- No interactive browser session or end-to-end browser automation was run for
  this step; verification is from unit/component tests, the full suite, and the
  production build.
- Café instructions now live only in Tickets. A player who opens the editor
  directly must return to Tickets to read them.
- **Open in Editor** may create missing canonical starter files. It never
  overwrites existing files, and verification itself performs no writes.
- Verification requires CH1-05 to be active. Before that point a task can be
  opened but not verified.
- The automatic CH1-05 recovery retry runs when the café board mounts; if the
  player never reopens it, the explicit retry remains available on the board.
- The legacy minified Tickets/Editor files still carry their pre-existing
  Prettier lint debt.

## 11. Next step: Mail

Stage B Step 8B should add the Mail app flow for Alex Morgan's delivery message
and the Chapter 1 handoff. This step intentionally does not implement Mail,
delivery submission, payment, or any post-3/3 narrative. CH1-05 is completed,
but the $50 payment and CH1-06 remain untouched.

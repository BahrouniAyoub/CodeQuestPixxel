# Task 003 — Complete Python Curriculum, Narrative Learning and PixelOS Onboarding Design

- **Date**: 2026-11-26
- **Branch**: `feature/pixelos-cleanup`
- **Status**: Design complete — implementation deferred to corresponding future tasks (documentation/design only; no implementation)

## Original request

Design a complete Python curriculum, narrative learning, and PixelOS onboarding for CodeQuest. Analyze Practical Python Programming (`https://github.com/dabeaz-course/practical-python`, local `../practical-python-master`), inspect current CodeQuest implementation, and produce required design/documentation deliverables. Research/analysis/planning/documentation only; no gameplay/code/save/quest/dependency changes.

## Objective and acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Inspect Practical Python course structure, exercises, datasets, license, Pyodide compatibility | ✅ |
| 2 | Analyze existing Godot/PixelOS/Chapter 1/Café/Python/persistence/bridge implementation | ✅ |
| 3 | Design complete Python curriculum roadmap and exercise traceability | ✅ |
| 4 | Design Chapter 1 narrative learning flow preserving Café story and $50 reward | ✅ |
| 5 | Design mentor Alex character, communication, and Chapter 1 dialogues | ✅ |
| 6 | Design Chapter 1 lesson sequence and simplified Café task proposal | ✅ |
| 7 | Design PixelOS onboarding and reusable tutorial system proposal | ✅ |
| 8 | Design learning UI wireframes and reusable architecture | ✅ |
| 9 | Analyze quest/save compatibility and licensing/attribution | ✅ |
| 10 | Produce implementation roadmap and required docs/report | ✅ |
| 11 | No gameplay/React/Godot source/save/quest/dependency changes | ✅ |

## Previous behavior

- CodeQuest had a playable Chapter 1 vertical slice with canonical CH1-01..CH1-08 quests, Godot↔React bridge, PixelOS apps, Pyodide runner, virtual FS, and an implemented Café Calculator workflow (setup, CAFE-DEV-01..04, CAFE-DOC-01, delivery, submission, approval, $50 payment, CH1-08 return).
- No complete Python curriculum, lesson/practice system, mentor learning flow, or reusable PixelOS onboarding/tutorial system was documented as an integrated design.
- Practical Python reference existed locally as `practical-python-master/` (not a git checkout).

## Root cause (when applicable)

N/A — design/documentation task. The gap is missing curriculum/onboarding architecture and narrative integration design.

## Implementation plan

1. Read AGENTS and canonical docs; check git status/branch.
2. Explore Godot/quest/bridge/save and PixelOS/app systems via subagents and targeted reads.
3. Inspect Practical Python repo structure, license, exercises, datasets, and Pyodide constraints.
4. Inspect current Café task/validator/payment/editor/runner implementation.
5. Produce required learning design docs under `docs/learning/`.
6. Create task report and update report index/changelog.

## Actual implementation

Created design documentation only:

- `docs/learning/PYTHON_CURRICULUM.md` — source analysis, Pyodide compatibility, career progression, chapter roadmap, principles.
- `docs/learning/COURSE_EXERCISE_MAPPING.md` — exercise-by-exercise mapping for 1.1–9.5 with action/Pyodide/target/adaptation.
- `docs/learning/CHAPTER_01_LEARNING_DESIGN.md` — redesigned CH1 narrative, quest compatibility strategy, 8 lesson specs, practice workspace, simplified Café proposal.
- `docs/learning/MENTOR_CHARACTER_DESIGN.md` — Alex mentor profile, rules, hint escalation, future role.
- `docs/learning/CHAPTER_01_DIALOGUES.md` — scripted mail/chat/dialogue proposals for Chapter 1.
- `docs/learning/PIXELOS_ONBOARDING_DESIGN.md` — initial and contextual onboarding flows, state, accessibility, recovery.
- `docs/learning/TUTORIAL_SYSTEM_PROPOSAL.md` — Driver.js vs React Joyride vs custom comparison; custom lightweight recommendation.
- `docs/learning/LEARNING_ARCHITECTURE_PROPOSAL.md` — data models, reuse map, Submit Test validation design, persistence boundaries.
- `docs/learning/LEARNING_UI_WIREFRAMES.md` — conceptual wireframes for tutorial, GigBoard, mail, lessons, editor, café tasks, progress.
- `docs/learning/LEARNING_IMPLEMENTATION_ROADMAP.md` — phased, testable implementation plan.
- `docs/learning/CONTENT_ATTRIBUTION.md` — CC BY-SA 4.0 facts, attribution draft, separation/follow-up recommendations.
- `docs/reports/003-python-curriculum-design.md` — this report.

## Technical decisions

- **No quest ID changes**: preserve CH1-01..CH1-08 and existing bridge contracts; redesign as gated substeps/content inside existing quest boundaries.
- **Job-first motivation**: player discovers Café job before learning Python; learning is triggered by need.
- **Custom tutorial system recommended**: better fit for movable/resizable PixelOS windows, semantic action gating, and no new dependency.
- **Reuse existing runtime**: Pyodide runner, virtual FS, Editor, Mail/Chat, quest store, persistence remain authoritative/reused.
- **Practice vs client separation**: guided practice gives XP/progress; paid client tasks assess transfer and remain reward-gated.
- **Assessment-pass fast path**: experienced players may pass readiness assessments to unlock CH1-04 application without reading every lesson; skipping tutorials never completes programming assessments.
- **Single-file beginner Café path recommended (Option A)**: educationally simpler for absolute beginners; existing multi-file CAFE-DEV validators remain unchanged; future compatibility adapter required.
- **Attribution caution**: Practical Python is CC BY-SA 4.0; adapted content requires attribution/share-alike handling and legal review before distribution.

## Review corrections (2026-11-26)

| Issue | Correction applied | Docs updated |
|---|---|---|
| 1. Teaching methodology | Reworked CH1 lessons into template: beginner explanation, different-scenario worked example, prediction question, run/modify, independent practice, progressive hints, automated validation, Café application. No exact Café solution before client assignment. Added prerequisite explanations for indentation/syntax/assignment/comparison/calls/params/return/error messages. | `CHAPTER_01_LEARNING_DESIGN.md`, `CHAPTER_01_DIALOGUES.md`, `PYTHON_CURRICULUM.md` |
| 2. Mandatory duration | Mandatory core path reduced to ~35 min target (L1-01,02,03,05,06); L1-04,07,08 optional support. Added readiness assessment fast path; skipping tutorials never completes programming assessments. | `CHAPTER_01_LEARNING_DESIGN.md`, `PYTHON_CURRICULUM.md`, `LEARNING_IMPLEMENTATION_ROADMAP.md`, `CHAPTER_01_DIALOGUES.md` |
| 3. Calculator/main prerequisite | Compared single-file vs multi-file. Recommended Option A (single-file beginner path) for educational difficulty; noted compatibility impact on existing CAFE-DEV module-boundary validators. No actual Café implementation changed. | `CHAPTER_01_LEARNING_DESIGN.md`, `PYTHON_CURRICULUM.md`, `LEARNING_IMPLEMENTATION_ROADMAP.md` |
| 4. Practice validation | Defined multi-case, namespace, function, stdin, no-traceback, limited AST checks using existing Pyodide runner. Added anti-hardcoding rules and per-exercise pass/fail/hardcoded-fail/friendly-feedback examples. Reference solutions excluded from player-facing content. | `LEARNING_ARCHITECTURE_PROPOSAL.md`, `CHAPTER_01_LEARNING_DESIGN.md`, `PYTHON_CURRICULUM.md`, `LEARNING_IMPLEMENTATION_ROADMAP.md` |
| 5. PixelOS onboarding | Made contextual/action-based; advance only on verified action success; non-blocking; skip/replay/resume/keyboard accessibility; recovery for moved/closed/minimized windows; no unnecessary exploration restriction. | `PIXELOS_ONBOARDING_DESIGN.md`, `TUTORIAL_SYSTEM_PROPOSAL.md` |
| 6. Save ownership | Analyzed Godot saves, React chapter1Store, IndexedDB stores/keys. Added ownership matrix and scenario behavior (new game, slots, load earlier, refresh, resume Café, load completed Ch1). Distinguished global prefs vs per-save gameplay/learning. Dedupe rules for mentor messages/XP/payment/learning gates. No schema changes/migrations. | `LEARNING_ARCHITECTURE_PROPOSAL.md`, `LEARNING_IMPLEMENTATION_ROADMAP.md` |
| 7. Course provenance | Recorded exact commit as unavailable/unverifiable (local dir not a git checkout); documented limitation, no guess. Replaced approximate counts with exact exercise-heading counts (131 headings, 130 numbered incl. blank 3.13; action totals Direct=3 Adapt=31 Simulate=15 Defer=78 Exclude=4). Preserved CC BY-SA attribution/ShareAlike. | `CONTENT_ATTRIBUTION.md`, `COURSE_EXERCISE_MAPPING.md`, `PYTHON_CURRICULUM.md` |

## Modified, created, and deleted files

### Created
- `docs/learning/PYTHON_CURRICULUM.md`
- `docs/learning/COURSE_EXERCISE_MAPPING.md`
- `docs/learning/CHAPTER_01_LEARNING_DESIGN.md`
- `docs/learning/MENTOR_CHARACTER_DESIGN.md`
- `docs/learning/CHAPTER_01_DIALOGUES.md`
- `docs/learning/PIXELOS_ONBOARDING_DESIGN.md`
- `docs/learning/TUTORIAL_SYSTEM_PROPOSAL.md`
- `docs/learning/LEARNING_ARCHITECTURE_PROPOSAL.md`
- `docs/learning/LEARNING_UI_WIREFRAMES.md`
- `docs/learning/LEARNING_IMPLEMENTATION_ROADMAP.md`
- `docs/learning/CONTENT_ATTRIBUTION.md`
- `docs/reports/003-python-curriculum-design.md`

### Modified
- `docs/reports/README.md` (index entry added)
- `docs/CHANGELOG.md` (unreleased documentation entry added)
- Task 003 review pass updated the learning docs listed above and this report.

### Deleted
- None

## Important implementation details

- **Practical Python provenance**: local `practical-python-master` inspected; license CC BY-SA 4.0; no `.git` directory present so exact upstream commit hash is unavailable/unverifiable. Record hash/date from git clone before publishing adapted content.
- **Exact exercise coverage**: 131 exercise headings by `^### Exercise` scan across `Notes/*/*.md`; 130 numbered exercises including 1 intentionally blank (3.13). Mapping action totals: Direct=3, Adapt=31, Simulate=15, Defer=78, Exclude=4, Total=131.
- **Current CH1 canonical quests**: CH1-01..CH1-08 unchanged; $50 reward; bridge-validated CH1-01/02/08; CH1-03..07 PixelOS workflows.
- **Current Café implementation**: multi-file `calculator.py`/`main.py` with CAFE-DEV-01..04, CAFE-DOC-01, module-boundary sentinel in CAFE-DEV-04. Existing implementation/validators unchanged by this task.
- **Save systems (verified)**: Godot local `user://codequest_saves.json` slots `auto/1/2/3`; React chapter1Store authoritative in IndexedDB `codequest-pixel-os` v1 `progress/chapter1`; café records in `progress/chapter1-cafe-*`; `fs/drafts/prefs/chat` stores present. No schema changes/migrations.

## Automated tests and exact results

Not run. Documentation-only task; no source code changed.

## Build and validation results

Not run. Documentation-only task; no source code changed.

## Manual tests actually performed

- Inspected repository structure, git status, and canonical docs.
- Inspected Chapter 1 quest/bridge/progress/save code and Godot bridge scripts via subagent and targeted reads.
- Inspected PixelOS/window/app architecture via subagent.
- Inspected Café coding, submission, payment, editor, runner, and persistence code via subagent and targeted reads.
- Inspected Practical Python README/LICENSE/Contents/Notes/Solutions/Data/exercise headings.
- Computed exact exercise action counts from `COURSE_EXERCISE_MAPPING.md` (Direct=3 Adapt=31 Simulate=15 Defer=78 Exclude=4 Total=131).
- Verified learning docs and report were updated.

## Manual testing instructions

N/A for runtime behavior (no code changed). Reviewers should:
1. Read `docs/learning/CHAPTER_01_LEARNING_DESIGN.md` for revised pedagogy, 35-min mandatory path, assessment pass, and single-file/multi-file recommendation.
2. Read `docs/learning/LEARNING_ARCHITECTURE_PROPOSAL.md` for validation contract and save ownership matrix.
3. Read `docs/learning/PIXELOS_ONBOARDING_DESIGN.md` and `TUTORIAL_SYSTEM_PROPOSAL.md` for action-success, non-blocking, recovery, accessibility rules.
4. Read `docs/learning/CONTENT_ATTRIBUTION.md` and `COURSE_EXERCISE_MAPPING.md` for provenance limitation and exact counts.
5. Confirm no source files outside docs were modified for behavior: `git status --short` (pre-existing `package.json` modification remains user-owned; do not touch).

## Risks and limitations

- Exercise mapping and lesson validation specs are design-level; implementation-time Pyodide smoke tests required.
- Single-file Café recommendation requires future compatibility adapter; existing multi-file CAFE-DEV validators remain sensitive.
- Save slot isolation is not fully represented in current React IndexedDB keying; slot-scoping requires ADR and explicit approval before any schema/migration.
- Practical Python exact upstream commit hash unavailable from local non-git reference; must be recorded before publishing adapted content.
- CC BY-SA ShareAlike implications for adapted content require legal review.

## Unverified assumptions

- Existing PixelOS window manager can support stable `data-tutorial-id` anchors and target recovery with minor future additions.
- Current Pyodide runner can handle multi-case validation load acceptably for short lessons/assessments.
- Players will accept CH1-04 readiness gating when messaging clearly explains learn/practice/assess-then-apply.
- Assessment-pass can be scoped to required skills without creating unfair bypasses.

## Remaining issues / decisions requiring approval

- **Approve Option A vs B**: single-file beginner Café path (recommended) vs multi-file with import lessons. No Café implementation change now.
- **Approve readiness gating**: mandatory core completion OR required assessment pass for CH1-04 application.
- **Approve save ownership model**: global UI prefs vs per-save learning/gameplay; slot-scoping ADR before any migration.
- **Approve validation contract**: multi-case/namespace/function/limited AST, anti-hardcoding, friendly feedback, no player-facing reference solutions.
- **Approve tutorial rules**: action-success advancement, non-blocking, skip/replay/resume/keyboard/recovery.
- **Legal/licensing**: CC BY-SA attribution/ShareAlike review before publishing adapted content; record exact upstream commit hash when verifiable.

## Acceptance criteria checklist

- [x] Course analyzed and exercise inventory/mapping produced; exact counts/provenance limitation documented.
- [x] Current CodeQuest capabilities and gaps documented.
- [x] Complete Chapter 1 storyline and mentor design documented.
- [x] Python lesson sequence revised with pedagogy template, 30–45 min mandatory path, assessment pass, and no Café-solution leakage.
- [x] Single-file vs multi-file Café prerequisite compared; recommendation documented; no Café implementation changed.
- [x] Practice validation contract defined with anti-hardcoding and per-exercise examples.
- [x] PixelOS onboarding and tutorial system revised for action-success, non-blocking, recovery, accessibility.
- [x] Save ownership analyzed and scenario matrix documented; no schema/migration changes.
- [x] Reusable learning architecture and UI wireframes documented.
- [x] Implementation roadmap updated.
- [x] Required docs updated; report/index/changelog updated.
- [x] No gameplay/code/save/quest/dependency changes made.

## Task 003 closure (2026-11-26)

### Approved design directions (accepted)
1. Mentor-driven, job-first learning.
2. Preserve existing CH1-01..CH1-08 quest IDs.
3. Preserve existing one-time $50 Café reward.
4. Scripted mentor emails, messages and hints.
5. Reuse existing PixelOS applications and Pyodide runtime.
6. Custom lightweight interactive tutorial system.
7. Separate guided practice from paid client assignments.
8. Readiness assessments for experienced players.
9. Single-file Café project for the new beginner workflow, subject to compatibility design.
10. Preserve existing multi-file Café workflows for legacy and in-progress saves.
11. Global interface preferences and per-save gameplay and learning progress.
12. Multi-case educational validation with helpful feedback.

### Final design refinements applied
- **Progressive learning**: teach print, variables, arithmetic, conditions, and functions before accepting the Café job. Introduce string formatting, user input, and error handling through contextual mentor lessons before corresponding client tasks require them. These lessons may be skipped only when relevant skills have already been demonstrated through assessment.
- **Prerequisite fixes**: L1-03 and L1-05 no longer require defining functions or using `input()` before those concepts are taught; validation uses controlled namespace/stdout cases.
- **Complete specs**: L1-04, L1-07, L1-08 expanded to full lesson template (explanation, worked example, prediction, run/modify, independent practice, progressive hints, automated validation, Café application, pass/fail/hardcoded-fail/friendly feedback).

### ADRs required (documented, not implemented)
- Quest readiness gating.
- Save ownership and slot isolation (**no save migration approved or implemented**).
- Single-file Café workflow compatibility.
- Custom tutorial architecture.
- Educational content licensing.

### Closure verification
- `git diff --name-status` / `git status --short` reviewed: Task 003 changes are documentation-only under `docs/learning/`, `docs/reports/003-python-curriculum-design.md`, `docs/reports/README.md`, `docs/CHANGELOG.md`. Pre-existing `package.json` modification is user-owned and untouched. Untracked `docs/learning.zip` is not part of Task 003.
- **Confirmed no Task 003 changes to**: React source, Godot source, existing Café tasks/validators, quest IDs, save schemas, dependencies, `package.json`.
- **No save migration approved or implemented.**
- **Task 003 is design complete; implementation deferred to corresponding future tasks. Do not start Task 004.**

## Recommended next steps

1. Obtain explicit approval to begin a specific future implementation task (not Task 004 unless separately scoped/approved).
2. Create required ADRs before implementation: quest readiness gating, save ownership/slot isolation, single-file Café workflow compatibility, custom tutorial architecture, educational content licensing.
3. Keep existing CH1 quest IDs, $50 reward, bridge authority, Pyodide runtime, and current Café validators unchanged unless a future approved ADR/task specifies a compatible adapter.
4. Do not approve or implement save migrations as part of closure; handle via future ADR + explicit approval.

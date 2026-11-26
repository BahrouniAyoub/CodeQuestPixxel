# Learning Implementation Roadmap (Proposed, Revised)

> **Status**: Proposed roadmap (documentation only). No implementation.  
> **Date**: 2026-11-26 (revised after Task 003 review)

## 0. Sequencing Principle

Complete existing PixelOS UI improvements before interactive tutorials. Then build learning infrastructure, content, validation, quest/save integration, and playtest. **Review constraints**: 30–45 min mandatory core path (playtesting), optional support, assessment-pass fast path, anti-hardcoded validation, action-gated non-blocking accessible tutorials, save ownership clarity, single-file/multi-file Café decision, no schema/migration/quest-ID changes.

## 1. Phase Overview

| Phase | Focus | Depends on | Outcome |
|---|---|---|---|
| P0 | PixelOS UI readiness | Current PixelOS | Stable window/menu/taskbar base for tutorials |
| P1 | Tutorial infrastructure | P0 | Reusable data-driven tutorial system |
| P2 | Learning content infrastructure | P0 | Lesson/practice data model and stores |
| P3 | Editor Submit Test integration | P1/P2 | Unified run/submit validation UX |
| P4 | Mentor Mail/Chat interactions | P2 | Scripted Alex guidance |
| P5 | Chapter 1 Python lessons | P2,P3,P4 | Mandatory core + optional support + readiness assessments |
| P6 | Guided exercises | P3,P5 | Practice workspace + anti-hardcode validation |
| P7 | Simplified Café tasks | P3,P5 | Single-file beginner path (recommended) or approved alternative; adapters |
| P8 | Quest integration | P4-P7 | Narrative flow connected to existing CH1 quests, readiness gating |
| P9 | Save ownership & compatibility | P2,P8 | Save ownership matrix, dedupe, slot-scoping ADR; no schema migration now |
| P10 | Complete Chapter 1 playtest | all | End-to-end verified learning experience + timing/playtest |

## 2. Detailed Tasks

### P0-T1 — Windows-style Start menu refinement
- **Objective**: Stabilize Start menu layout/behavior for tutorial targeting.
- **Scope**: Existing Start menu UI/interaction only.
- **Dependencies**: none.
- **Deliverables**: Updated Start menu, stable `data-tutorial-id`s.
- **Acceptance**: Keyboard/mouse open-search-launch works; no regression in app launch.
- **Testing**: component tests, manual desktop checks.
- **Risks**: CSS regressions in taskbar layout.
- **Complexity**: Medium.

### P0-T2 — Dynamic taskbar behavior
- **Objective**: Ensure taskbar states (running/focused/minimized) are stable and accessible.
- **Scope**: Taskbar component/store wiring.
- **Dependencies**: P0-T1 optional.
- **Acceptance**: Correct focus/minimize/restore behavior; ARIA labels.
- **Testing**: window reducer tests + UI tests.
- **Risks**: focus regressions.
- **Complexity**: Medium.

### P0-T3 — Scroll position preservation
- **Objective**: Preserve scroll in apps/lists where tutorial/lesson navigation returns users.
- **Scope**: Browser/Tickets/Mail/lesson list containers.
- **Dependencies**: none.
- **Acceptance**: Returning to previous view restores scroll.
- **Testing**: UI tests/manual.
- **Risks**: unwanted scroll jumps.
- **Complexity**: Low/Medium.

### P1-T1 — Tutorial data model and store
- **Objective**: Create reusable tutorial types, store, registry, persistence.
- **Dependencies**: P0.
- **Deliverables**: `core/tutorial/*`, IndexedDB progress records.
- **Acceptance**: start/next/back/skip/resume/replay persisted; versioned.
- **Testing**: unit tests for reducer/store/persistence.
- **Risks**: save key collisions; over-coupling.
- **Complexity**: Medium.

### P1-T2 — Tutorial overlay and target resolver
- **Objective**: Spotlight/tooltip overlay with movable window tracking.
- **Dependencies**: P1-T1.
- **Acceptance**: tracks target on move/resize/scroll; keyboard accessible; reduced motion respected.
- **Testing**: component tests, manual window movement tests.
- **Risks**: z-index/focus trap bugs.
- **Complexity**: High.

### P1-T3 — Initial PixelOS onboarding flow
- **Objective**: First-time desktop onboarding.
- **Dependencies**: P1-T2.
- **Acceptance**: triggers once, skippable, replayable from Settings.
- **Testing**: E2E/manual first-run flow.
- **Risks**: annoying UX if not skippable.
- **Complexity**: Medium.

### P2-T1 — Learning content schema
- **Objective**: Define TS types for Chapter/Mission/Lesson/Practice/ClientTask/Skill/Hint/Validation.
- **Dependencies**: P0.
- **Acceptance**: types compile; sample content validates.
- **Testing**: typecheck + schema/unit tests.
- **Risks**: premature abstraction.
- **Complexity**: Medium.

### P2-T2 — Learning progress store
- **Objective**: Persist lesson/practice completion separately from canonical quest state.
- **Dependencies**: P2-T1.
- **Acceptance**: versioned save/load; invalid records handled safely; no quest authority duplication.
- **Testing**: store tests, corrupted record tests.
- **Risks**: save ownership confusion.
- **Complexity**: Medium.

### P3-T1 — Reusable Submit Test service
- **Objective**: Generalize Pyodide validation for practice, readiness assessments, and client tasks.
- **Dependencies**: P2-T1.
- **Acceptance**: supports stdout/regex, namespace, function call/return, stdin multi-case, no-traceback, file/content, limited AST checks; per-test friendly feedback; anti-hardcoding multi-case rules.
- **Testing**: unit tests with mocked runner; integration tests with Pyodide where feasible.
- **Risks**: flaky async tests; over-restrictive AST checks.
- **Complexity**: High.

### P3-T1a — Anti-hardcoding validation rules
- **Objective**: Prevent hardcoded solutions from passing computation/logic exercises.
- **Dependencies**: P3-T1.
- **Deliverables**: Validation spec rules for multi-case, hidden case, constant-return detection, friendly hardcode feedback.
- **Acceptance**: For each computation exercise, a hardcoded solution passes case 1 but fails alternate case; feedback is beginner-friendly and leak-free.
- **Testing**: fixture-based validator tests per exercise template.
- **Risks**: false positives on legitimate constants.
- **Complexity**: Medium.

### P3-T1b — Readiness assessment engine
- **Objective**: Allow experienced players to pass assessments without reading every lesson.
- **Dependencies**: P3-T1, P2-T2.
- **Acceptance**: Assessment pass records readiness in per-save learning progress; does not complete CH1 quests or grant payment/XP; unlocks CH1-04 application gate when required assessments pass.
- **Testing**: store/integration tests for pass/fail/no-quest-side-effects.
- **Risks**: assessment bypassing intended learning; gate inconsistency.
- **Complexity**: Medium.

### P3-T2 — Editor lesson/practice mode
- **Objective**: Add lesson/practice mode to Editor without breaking ticket/file modes.
- **Dependencies**: P3-T1.
- **Acceptance**: open practice file, run, submit practice, see hints; existing Editor tests pass.
- **Testing**: Editor component/integration tests.
- **Risks**: Editor complexity regression.
- **Complexity**: High.

### P4-T1 — Mail mentor thread templates
- **Objective**: Scripted Alex mail threads for Chapter 1.
- **Dependencies**: P2.
- **Acceptance**: initial request/response/readiness/congrats appear at correct triggers; deduped.
- **Testing**: mail store/UI tests.
- **Risks**: duplicate/conflicting scripted mail.
- **Complexity**: Medium.

### P4-T2 — Chat hint integration
- **Objective**: Contextual scripted hints in Chat.
- **Dependencies**: P1, P2.
- **Acceptance**: hint escalation respects cap; no full solution for client tasks.
- **Testing**: chat store tests.
- **Risks**: spoiler hints.
- **Complexity**: Medium.

### P5-T1 — Chapter 1 lesson content
- **Objective**: Implement L1-01..L1-08 content (mandatory core + optional support) and browser learning pages.
- **Dependencies**: P2, P3, P4.
- **Acceptance**: lessons follow template (explanation, different-scenario worked example, prediction, run/modify, independent practice, progressive hints, automated validation, Café application with no exact solution); prerequisites/concepts explained before use; 30–45 min mandatory core target tracked.
- **Testing**: content validation tests, UI smoke tests, pedagogy checklist review.
- **Risks**: content too hard; accidental Café solution leakage.
- **Complexity**: Medium/High.

### P6-T1 — Practice workspace bootstrap
- **Objective**: Create guided practice folder/files in virtual FS.
- **Dependencies**: P5.
- **Acceptance**: no overwrite of existing user files; idempotent creation.
- **Testing**: filesystem unit tests.
- **Risks**: accidental overwrite.
- **Complexity**: Medium.

### P7-T0 — Single-file vs multi-file Café decision (design gate)
- **Objective**: Finalize approved beginner Café project shape before implementation.
- **Dependencies**: Task 003 review approval.
- **Acceptance**: ADR/decision recorded. Recommended: Option A single-file beginner path + compatibility adapter; existing multi-file CAFE-DEV validators unchanged.
- **Testing**: design review only.
- **Risks**: choosing incompatible path late.
- **Complexity**: Low (decision), High (downstream impact).

### P7-T1 — Simplified Café task adapter
- **Objective**: Implement approved beginner Café path with compatibility for existing workflow.
- **Dependencies**: P7-T0, P3, P5.
- **Acceptance**: new beginners get approved simplified tasks; existing in-progress saves remain valid; CH1-05/06/07 flow and payment guards preserved; no change to existing CAFE-DEV validators unless separately approved.
- **Testing**: migration/compat tests, cafe workflow tests, CH1 regression tests.
- **Risks**: breaking CH1-05/06/07 flow.
- **Complexity**: High.

### P8-T1 — Quest gating and narrative integration
- **Objective**: Gate CH1-04 application behind learning readiness while preserving quest IDs.
- **Dependencies**: P4-P7.
- **Acceptance**: no quest ID changes; existing completed quests unaffected; bridge behavior unchanged; readiness satisfied by mandatory core completion or required assessment pass; skipping tutorials never completes assessments/quests.
- **Testing**: chapter1 store/bridge tests, manual playthrough, assessment-pass unlock test.
- **Risks**: quest deadlock/regression.
- **Complexity**: High.

### P9-T1 — Save ownership and compatibility guard
- **Objective**: Define and implement per-save/global ownership boundaries without schema migrations.
- **Dependencies**: P2, P8.
- **Acceptance**: ownership matrix implemented as designed; global UI prefs separated from per-save learning/gameplay; no duplicated mentor messages/XP/payment; old saves load; no lost progress; no schema change without ADR.
- **Testing**: fixture-based tests for new game, slot switch, load earlier save, refresh, resume existing Café, load completed Ch1.
- **Risks**: slot isolation gap in current IndexedDB model; duplicate rewards.
- **Complexity**: High.

### P9-T2 — Slot-scoping ADR (pre-implementation decision)
- **Objective**: Decide how React per-save records map to Godot save slots.
- **Dependencies**: P9-T1 analysis.
- **Acceptance**: ADR approved before any migration/schema change.
- **Testing**: design review.
- **Risks**: cross-slot leakage if deferred carelessly.
- **Complexity**: Medium.

### P10-T1 — End-to-end Chapter 1 playtest
- **Objective**: Validate full redesigned Chapter 1 flow.
- **Dependencies**: all.
- **Acceptance**: new player can complete CH1-01..CH1-08 with learning path; existing save scenarios pass.
- **Testing**: manual E2E matrix + automated regression suite.
- **Risks**: hidden integration bugs.
- **Complexity**: High.

## 3. ADRs Required Before Implementation

| ADR (proposed) | Scope | Status |
|---|---|---|
| ADR: Quest readiness gating | CH1-04 application gate, assessment-pass vs mandatory core, no quest ID changes | Required before implementation |
| ADR: Save ownership and slot isolation | Global UI prefs vs per-save gameplay/learning, Godot slot mapping, dedupe rules; **no save migration approved/implemented** | Required before implementation |
| ADR: Single-file Café workflow compatibility | Option A single-file beginner path, adapter for legacy multi-file saves, validator compatibility | Required before implementation |
| ADR: Custom tutorial architecture | Data-driven tutorial engine, action-success predicates, recovery, accessibility | Required before implementation |
| ADR: Educational content licensing | CC BY-SA attribution/ShareAlike, source provenance, publication policy | Required before legal publication/implementation |

**Design note**: These ADRs identify decisions and boundaries. Unresolved implementation details are not finalized technical decisions.

## 4. Recommended Immediate Next Step

Obtain approval for Task 003 corrections: single-file vs multi-file Café path (Option A recommended), mandatory 30–45 min core + assessment-pass gating, validation contract, tutorial action-gated/non-blocking rules, and save ownership/slot-scoping ADR requirement. Then create ADRs before implementation (no schema/migration/code changes now).
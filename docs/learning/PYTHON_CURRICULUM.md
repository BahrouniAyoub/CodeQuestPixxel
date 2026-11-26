# Python Curriculum — Practical Python to CodeQuest (Revised)

> **Status**: Proposed design (documentation only). No gameplay/code changes were made in this task.  
> **Date**: 2026-11-26 (revised after Task 003 review)  
> **Branch**: `feature/pixelos-cleanup`

## 1. Purpose

This document transforms David Beazley's *Practical Python Programming* course into a structured CodeQuest learning roadmap. It is the curriculum-level design reference for future implementation. It does not change gameplay, quest IDs, save schemas, or existing Café tasks.

**Review alignment**: mandatory Chapter 1 path targets ~30–45 min (playtesting required); optional support remains available; experienced players may pass readiness assessments without reading every lesson; skipping tutorials never completes programming assessments.

## 2. Source Reference

| Field | Value |
|---|---|
| Course | Practical Python Programming |
| Author | David Beazley |
| Repository | https://github.com/dabeaz-course/practical-python |
| Local reference inspected | `../practical-python-master` (workspace root sibling of repo) |
| Source commit hash | **Unavailable / not verifiable** — local reference is not a git checkout (`.git` absent) and contains no embedded commit metadata. Do not guess. Record exact upstream commit hash/date from a git clone before publishing adapted content. |
| License | Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), `LICENSE.md` |
| Course format | Instructor-led professional training; ~25–35 hours; 131 exercise headings inventoried (130 numbered incl. 1 intentionally blank: 3.13); 3–4 days typical |
| Target audience (original) | Professional scientists/engineers/programmers with prior programming experience; no prior Python required but programming topics assumed |
| CodeQuest adaptation target | Absolute beginners through early professional developers; story-driven, in-game, Pyodide/browser execution |

### License/usage facts (verified from local files)

- `practical-python-master/LICENSE.md` contains full CC BY-SA 4.0 legal code.
- `README.md` states the course is licensed CC BY-SA 4.0 and allows derivative/teaching/translation/video use with attribution and same license terms as applicable.
- The course includes selected solutions in `Solutions/`; CodeQuest must not expose instructor solutions to players.

## 3. Course Inventory (Verified)

### 3.1 Structure

| Section | Title | Notes/Topics | Exercise range | Solutions present |
|---|---|---:|---|---|
| 0 | Course Setup | Environment, Work/Data/Solutions layout, shell/file workflow | None | N/A |
| 1 | Introduction to Python | Python basics, numbers, strings, lists, files, functions, errors, CLI | 1.1–1.33 | 1_5, 1_10, 1_27, 1_33 |
| 2 | Working With Data | Datatypes, containers, formatting, sequences, collections, list comprehensions, object model | 2.1–2.26 | 2_7, 2_11, 2_16 |
| 3 | Program Organization | Scripts, functions, error checking, modules, main, design discussion | 3.1–3.18 (3.13 blank) | 3_2, 3_7, 3_10, 3_14, 3_16, 3_18 |
| 4 | Classes and Objects | Classes, inheritance, special methods, custom exceptions | 4.1–4.11 | 4_4, 4_10 |
| 5 | Inner Workings of Python Objects | Dict representation, encapsulation, properties, slots | 5.1–5.8 | 5_8 |
| 6 | Generators | Iteration protocol, custom iteration, producers/consumers, generator expressions | 6.1–6.15 | 6_3, 6_7, 6_12, 6_15 |
| 7 | A Few Advanced Topics | Variable args, lambdas, closures, decorators, decorated methods | 7.1–7.11 | 7_4, 7_9, 7_10, 7_11 |
| 8 | Testing, Logging, and Debugging | unittest, logging, debugging | 8.1–8.4 | 8_1, 8_2 |
| 9 | Packages | Packages, third-party modules, distribution | 9.1–9.5 | 9_3, 9_5 |

### 3.2 Datasets and supporting materials (verified)

`Work/Data/`: `dowstocks.csv`, `portfolio.csv`, `portfolio2.csv`, `portfolio.dat`, `portfolio.csv.gz`, `portfolioblank.csv`, `portfoliodate.csv`, `missing.csv`, `prices.csv`, `stocksim.py`.

Supporting: `Notes/02_Working_with_data/references.png`, `shallow.png`, Jekyll layout/config.

### 3.3 Pyodide/browser compatibility observations (verified by inspection)

| Category | Examples | Pyodide impact | Adaptation |
|---|---|---|---|
| Core Python/stdin/stdout | arithmetic, strings, lists, dicts, functions | Compatible | Direct adaptation possible |
| Local file I/O | CSV reading, gzip, file-like objects, log files | Compatible with virtual FS; path assumptions differ | Preload files in virtual FS; use `/Projects/...` or course-data mount |
| CLI/script execution | `sys.argv`, `__main__`, shell commands | Partially compatible | Replace CLI framing with Editor/Terminal tasks; keep script concepts |
| External network | Exercise 1.4 urllib bus data | Incompatible/unreliable in browser/CORS | Replace with local/mock dataset or simulated API response |
| Long-running/streaming processes | `stocksim.py` HTTP server / stocklog tailing | Incompatible with browser worker model | Replace with deterministic event stream/simulated feed |
| Debugger/REPL workflow | `pdb`, heavy interactive interpreter | Limited | Teach debugging concepts via Editor output, trace exercises, guided hints |
| Third-party packaging/tooling | `pip`, venv, setup.py install | Not directly compatible | Teach concepts conceptually/simulated Terminal; avoid real pip/venv |
| OS/subprocess | not prominent in exercises | Avoid | Exclude or simulate |

## 4. Curriculum Design Principles

1. **Story first, course second**: every learning unit is motivated by a client, coworker, mentor, or project need.
2. **Beginner-safe**: assume no prior programming experience; add concept primers missing from the original course.
3. **Small validated steps**: each lesson has a guided practice exercise with automated feedback.
4. **No solution leakage**: practice exercises teach concepts; client tasks assess transfer. Original course solutions are never shown.
5. **Pyodide-first**: exercises run in browser worker; avoid unsupported OS/network/package workflows.
6. **Data-driven**: chapters, lessons, exercises, hints, validators, and rewards should be declarable content.
7. **Reuse existing systems**: Pyodide runner, virtual FS, Editor, Tickets/Cafe workflow patterns, Chapter 1 quest/store/bridge, notifications, save status.
8. **Progressive professionalism**: player grows from beginner to experienced developer through realistic practices.

## 5. Career Progression Model (Proposed)

| Stage | Player identity | Core skills | Typical CodeQuest activities | Original course alignment |
|---|---|---|---|---|
| Beginner | Curious newcomer | print, variables, types, arithmetic, strings, input, conditions, functions, basic errors | Guided lessons, tiny scripts, mentor practice | Sec 1.1–1.7, selected 1.10 basics |
| Freelancer | First paid contributor | scripts, file reading, data parsing, formatting, validation, client delivery | Café-style gigs, simple reports, structured deliverables | Sec 1.8–2.4, 3.1–3.3 |
| Junior Developer | Team contributor | modules, testing, exceptions, data structures, refactoring, docs | Multi-file tasks, bug tickets, code review-style feedback | Sec 2.5–3.7, 8.1–8.3 |
| Software Developer | Reliable project owner | classes, OOP design, APIs/interfaces, reusable components, packaging concepts | Larger client projects, maintainable codebases | Sec 4, 5 selected, 7 selected, 9 concepts |
| Experienced Developer | Mentor-ready professional | generators/streams, advanced patterns, performance awareness, testing/debugging leadership | Architecture tasks, mentoring NPCs, optimization/refactor missions | Sec 6, 7, 8, selected 9, capstones |

## 6. Proposed Chapter Roadmap

The original 10 sections are not mapped 1:1 to chapters. Chapters are organized by prerequisites, narrative coherence, and difficulty.

| Chapter | Proposed title | Stage | Primary learning goals | Practical Python sources | Main project outcome |
|---|---|---|---|---|---|
| Ch1 | The First Paycheck | Beginner | Core mandatory (~35 min target): print/variables, types, math, conditions, functions; optional support: formatting, input, error handling. Assessment-pass fast path allowed. | Sec 1.1–1.5, 1.7 (selected concepts) | Deliver beginner Café Calculator (single-file path recommended; existing multi-file validators unchanged) |
| Ch2 | The Café Follow-Up | Beginner → Freelancer | Lists, loops, files, CSV basics, formatted output, simple reports | Sec 1.5–1.6, 2.1–2.4 | Generate daily sales report from CSV |
| Ch3 | Data Cleanup Contract | Freelancer | Dictionaries, data cleaning, error handling, defensive parsing, command-like scripts | Sec 2.2–2.6, 3.1–3.3 | Clean messy client data and produce summary |
| Ch4 | The Reusable Toolkit | Freelancer → Junior | Functions, modules, imports, main scripts, code organization, basic tests | Sec 3.4–3.6, 8.1 | Refactor scripts into reusable module with tests |
| Ch5 | Bug Hunt at the Office | Junior Developer | Exceptions, logging mindset, debugging, regression checks | Sec 3.3 error handling, 8.1–8.4 | Fix production-like bugs and add tests/logging |
| Ch6 | Inventory System Upgrade | Junior → Software Developer | Classes, objects, methods, special methods, simple inheritance/composition | Sec 4.1–4.11, 5 selected | Build small inventory/domain model |
| Ch7 | Reports at Scale | Software Developer | Iteration protocol, generators, comprehensions/expressions, streaming-like data | Sec 2.6, 6.1–6.15 | Process large/simulated streaming dataset efficiently |
| Ch8 | Professional Python Toolkit | Software Developer → Experienced | Advanced functions, decorators/concepts, packaging concepts, project structure, docs | Sec 7, 9 concepts, 8 review | Deliver maintainable mini-package/project |
| Ch9 | Capstone: Freelance Studio | Experienced | End-to-end delivery: requirements, implementation, tests, docs, review, handoff | Integrated review | Multi-file client capstone with mentor review |

## 7. Chapter 1 Scope (Detailed in separate doc)

Chapter 1 must remain the existing Café Calculator story and $50 reward. It should teach only the minimum concepts needed for the Café mission.

**Revised constraints (Task 003 review):**
- **Mandatory path**: ~30–45 min target (playtesting required). Core mandatory lessons: L1-01, L1-02, L1-03, L1-05, L1-06. Optional support: L1-04, L1-07, L1-08, extra practice, glossary.
- **Assessment pass**: experienced players may pass readiness assessments to unlock CH1-04 application without reading every lesson. Skipping tutorials never completes programming assessments.
- **Single-file vs multi-file Café prerequisite**: current dev workflow uses `calculator.py`/`main.py` with module-boundary validation; imports are deferred in curriculum. **Recommended (proposed)**: Option A - simplified single-file beginner Café path for redesigned learning flow, with future compatibility adapter; keep existing multi-file CAFE-DEV validators unchanged. Do not modify actual Café implementation. See `CHAPTER_01_LEARNING_DESIGN.md` §6.
- **Progressive learning (approved)**: teach print, variables, arithmetic, conditions, and functions before accepting the Café job. Introduce string formatting, user input, and error handling through contextual mentor lessons before corresponding client tasks require them; skippable only when relevant skills demonstrated through assessment.
- **Pedagogy**: every lesson separates beginner explanation, different-scenario worked example, prediction question, run/modify, independent practice, progressive hints, automated validation, and Café application (no exact solution before client assignment).

See `CHAPTER_01_LEARNING_DESIGN.md`.

## 8. Exercise Adaptation Strategy

- **Direct**: concept can be taught almost as-is in Pyodide with minor narrative framing.
- **Adapt**: keep learning objective, change data/domain/file layout/UI framing.
- **Simulate**: replace unsupported workflow (network, pip, venv, long-running server) with in-game equivalent.
- **Defer**: valuable but not appropriate for early chapter/prerequisites.
- **Exclude**: low value for CodeQuest, unsafe/incompatible, or redundant.

Every original exercise is mapped in `COURSE_EXERCISE_MAPPING.md`.

## 9. Assessment Model

| Type | Purpose | Validation | Reward |
|---|---|---|---|
| Guided practice | Teach concept safely | Multi-case automated tests + hints; namespace/function/assert/limited AST checks; anti-hardcoding | XP/progress, no client money |
| Readiness assessment | Allow experienced players to prove skill | Same validator contract; pass unlocks CH1-04 readiness, does not complete quest/payment | Readiness/unlock only |
| Debugging challenge | Diagnose mistakes | Tests targeting bug/fix behavior | XP/badge |
| Client task | Assess transfer in realistic context | Pyodide tests, file/content checks, multi-case validation, friendly feedback | Story progress, money, reputation |
| Project milestone | Integrate multiple skills | Multi-file tests, delivery checks, docs checks | Major quest reward |

**Validation rules**: no hardcoded pass for computation tasks; use >=2 cases; provide valid-pass/incorrect-fail/hardcoded-fail/friendly-feedback examples per exercise; keep reference solutions out of player-facing content.

## 10. Proposed Data-Driven Content Model

Detailed in `LEARNING_ARCHITECTURE_PROPOSAL.md`. Core entities: Chapter, Mission, Lesson, PracticeExercise, ClientTask, Skill, Hint, ValidationTest, TutorialStep/Tutorial, LearningProgress, Reward, MentorInteraction.

## 11. Dependencies and Risks

- Existing Chapter 1 quest IDs and reward flow are sensitive; curriculum redesign must preserve canonical quest authority.
- Café task simplification is proposed only; current task definitions/validators remain unchanged until approved implementation.
- Pyodide worker is gameplay execution, not a hostile-code sandbox.
- CC BY-SA 4.0 attribution/share-alike obligations must be handled before publishing adapted course content.

## 12. Decisions Requiring Approval (future implementation)

1. Approve **single-file beginner Café path (Option A)** with future compatibility adapter, or Option B multi-file with beginner import lessons. No change to actual Café implementation now.
2. Approve **mandatory core + optional support + readiness assessment-pass** gating for CH1-04 application (skipping tutorials never completes programming assessments).
3. Approve **save ownership model**: global UI prefs vs per-save gameplay/learning progress; slot-scoped isolation strategy; no schema changes/migrations in this task.
4. Approve **validation contract**: multi-case/namespace/function/limited AST checks, anti-hardcoding, friendly feedback; no reference solutions in player-facing content.
5. Approve **tutorial system**: custom lightweight system (recommended), action-success gating, non-blocking/recoverable/accessible.
6. Any save-schema migration or slot-scoping implementation requires ADR and explicit approval before implementation.
7. CC BY-SA attribution/ShareAlike handling and legal review before publishing/distributing adapted Practical Python content. Record exact upstream commit hash when verifiable.
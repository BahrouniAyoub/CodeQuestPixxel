# CodeQuest — Changelog

All notable project-level documentation/process changes should be recorded here. This file starts at environment setup; earlier implementation history exists in git commits and `docs/*_IMPLEMENTATION.md`.

## [Unreleased]

### Added
- Permanent agent/development workflow rules in `AGENTS.md`.
- Canonical documentation set: `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/GAME_DESIGN.md`, `docs/CODING_STANDARDS.md`, `docs/TESTING_GUIDE.md`, `docs/KNOWN_ISSUES.md`.
- Report and decision record indexes: `docs/reports/README.md`, `docs/decisions/README.md`.
- Initial environment setup report: `docs/reports/001-development-environment-setup.md`.
- Task 002 report: `docs/reports/002-remove-legacy-tickets.md`.
- Task 003 learning design docs under `docs/learning/` (curriculum, exercise mapping, Chapter 1 learning design, mentor/dialogues, PixelOS onboarding, tutorial system proposal, learning architecture, UI wireframes, implementation roadmap, content attribution); revised after review for pedagogy, 30–45 min mandatory/assessment path, single-file/multi-file Café prerequisite decision, validation anti-hardcoding, action-gated non-blocking onboarding, save ownership, and provenance exact counts.
- Task 003 report: `docs/reports/003-python-curriculum-design.md` (design complete; implementation deferred).

### Changed
- Retired legacy CQ-001..CQ-005 demo tickets from active catalog; Tickets app is Café Calculator-only when no general tickets exist.
- GigBoard now lists only the Chapter 1 Café Calculator job; removed legacy job routes resolve as not found.
- Progress and draft stores sanitize legacy/unknown ticket IDs on hydrate; Progress/Editor handle empty ticket catalog safely.
- Removed CQ-specific chat seed/completion templates.

### Baseline (2026-11-26)
- Tests: `npm test` passed (65 files, 540 tests).
- Build: `npm run build` passed (chunk-size warning).
- Lint: `npm run lint` timed out twice (120s, 180s) — blocked/inconclusive.
# CodeQuest — Changelog

All notable project-level documentation/process changes should be recorded here. This file starts at environment setup; earlier implementation history exists in git commits and `docs/*_IMPLEMENTATION.md`.

## [Unreleased]

### Added
- Permanent agent/development workflow rules in `AGENTS.md`.
- Canonical documentation set: `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/GAME_DESIGN.md`, `docs/CODING_STANDARDS.md`, `docs/TESTING_GUIDE.md`, `docs/KNOWN_ISSUES.md`.
- Report and decision record indexes: `docs/reports/README.md`, `docs/decisions/README.md`.
- Initial environment setup report: `docs/reports/001-development-environment-setup.md`.

### Baseline (2026-11-26)
- Tests: `npm test` passed (65 files, 540 tests).
- Build: `npm run build` passed (chunk-size warning).
- Lint: `npm run lint` timed out twice (120s, 180s) — blocked/inconclusive.
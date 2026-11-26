# CodeQuest — Roadmap

This roadmap reflects the current observed state of the repository as of 2026-11-26. It is not a commitment to dates.

## Status Legend

- **Implemented**: present in code and/or tests; may still need runtime verification.
- **Partially implemented**: meaningful code exists but incomplete, fragile, or missing validation.
- **Planned**: not implemented or only implied by docs.

## Current Baseline

| Area | Status | Evidence | Notes |
|---|---|---|---|
| TanStack Start React shell | Implemented | `src/routes/*`, `package.json` | Main app shell and `/game` route |
| Godot web embed | Implemented | `src/routes/game.tsx`, `public/godot/*` | Godot iframe embedded and hidden/shown with PixelOS |
| PixelOS desktop/window manager | Implemented | `src/app/PixelOS.tsx`, `src/core/windows/*` | Draggable/resizable windows, taskbar/start/search |
| App registry | Implemented | `src/core/applications/registry.ts` | 10 apps registered |
| Chapter 1 quest data/progress/validation/store | Implemented | `src/features/chapter1/*` | Linear 8-quest chain, validated save records |
| Godot↔React bridge | Implemented | `src/features/chapter1/godotBridge.ts`, `src/routes/game.tsx`, Godot bridge scripts | CH1-01/02/08, open-os, save/load/state sync |
| Character customization | Implemented | Godot customizer scripts/scenes, `gameSave.ts` snapshot parsing | React validates/stores snapshots; customizer UI is Godot-side |
| Godot save/load menus and local store | Implemented | `codequest_save_store.gd`, `main_menu.gd`, `save_menu.gd` | Bridge-integrated |
| Pyodide Python runner | Implemented | `src/services/runner/pyodideRunner.ts`, `public/python-worker.js` | Worker-based, timeout/cancel/reset |
| Ticket system and XP | Implemented | `src/features/tickets/*`, `src/features/progress/*` | CQ-001..CQ-005; XP derived from verified Pyodide tests |
| Virtual filesystem | Implemented | `src/services/filesystem/*` | IndexedDB-backed FS |
| Terminal/Explorer/Editor workflow | Implemented | `features/terminal`, `features/explorer`, `features/editor`, tests | Dirty-file protections and Python run flow present |
| Browser/GigBoard | Implemented (simulated) | `features/browser/*` | Internal simulated sites, not general web |
| Mail app | Implemented (simulated) | `features/mail/*` | Scripted/simulated client communication |
| Café project workflow | Implemented | `chapter1/cafeSetup/*`, `chapter1/cafeCoding/*`, tickets/mail/browser integration | Large Chapter 1 workflow with many tests |
| Automated tests | Implemented | `src/**/*.{test,spec}.{ts,tsx}` | 65 files / 540 tests passed in baseline |
| Production build | Implemented | `npm run build` | Passed in baseline; chunk size warning |
| Lint baseline | Partially implemented / blocked | `npm run lint` | Timed out twice in baseline (120s, 180s) |

## Near-Term Priorities

1. **Stabilize development baseline**
   - Investigate ESLint timeout and make lint runnable in CI/local workflow.
   - Address build chunk-size warning through deliberate code-splitting if appropriate.
   - Reconcile `package.json` dev port user modification with team convention (5173 requested by user rule; 9090 currently configured).

2. **Protect Chapter 1 end-to-end flow**
   - Add/maintain regression coverage around Godot↔React save/load/quest sync boundaries.
   - Validate full manual Chapter 1 playthrough after major changes.
   - Keep Godot web export parity process explicit.

3. **Documentation and process discipline**
   - Use `docs/reports/` for every actionable task.
   - Record architecture decisions before high-impact changes.
   - Keep `KNOWN_ISSUES.md` and `CHANGELOG.md` current.

## Mid-Term Priorities

- **Reduce coupling in Chapter 1 café workflow**: isolate domain logic, bridge adapters, and UI where possible.
- **Harden persistence contracts**: clearer ownership and migration/versioning strategy across React IndexedDB and Godot saves.
- **Improve test signal quality**: separate fast unit tests from slower integration/UI suites; make lint/typecheck/build routine.
- **Godot export/validation workflow**: document and script repeatable export and smoke checks.

## Long-Term / Planned

- Chapter 2+ narrative and quest systems.
- Broader Python curriculum/ticket catalog beyond current Chapter 1/MVP set.
- Richer in-game economy/wallet model beyond Chapter 1 payment flow (if designed).
- Potential backend/cloud sync/multiplayer only if explicitly planned; **not currently implemented**.
- Security hardening for untrusted code execution beyond worker isolation caveats (design needed before claims).

## Explicit Non-Goals for Current Baseline

- No new gameplay features during environment setup.
- No architecture rewrites without impact analysis and approval.
- No dependency additions for convenience.
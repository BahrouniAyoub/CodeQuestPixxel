# CodeQuest — Known Issues and Technical Debt

Status as of 2026-11-26 baseline. Items are observed from code/docs/baseline runs; confirm before fixing.

## Active Issues / Risks

| ID | Area | Severity | Status | Description | Evidence / Notes |
|---|---|---|---|---|---|
| KI-001 | Tooling | Medium | Open | `npm run lint` timed out twice (120s, 180s) during baseline. | Baseline run on 2026-11-26; no pass/fail result. Investigate ESLint config, ignored paths, or performance. |
| KI-002 | Build | Low | Open | Production build emits large chunk warning (>500kB) and tsconfig-paths native suggestion. | `npm run build` passed but warned about `PixelOS-Dg947klu.js` ~808kB minified and plugin timings. |
| KI-003 | Dev config drift | Medium | Open | `package.json` has local user modification changing dev script to `vite dev --port 9090 --strictPort`, while user/project rule requests 5173 when available. | `git status` shows modified `package.json`; do not overwrite. Resolve convention with approval. |
| KI-004 | Docs freshness | Medium | Open | `docs/AI_PROJECT_CONTEXT.md` is partially stale (states branch `pixelos-dev`, React-only focus) compared to current repo state. | Current branch is `feature/pixelos-cleanup`; repo contains Godot+React integration and many Chapter 1 systems. Keep compatible, but prefer canonical docs. |
| KI-005 | Architecture complexity | High | Open | Save/load and quest progression span React IndexedDB, Godot local saves, bridge messages, and multiple stores. | `game.tsx`, `chapter1Store`, `gameSave`, `codequest_save_store.gd`, `chapter1_state_sync.gd`. High regression risk. |
| KI-006 | Godot export parity | Medium | Open | Web export in `public/godot/` can drift from `godot-source/`. | No automated check in baseline; changes require manual export/rebuild discipline. |
| KI-007 | Python runner security | Medium | Known limitation | Pyodide worker is not a security sandbox for hostile code. | `pyodideRunner.ts` comment; design limitation, not a bug to hide. |
| KI-008 | Simulated apps | Low | Known limitation | Browser and Mail are intentionally simulated/internal MVP experiences, not full real services. | Feature docs and implementation. |
| KI-009 | Generated artifacts in workspace | Low | Open | `node_modules/`, `.output/`, `.wrangler/` exist locally; can create noise/confusion. | `.gitignore` covers most, but local presence requires care not to commit artifacts. |
| KI-010 | Tests | Low | Open | `GigBoardDevMode.test.tsx` showed a timing-sensitive failure during full `npm test` run but passed on isolated rerun. | Observed 2026-11-26 during Task 002 full suite: 1/540 failed; isolated rerun 7/7 passed. Investigate async wait/assertion robustness. |

## Resolved / Historical Notes

- Stage notes indicate prior MVP limitations; many have since been implemented (editor, chat, progress, terminal, explorer, Chapter 1 flows). Verify against current code before assuming old limitations still apply.

## Update Rules

- Add newly discovered bugs with evidence and reproduction.
- Mark resolved issues with date, commit/report reference, and validation.
- Do not remove historical context if it helps future debugging; move to resolved/historical section instead.
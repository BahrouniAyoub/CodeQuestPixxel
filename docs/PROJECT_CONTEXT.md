# CodeQuest — Project Context

## Purpose and Vision

CodeQuest is a story-driven programming learning game. The player explores a 2D Godot world, interacts with NPCs, and uses an in-game PixelOS desktop to complete coding/freelance work. The current playable narrative focus is **Chapter 1: "The First Paycheck"**, where the player finds a Python freelance job, builds a café calculator, submits work, gets paid $50, and reports back to Dad.

**Status**: Implemented as a playable vertical slice for Chapter 1; broader chapters/curriculum are planned.

## Product Shape

- **Godot**: game world, character customization, NPC interaction, quests/markers, save menus, and scene flow.
- **React + TypeScript (PixelOS)**: desktop-style in-game operating system with apps for tickets, editor, chat, mail, browser, progress, quest journal, settings, terminal, and file explorer.
- **Integration**: Godot Web export runs in a React iframe on `/game`; communication uses same-origin `window.postMessage` and a shared chapter-state mirror.
- **Python execution**: real Pyodide Web Worker for running/testing Python in-browser.
- **Persistence**: browser IndexedDB for PixelOS state and virtual filesystem; Godot local save store for Godot-side records, coordinated through bridge messages.

## Repository Baseline (2026-11-26)

| Item | Value |
|---|---|
| Branch | `feature/pixelos-cleanup` |
| HEAD | `99632b1 Merge pull request #1 from BahrouniAyoub/feature/godot-save-system` |
| Remote | `origin https://github.com/BahrouniAyoub/CodeQuestPixxel.git` |
| Working tree | `package.json` modified locally (`dev` script changed to `vite dev --port 9090 --strictPort`) — **user modification, do not overwrite** |
| Package manager | npm (`package-lock.json` present; `bun.lock` also present) |
| Node deps | `node_modules/` present locally |

## Key Commands

Run from repository root:

```sh
npm run dev          # Vite dev server (currently configured as --port 9090 --strictPort)
npm run build        # Production build
npm run build:dev    # Development-mode build
npm run preview      # Preview built app
npm run lint         # ESLint
npm run format       # Prettier write
npm test             # Vitest run
npm run test:watch   # Vitest watch
```

## Local Development Port

The user requested port 5173 for local development unless project config specifies another available port. **Actual project config currently specifies port 9090** in `package.json` (`vite dev --port 9090 --strictPort`) and this is a local user modification. Do not change it without approval. If 5173 is needed, confirm before editing `package.json`.

## Major Directories

| Path | Purpose |
|---|---|
| `src/app/` | PixelOS shell, boot screen, shell styles |
| `src/core/applications/` | App registry and app component wiring |
| `src/core/windows/` | Window reducer/store/geometry |
| `src/features/` | Feature modules: chapter1, tickets, editor, terminal, explorer, browser, mail, chat, progress, journal, settings, notifications, gameMenu |
| `src/services/persistence/` | IndexedDB wrapper, save status, atomic transactions |
| `src/services/filesystem/` | Virtual IndexedDB filesystem |
| `src/services/runner/` | Pyodide worker runner and test execution |
| `src/routes/` | TanStack Start/Router file routes (`game.tsx` is main integration route) |
| `src/components/ui/` | Reusable UI primitives (shadcn/Radix style) |
| `public/godot/` | Godot web export artifacts embedded by React |
| `public/python-worker.js` | Pyodide worker script |
| `godot-source/MVPCODE (1)/MVPCODE/` | Godot project source, scenes, scripts, assets, addons |
| `docs/` | Project documentation and implementation notes |

## Current Implementation Summary

| Area | Status | Notes |
|---|---|---|
| Godot world/customizer/main menu/save menu | Implemented | Source in `godot-source/...`; web export in `public/godot/` |
| PixelOS desktop/window manager | Implemented | Zustand reducer/store, draggable/resizable windows, taskbar/start/search |
| Chapter 1 quest model/store/validation | Implemented | Canonical 8 quests, strict linear progression, validated saves |
| Godot↔React bridge | Implemented | Open OS, chapter state sync, CH1-01/02/08 validated completion, save/load request/snapshot/import |
| Tickets + XP progression | Implemented | 5 tickets CQ-001..CQ-005, XP derived from verified Pyodide completions |
| Pyodide Python runner | Implemented | Web Worker, timeout/cancel/reset, output limit, test suite runner |
| Virtual filesystem | Implemented | IndexedDB `fs` store, Explorer/Terminal/Editor integration |
| Browser/GigBoard/Mail/Cafe workflow | Implemented (MVP/simulated where noted) | Extensive Chapter 1 client-project flow; browser is internal simulated sites |
| Game save/load across React+Godot | Implemented | Bridge-coordinated snapshots/imports; complex flow, needs careful regression testing |
| Chapter 2+ | Planned | No concrete implementation found |

## Known Constraints

- `@lovable.dev/vite-tanstack-config` provides built-in Vite/TanStack/Nitro wiring; do not duplicate plugins manually (`vite.config.ts`).
- TypeScript is strict (`tsconfig.json` includes `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.).
- Pyodide worker is not a security sandbox for hostile code.
- Browser app is intentionally internal/simulated, not a general web browser.
- Godot web export in `public/godot/` must be kept consistent with `godot-source/` when Godot behavior changes.

## Related Docs

- `docs/AI_PROJECT_CONTEXT.md` — earlier compact AI context (keep compatible).
- `docs/ARCHITECTURE.md` — system design and data flows.
- `docs/ROADMAP.md` — status and priorities.
- `docs/GAME_DESIGN.md` — player experience and Chapter 1 design.
- `docs/TESTING_GUIDE.md` — how to verify changes.
- `docs/KNOWN_ISSUES.md` — current risks and debt.
- `docs/reports/` — task implementation reports.
- `docs/decisions/` — architectural decision records.

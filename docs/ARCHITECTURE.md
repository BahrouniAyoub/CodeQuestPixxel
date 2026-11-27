# CodeQuest — Architecture

## High-Level Architecture

CodeQuest is a hybrid game: a Godot 4 web export provides the 2D world, while a React/TypeScript PixelOS provides in-game computer UI. React owns the `/game` route and embeds Godot in an iframe.

```text
TanStack Start / React
  └─ /game route (src/routes/game.tsx)
       ├─ iframe: /godot/index.html (public/godot export)
       └─ overlay: PixelOS (src/app/PixelOS.tsx)
            ├─ Window Manager (src/core/windows/*)
            ├─ App Registry (src/core/applications/registry.ts)
            ├─ Feature Apps (src/features/*)
            └─ Services (src/services/*)
                 ├─ persistence/db.ts (IndexedDB)
                 ├─ filesystem/filesystem.ts (virtual FS in IndexedDB)
                 └─ runner/pyodideRunner.ts + public/python-worker.js
```

## Frontend / PixelOS

### Routing
- TanStack Start file routes in `src/routes/`.
- `game.tsx` is the main integration point: mounts Godot iframe, handles bridge messages, shows/hides PixelOS overlay, coordinates save/load/state commit, and passes the live character name plus a shared Return to Game callback to PixelOS.

### App Shell
- `src/app/PixelOS.tsx`: hydrates stores, renders desktop, windows, notifications, and delegates the Start menu to `StartMenu` and taskbar to `Taskbar`.
- `src/app/StartMenu.tsx` / `StartMenu.css`: reusable Windows-style launcher; owns Start pin/search/all-apps views, recommendations, player/quest footer, keyboard/focus handling, and stable semantic IDs. It launches apps through the existing window manager only.
- `src/app/Taskbar.tsx` / `Taskbar.css`: dynamic taskbar UI. Derives visible items from window state and effective taskbar pin preference via pure `src/app/taskbarModel.ts`. Shows pinned apps (open or closed) and open unpinned apps (including minimized), one entry per app; closed unpinned apps are removed, closed pinned apps remain. Uses `taskbarClick(id)` for icon clicks; context menu provides state-aware Open/Focus/Restore/Minimize/Close/Pin/Unpin actions and closes through `windowStore.close(id)` (Editor dirty guard preserved). Provides lightweight name+state tooltip, horizontal overflow controls, and stable tutorial IDs (`taskbar`, `taskbar-app-${id}`, `taskbar-app-indicator-${id}`, overflow/context-menu IDs).
- `src/app/BootScreen.tsx`: boot/restore fallback.
- `src/app/pixel-os-shell.css` and feature CSS files provide styling. Taskbar-specific styles live in `Taskbar.css`.

### Window Management
- Pure reducer: `src/core/windows/windowReducer.ts`.
- Zustand store: `src/core/windows/windowStore.ts`.
- Responsibilities: open/close/focus/minimize/maximize/geometry/taskbar click behavior/z-order/clamping/hydration.
- Geometry persisted debounced to IndexedDB `prefs/windows`.
- Closing editor can be blocked by dirty file session (`useFileSession().closeFile()`).
- Taskbar presentation is derived in `taskbarModel.ts` and rendered by `Taskbar.tsx`; it reads window state but does not create a second window manager/store. Normal taskbar icon clicks reuse `taskbarClick(id)`; Start menu launch continues to use `open(id)`.

### App Registry
- `src/core/applications/registry.ts` defines `AppId`, metadata, default/min sizes, pinning, ordering, and search. `PINNED_APPS` remains the registry default pin list (used by desktop shortcuts and as the taskbar default when no custom taskbar pin preference exists); `START_PINNED_APPS` is an ID-only Start-menu view order. `searchApps()` matches IDs, titles, short titles, and descriptions. Deterministic `APP_ORDER` is used by taskbar derivation for open unpinned apps.
- Current apps: `tickets`, `editor`, `chat`, `mail`, `browser`, `progress`, `journal`, `settings`, `terminal`, `explorer`.

### Feature Modules
- `chapter1/`: canonical quests, progress, validation, store, Godot bridge, tracker UI, cafe setup/coding/payment/submission flows.
- `tickets/`: ticket data, drafts, ticket/cafe boards, delivery UI.
- `editor/`: CodeMirror Python editor, run/submit/tests, file mode, draft/file session integration.
- `terminal/`: limited command-line interface, Python execution through shared runner.
- `explorer/`: virtual filesystem UI.
- `browser/`: simulated internal sites/pages including GigBoard. `browserNavigationIntent.ts` is a non-persisted one-shot handoff from launcher surfaces; `BrowserApp` consumes it through the existing `goTo()` path so there is still one router and one CH1-03 discovery guard.
- `mail/`: scripted/simulated client communication.
- `progress/`: XP/level/achievements derived from verified ticket completions.
- `journal/`: Chapter 1 quest journal/tracker.
- `gameMenu/`: React-side game save record validation/listing/import helpers.
- `notifications/`: OS notifications.

## Godot Architecture

Source: `godot-source/MVPCODE (1)/MVPCODE/`. Web export: `public/godot/`.

### Key Godot Components
- `project.godot`: main scene `scene/main_menu.tscn`, autoloads `CharacterData`, `CharacterSettings`, `DialogueManager`, `QuestManager`, `CodeQuestStateSync`.
- `script/codequest_bridge.gd`: static bridge. Reads React chapter mirror, validates/emits completion events, handles save/load/character snapshot requests.
- `script/chapter1_state_sync.gd`: listens for React `postMessage` events, applies chapter state to Godot, writes/loads Godot save records.
- `script/QuestManager.gd`: world objective/marker/journal sync from chapter state.
- `script/codequest_save_store.gd`: local `user://codequest_saves.json`, schema v1, slots `auto/1/2/3`.
- `script/main_menu.gd`, `script/save_menu.gd`: save/load/new game UI flow.
- `script/computer_interaction.gd`: emits `codequest:open-os` and CH1-02 completion through bridge.
- `script/CustomizerMain.gd`, `script/character_data.gd`, `script/CharacterSettings.gd`: character creation/appearance.

### Godot Runtime Notes
- Godot source and web export are separate artifacts. Changes in `godot-source/` do not affect the running web build until exported to `public/godot/`.
- Godot validation/export was not executed in this setup baseline.

## Godot ↔ React Communication

Defined primarily by `src/routes/game.tsx`, `src/features/chapter1/godotBridge.ts`, and Godot bridge scripts.

### Channels
- **window.postMessage**: same-origin messages between React page and Godot iframe.
- **Mirror state**: `window.__codequestChapterState` for on-demand reads; React also posts `codequest:chapter-state` on changes.

### Important Message Types

| Direction | Type | Purpose | Status |
|---|---|---|---|
| Godot → React | `codequest:open-os` | Open PixelOS overlay | Implemented |
| Godot → React | `codequest:chapter1-intro-complete` | Complete CH1-01 after real intro dialogue | Implemented |
| Godot → React | `codequest:chapter1-computer-complete` | Complete CH1-02 after real computer interaction | Implemented |
| Godot → React | `codequest:chapter1-father-complete` | Complete CH1-08 after real return dialogue | Implemented |
| Godot → React | `codequest:request-state` | Request React snapshot for save | Implemented |
| Godot → React | `codequest:load-state` | Apply loaded save in React stores | Implemented |
| Godot → React | `codequest:character-snapshot` | Update latest character snapshot | Implemented |
| Godot → React | `codequest:new-game` | Reset Chapter 1/reactive state for new game | Implemented |
| React → Godot | `codequest:chapter-state` | Publish chapter state changes | Implemented |
| React → Godot | `codequest:state-snapshot` | Provide save snapshot | Implemented |
| React → Godot | `codequest:load-applied` | Confirm load applied | Implemented |
| React → Godot | `codequest:state-commit` | Ask Godot to commit/save after quest progress | Implemented |
| React → Godot | `codequest:import-saves` | Import legacy/React-side saves | Implemented |
| React → Godot | `codequest:save-failed` | Report save snapshot failure | Implemented |

### Bridge Rules
- Validate `origin` and `source` before trusting messages.
- Accept only exact payload shapes for quest completion events.
- Do not dedupe failed saves as permanently handled; retries must be possible.
- React Chapter 1 store is authoritative for quest progression; Godot consumes mirrored state.

## Persistence Architecture

### IndexedDB (`src/services/persistence/db.ts`)
- DB: `codequest-pixel-os`, version 1.
- Stores: `progress`, `drafts`, `prefs`, `chat`, `fs`.
- `dbAtomic` supports conditional read/plan/write transactions for guarded one-time records.

### Key Persisted Domains
- **Chapter 1**: `progress/chapter1` (`chapter1Store.ts`), validated versioned record.
- **Game saves**: `progress/codequest:save:*` (`gameMenu/gameSave.ts`).
- **Cafe/GigBoard/Mail/Payment**: feature-specific keys in IndexedDB stores (see feature modules).
- **Window geometry**: `prefs/windows`.
- **Settings**: `prefs/settings` (theme, UI scale, reduced motion, notifications, and additive optional `taskbarPinnedAppIds` global UI preference; missing = registry defaults, explicit `[]` = no taskbar pins).
- **Drafts**: `drafts/*`.
- **Chat**: `chat/state`.
- **Filesystem**: `fs/*` paths as keys.

### Godot Saves
- `CodeQuestSaveStore.gd` stores local saves in `user://codequest_saves.json`.
- Slots: `auto`, `1`, `2`, `3`.
- React and Godot coordinate save/load through bridge messages; both sides must be considered when changing save flow.

## Python Execution

- `src/services/runner/pyodideRunner.ts`: singleton worker runner.
- `public/python-worker.js`: worker implementation.
- `src/services/runner/types.ts`: request/result contracts.
- `src/services/runner/testing.ts`: test suite execution and verification.
- Constraints: one active run, init timeout, execution timeout, output cap, cancel/terminate/reset, `engine==="pyodide"` required for trusted verification.

## Quest and Progression Architecture

### Chapter 1 Story Progression
- Canonical source: `src/features/chapter1/chapter1Quests.ts`.
- Pure progression: `chapter1Progress.ts`.
- Validation: `chapter1Validation.ts`.
- Store: `chapter1Store.ts` - hydration, queued saves, save-before-commit, adopt.
- Bridge handlers: `godotBridge.ts`.

### Ticket/XP Progression
- Tickets: `src/features/tickets/data/tickets.ts`.
- XP/achievements/unlock logic: `src/features/progress/progressLogic.ts`.
- XP is derived from verified completions; no stored XP counter as authority.

### Café Project Workflow
- Implemented across `chapter1/cafeSetup`, `chapter1/cafeCoding`, `browser`, `mail`, `tickets`.
- Includes setup, milestones, coding/dev, docs, submission, delivery, payment, review, quest sync.
- Complex and highly coupled to Chapter 1; changes require regression tests.

## Architectural Risks

- **Dual persistence domains** (IndexedDB + Godot local saves + bridge snapshots) can drift if contracts change.
- **Bridge contract fragility**: message schema/origin/source/payload validation must remain exact.
- **Large feature coupling** in Chapter 1 café workflow.
- **Generated artifacts present** (`node_modules`, `.output`, `.wrangler`) increase noise; avoid committing/generated churn.
- **Godot export parity**: source changes require web export rebuild for browser gameplay.
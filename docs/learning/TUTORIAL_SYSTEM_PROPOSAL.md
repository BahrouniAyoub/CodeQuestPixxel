# Tutorial System Proposal (Revised)

> **Status**: Proposed design (documentation only). No dependency installed.  
> **Date**: 2026-11-26 (revised after Task 003 review)

## 1. Requirement Summary

CodeQuest needs a reusable, in-game PixelOS tutorial system supporting spotlight highlighting, contextual tooltips, action-gated progression, stable target IDs, app open/focus automation, first-time-only guidance, skip/replay/resume, recovery, keyboard accessibility, persistence across refresh/save/load, and compatibility with movable/resizable windows and future UI improvements.

**Review constraints (must be satisfied):** contextual and action-based; advance only after the relevant action actually succeeded; support non-blocking guidance, skip, replay, resume, keyboard accessibility, and recovery when windows are moved/closed/minimized; do not unnecessarily restrict exploration of PixelOS; skipping tutorials never completes programming assessments.

## 2. Options Compared

| Criteria | Driver.js | React Joyride | Custom lightweight system |
|---|---|---|---|
| Fit with React 19 + custom windows | Medium - DOM-focused, needs integration | Medium - React-oriented but heavier/older patterns | **High** - built for PixelOS window/store events |
| Movable/resizable window tracking | Manual work | Manual work | **High** - subscribes to windowStore geometry/order/focus |
| Action-gated progression on success | Custom hooks needed | Controlled steps possible, custom wiring needed | **High** - semantic app events + state predicates |
| Open/focus app automation | External | External | **High** - direct windowStore/registry actions |
| Non-blocking exploration | Possible but custom | Possible but custom | **High** - explicit non-blocking/paused mode |
| Persistence/resume | External | External | **High** - integrates with existing persistence model |
| Accessibility | Needs audit/customization | Needs audit/customization | **High** if designed with ARIA/focus/reduced motion from start |
| Bundle/dependency cost | Small dependency | Dependency + styling constraints | No new dependency; implementation cost instead |
| Styling control | Moderate | Moderate | **High** - use existing `cq-*` styles |
| Maintenance risk | External API/version changes | External API/version changes | Internal ownership; requires tests/docs |
| Time to MVP | Fast for static tours | Fast for simple tours | Medium |

## 3. Recommendation

**Recommend: Custom lightweight tutorial system**.

### Why

- PixelOS windows are draggable/resizable and managed by a custom Zustand window store. Target tracking must react to geometry/focus/order changes.
- Action-gated steps must verify semantic success events (file saved, code run completed, test submitted, route changed, quest-state change) rather than DOM clicks.
- Non-blocking exploration and recovery require tight integration with app/window state.
- CodeQuest has strict dependency discipline; a small custom system avoids dependency churn and matches existing patterns.
- The system can be data-driven and reused across chapters/apps.

## 4. Proposed Architecture

### Core modules (future)

- `src/core/tutorial/tutorialTypes.ts` - Tutorial, Step, Target, Condition, Action, Recovery types.
- `src/core/tutorial/tutorialStore.ts` - Zustand store: active tutorial, step index, status, pause/resume/skip.
- `src/core/tutorial/tutorialRegistry.ts` - registers tutorial definitions by ID.
- `src/core/tutorial/tutorialEngine.ts` - pure transition logic (start/next/back/skip/pause/resume/complete/recover).
- `src/core/tutorial/targetResolver.ts` - resolves `data-tutorial-id` to DOM rect; observes resize/mutation/scroll.
- `src/core/tutorial/tutorialEvents.ts` - typed semantic event helpers/predicates.
- `src/app/TutorialOverlay.tsx` - spotlight, tooltip, focus management, recovery UI.
- `src/services/persistence/tutorialProgress.ts` - load/save progress per ownership model.

### Step model (proposed)

```ts
interface TutorialStep {
  id: string;
  tutorialId: string;
  title: string;
  body: string;
  targetId?: string;              // data-tutorial-id
  placement?: "auto" | "top" | "bottom" | "left" | "right";
  openAppId?: string;             // optional recovery/open action
  focusAppId?: string;
  advance: {
    kind: "manual" | "event";
    eventType?: string;           // e.g. "editor.run.completed"
    successPredicateId?: string;  // pure predicate registered in code
  };
  recovery?: {
    onTargetMissing: "pause" | "reanchor" | "skip-step";
    prompt: string;
  };
  skippable?: boolean;            // default true for UI tutorials
  blockingMode?: "none" | "soft"; // never hard-block exploration globally
}
```

### Event model

Prefer explicit semantic events dispatched by app actions, not DOM scraping:

- `window.opened`, `window.focused`, `window.minimized`, `window.closed`
- `app.route.changed`
- `editor.run.completed` (result received)
- `editor.file.saved`
- `practice.submitted` / `assessment.passed`
- `mail.thread.opened`, `mail.message.sent`
- `tutorial.recovery.action`

Predicates must check **actual success**. Examples: run completed with no worker crash; file created in virtual FS; message persisted; assessment passed by validator.

## 5. UX Rules

- **Contextual**: trigger when objective/app/context requires it.
- **Non-blocking**: player can explore other apps; tutorial pauses and shows resume CTA.
- **No exploration lockout**: do not disable unrelated desktop/app interactions unless a narrow, temporary modal is essential.
- **Skip/replay/resume**: available in tooltip and Settings > Tutorials.
- **Recovery**: moved/resized -> reposition; minimized -> restore prompt; closed -> reopen prompt; missing target -> pause/reanchor/skip-step.
- **Never fake progress**: skipping/dismissing tutorial does not complete programming assessments, lessons, or quests.

## 6. Accessibility and Input

- Keyboard: Tab/Shift+Tab within tooltip, Enter/Space activate, Esc pauses.
- Screen reader: `role="dialog"` for modal steps, live region for updates, descriptive labels.
- Focus: visible focus ring; focus trap only in modal step mode, with Esc exit.
- Reduced motion: respect `settings.reduceMotion`.
- Contrast: spotlight border and tooltip meet contrast requirements; no color-only cues.

## 7. Persistence and Save Ownership

- Tutorial UI progress/preferences are **global UI preferences** by default (per-device/browser profile) unless a tutorial is tightly coupled to narrative state; narrative-gated tutorial unlocks may be derived from per-save quest/learning state.
- Do not store tutorial progress in a way that creates a second quest authority.
- No save schema changes/migrations in this task. Any future key addition requires ADR/migration plan.
- See `LEARNING_ARCHITECTURE_PROPOSAL.md` for ownership matrix.

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Overlay conflicts with window focus/z-index | Dedicated z-index layer; focus tests; soft mode default |
| Brittle selectors | Require `data-tutorial-id`; lint/checklist |
| Tutorial blocks exploration | Non-blocking default; pause/resume/skip |
| Action event missed | Semantic event + state predicate; manual "I've done it" only for non-critical UI steps, never for assessments |
| False success | Success predicates check persisted/state-confirmed outcome |
| Save bloat/complexity | Small versioned records per tutorial ID |

## 9. Decisions Needed

- Approve custom lightweight system (recommended) vs dependency.
- Approve global UI preference ownership for tutorial UI state, with narrative unlocks derived from per-save quest state.
- Approve "skippable by default, replayable always" for UI tutorials.
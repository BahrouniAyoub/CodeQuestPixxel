# CodeQuest — Game Design

## Design Intent

CodeQuest teaches programming through a story-driven "learn by doing" experience. The player is not just solving isolated exercises; they inhabit a character whose programming skills create in-game opportunities.

## Core Player Loop

1. **Explore world** in Godot (talk to NPCs, move through scenes).
2. **Receive objective** through story/quest UI.
3. **Use PixelOS** to find work, read messages, write/run Python, and submit deliverables.
4. **Get feedback/reward** through tests, client responses, quest completion, and payment.
5. **Return to story** to advance the chapter.

## Chapter 1 — "The First Paycheck"

**Status**: Implemented as the primary vertical slice.

### Narrative Goal
The player proves they can use Python skills to earn a first real freelance payment ($50) and gain confidence.

### Canonical Quest Chain

Source of truth: `src/features/chapter1/chapter1Quests.ts`.

| ID | Title | Objective | Location | Reward |
|---|---|---|---|---|
| CH1-01 | A Tough Morning | Talk to Dad in the living room | Living room · Dad | $0 |
| CH1-02 | Check the Computer | Use the computer in your bedroom | Bedroom · Computer | $0 |
| CH1-03 | Find a Job | Find a Python job on GigBoard | PixelOS · GigBoard | $0 |
| CH1-04 | Apply for the Job | Apply to the café calculator project | PixelOS · GigBoard | $0 |
| CH1-05 | Build the Calculator | Finish and test the café project | PixelOS · Code Editor | $0 |
| CH1-06 | Send Your Work | Submit the finished project to the client | PixelOS · Submit Project | $0 |
| CH1-07 | Get Paid | Claim your $50 payment | PixelOS · Mail | $50 |
| CH1-08 | Share the Good News | Go home and tell Dad about your job | Living room · Dad | $0 |

### Progression Rules
- Linear, ordered progression; no skipping.
- Active quest only can be completed.
- Duplicate completion is ignored/idempotent.
- Chapter 1 payment is one-time and guarded (`paymentClaimed` and payment records).
- CH1-01/02/08 are completed by validated Godot bridge events from real interactions/dialogues.
- CH1-03..07 are completed through PixelOS workflows (GigBoard/cafe project/editor/mail/payment flow).

## PixelOS Experience

PixelOS is a simulated desktop inside the game, not a general-purpose OS.

### Implemented Apps

| App | Player Purpose | Status |
|---|---|---|
| My Tickets | Practice coding tickets / project boards | Implemented |
| Code Editor | Write and run Python, complete project work | Implemented |
| Team Chat | Scripted team communication | Implemented (MVP) |
| CodeQuest Mail | Client/project communication, payment messages | Implemented (simulated) |
| Browser | Internal sites including GigBoard | Implemented (simulated) |
| Progress | XP, level, achievements | Implemented |
| Quest Journal | Current Chapter 1 objective and completed quests | Implemented |
| Settings | Appearance/notifications/data/reset actions | Implemented |
| Terminal | Limited filesystem/Python commands | Implemented (limited) |
| File Explorer | Browse/edit virtual files | Implemented |

## Learning Design

### Ticket Track (Practice)
- Tickets CQ-001..CQ-005 teach basic Python concepts (variables/input/conditions/loops/lists as represented by ticket data).
- XP awarded only for verified Pyodide test runs that pass all tests.
- Progression is derived from completion records; tickets unlock in order.

### Café Project (Applied)
- Player applies skills in a client-style project.
- Workflow includes job discovery, application, coding milestones, documentation, submission, review, and payment.
- Intended to bridge "exercise" and "real work" mental models.

## Character Customization

- Implemented in Godot customizer.
- Player can set name and appearance (body, skin, hair style/color, top, bottom, feet).
- Character snapshot is persisted and used by save/load flows.

## Save/Load Expectations

- Player should be able to continue Chapter 1 without losing quest progress, character, or payment state.
- Saves should be resilient to invalid/corrupted records; invalid Chapter 1 saves fall back safely without silently overwriting unreadable data.
- Any save/load behavior change requires careful regression testing.

## Design Constraints / Non-Goals (Current)

- No general internet browser; Browser app is internal/simulated.
- No hostile-code sandbox guarantee; Python execution is for gameplay, not untrusted arbitrary code security.
- No Chapter 2+ content implemented yet.
- No multiplayer/cloud backend currently implemented.
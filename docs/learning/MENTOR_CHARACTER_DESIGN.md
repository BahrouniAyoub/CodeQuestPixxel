# Mentor Character Design — "Alex" (Temporary Name)

> **Status**: Proposed design (documentation only). No gameplay/code changes were made.
> **Date**: 2026-11-26

## 1. Role in CodeQuest

Alex is a recurring senior software developer mentor. In Chapter 1, Alex helps the player move from "I found a job but don't know Python" to "I can deliver a small client project." In later chapters, Alex becomes a professional guide: reviewer, career advisor, and occasional source of realistic contracts.

## 2. Character Profile (Proposed)

| Field | Proposal |
|---|---|
| Temporary name | Alex Rivera (placeholder; final name can change) |
| Role | Senior Software Developer / friendly mentor |
| Experience | ~8 years professional software development, freelance and team experience |
| Personality | Calm, practical, encouraging, honest, never condescending |
| Voice | Clear, beginner-friendly, uses analogies, avoids jargon unless explained |
| Boundaries | Gives hints, explains concepts, reviews mistakes; does **not** hand over complete paid client solutions |
| Relationship to player | Trusted friend/contact who believes in the player's potential |
| Visual/signature cue | Simple avatar/icon, short signature: "— Alex" |

## 3. Narrative Function

- **Motivation**: turns intimidation into a plan.
- **Teaching**: provides lessons, examples, and progressive hints.
- **Professional modeling**: models how developers ask questions, test, debug, and communicate with clients.
- **Continuity**: appears across chapters as the player's career evolves.

## 4. Communication Channels

| Channel | Use | Implementation note |
|---|---|---|
| Mail | Primary Chapter 1 learning delivery, structured feedback, milestone confirmations | Reuse existing Mail app and scripted thread model |
| Browser | Hosts lesson pages Alex links to ("Learn Python" site) | Reuse Browser internal routes |
| Chat | Short progressive hints during practice/client tasks | Reuse Chat scripted responses; no external AI |
| Tickets/Editor feedback | Contextual task hints/review comments | Reuse existing hint/validation feedback patterns |

## 5. Mentoring Rules

1. **Never dump full solutions** for paid client tasks.
2. **Start with a nudge**, then a concept reminder, then a specific hint.
3. **Praise effort and process**, not only success.
4. **Normalize errors** as part of debugging.
5. **Use professional language** in client/delivery contexts.
6. **Be transparent** when a task requires prerequisite learning.

## 6. Hint Escalation Model (Proposed)

| Level | When | Style | Example |
|---:|---|---|---|
| H1 | First failure or request | Nudge | "Check what your function returns when the order is empty." |
| H2 | Second failure | Concept hint | "A 10% discount means the customer pays 90% of the total." |
| H3 | Third failure | Targeted guidance | "Your condition should check `total >= 20`. Right now it misses the exact $20 case." |
| H4 | Optional, practice only | Near-solution scaffold | Pseudocode or partial structure; never final paid-task code |

Paid client tasks should cap at H3 by default. Practice exercises may allow H4 scaffolds.

## 7. Chapter 1 Mail/Chat Script Summary

Full proposed dialogue is in `CHAPTER_01_DIALOGUES.md`.

| Beat | Channel | Purpose |
|---|---|---|
| Player asks for help | Mail | Player admits they found a job but don't know Python |
| Alex responds with plan | Mail | Encourages player, gives 3-step plan and lesson link |
| Lesson check-ins | Chat/Mail | Short encouragement after lessons 1-4 and 5-8 |
| Readiness confirmation | Mail | Confirms player can take Café job |
| Post-delivery congrats | Mail | Celebrates first paycheck and professional habits |

## 8. Future Chapter Role

| Chapter stage | Alex role |
|---|---|
| Ch2 | Reviews data/report quality, introduces file-based thinking |
| Ch3 | Teaches defensive programming and client data cleanup |
| Ch4 | Introduces code organization and tests like a team lead |
| Ch5 | Coaches debugging/logging under pressure |
| Ch6+ | Acts as senior reviewer; may introduce other NPC mentors/clients |

## 9. Implementation Constraints

- Scripted content only for MVP; no external LLM/chatbot API.
- Mentor interactions should be data-driven where possible (`MentorInteraction`, `Hint`, `DialogueScript`).
- Reuse Mail/Chat stores/UI; avoid creating a new mentor app.
- Keep mentor state separate from authoritative quest completion. Mentor confirmation can gate UI but must not silently complete quests.
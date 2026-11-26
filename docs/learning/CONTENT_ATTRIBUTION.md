# Content Attribution — Practical Python / CodeQuest (Revised)

> **Status**: Proposed attribution draft (documentation only). Not legal advice.  
> **Date**: 2026-11-26 (revised after Task 003 review)

## 1. Source Inspected

| Field | Value |
|---|---|
| Source | Practical Python Programming by David Beazley |
| Repository | https://github.com/dabeaz-course/practical-python |
| Local reference | `../practical-python-master` (workspace sibling) |
| Source commit hash | **Unavailable / not verifiable from local reference**. The inspected local directory is not a git checkout (`.git` absent) and contains no embedded commit metadata. **Do not guess a hash.** Record exact upstream commit hash from a git clone before publishing adapted content. |
| License file | `practical-python-master/LICENSE.md` |
| License | Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) |
| Course README license note | "Practical Python Programming is licensed under a Creative Commons Attribution ShareAlike 4.0 International License." |

## 2. Verified License Facts

From `LICENSE.md` and `README.md` (inspected locally):

- CC BY-SA 4.0 grants worldwide, royalty-free, non-sublicensable, non-exclusive, irrevocable license to reproduce/share and produce/share Adapted Material, subject to conditions.
- **Attribution (Section 3a)**: retain creator identification/copyright/license/warranty/URI as supplied where reasonable; indicate modifications; include license text/URI.
- **ShareAlike (Section 3b)**: adapted material shared must use CC BY-SA (same license elements, this version/later) or BY-SA Compatible License; include license text/URI; no additional effective technological restrictions.
- **No endorsement**: no implication of licensor endorsement.
- **No warranties/disclaimer**: as-is; liability limitation.
- README allows derivative works/translations with attribution and same license terms as applicable.

## 3. Provenance and Coverage (Issue 7)

### 3.1 Exact course revision

- **Exact upstream commit**: not verifiable from local `practical-python-master` (no `.git`). This limitation is documented here and in curriculum docs.
- **Provenance action required**: clone upstream repo, record `git rev-parse HEAD`, archive commit hash/date in attribution notice before any adapted content release.

### 3.2 Exact exercise coverage (verified by heading scan)

Command basis: `Select-String -Path Notes/*/*.md -Pattern "^### Exercise"` over local reference on 2026-11-26.

| Section | Exercise headings | Notes |
|---|---:|---|
| 1 Introduction to Python | 33 | 1.1–1.33 |
| 2 Working With Data | 26 | 2.1–2.26 |
| 3 Program Organization | 18 | 3.1–3.18, includes 3.13 intentionally blank |
| 4 Classes and Objects | 11 | 4.1–4.11 |
| 5 Inner Workings of Python Objects | 8 | 5.1–5.8 |
| 6 Generators | 15 | 6.1–6.15 |
| 7 A Few Advanced Topics | 11 | 7.1–7.11 |
| 8 Testing, Logging, and Debugging | 4 | 8.1–8.4 |
| 9 Packages | 5 | 9.1–9.5 |
| **Total exercise headings** | **131** | **130 numbered entries including 1 blank (3.13)** |

Coverage statement: **131 exercise headings inventoried; 130 numbered exercises including 1 intentionally blank entry (3.13).** The mapping document covers every numbered exercise 1.1–9.5.

## 4. Adaptation Implications (Proposed)

> Design proposal, not legal determination. Obtain legal review before publishing/distributing adapted content.

| Content type | Risk/obligation | Proposed handling |
|---|---|---|
| Copied/closely adapted notes/exercises | Likely Adapted Material | CC BY-SA attribution + ShareAlike; mark modifications |
| Independently written lessons inspired by concepts | Derivation degree matters | Legal review; if derived, treat as Adapted Material |
| Original CodeQuest game code | Separate original work | Keep under project software license; avoid mixing adapted course text into code without policy |
| Datasets copied from `Work/Data/` | Part of licensed material | Attribute and ShareAlike if redistributed |
| Exercise IDs/factual mapping in internal docs | Factual reference | Attribute source; avoid copying substantial expressive text |
| Solutions from `Solutions/` | Source solutions | Never expose to players; do not redistribute in player-facing content |

## 5. Proposed Attribution Text (Draft)

> Portions of CodeQuest's Python learning content are adapted from *Practical Python Programming* by David Beazley (https://github.com/dabeaz-course/practical-python), used under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Changes were made to adapt the material for CodeQuest's story-driven, beginner-focused, browser-based gameplay. Source revision: [INSERT COMMIT HASH AND DATE].

## 6. Required Follow-up Before Implementation

- [ ] Clone upstream repo and record exact commit hash/date.
- [ ] Decide direct adaptation vs original rewrite inspired by course structure.
- [ ] Legal review for ShareAlike impact on distributed content.
- [ ] Add NOTICE/LICENSE files for any adapted content directory.
- [ ] Add in-game credits attribution where required.
- [ ] Ensure no `Solutions/` content or exact paid-task solution leakage in player-facing content.
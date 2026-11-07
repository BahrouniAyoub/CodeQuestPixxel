# CodeQuest Browser — Realistic Upgrade

**Task:** Stage B, Step 4.1 — Chrome-style browser, QuestSearch, and GigBoard marketplace
**Branch:** `pixelos-dev` · **Status:** Complete

## 1. Summary

Upgraded the existing simulated CodeQuest Browser without changing its
network-free architecture. The browser now has Chrome-inspired tabs, toolbar,
omnibox behavior, bookmarks, and a three-dot menu. It also ships a fictional
QuestSearch engine and a professional GigBoard freelance marketplace with seven
jobs, filters, detail pages, and a non-functional application preview.

All navigation remains internal to the browser viewport. The parent React app
does not navigate away from `/game`, the Godot bridge is untouched, and no
Chapter 1 quest state is read or mutated by the browser.

## 2. Files created and modified

| File | Action | Purpose |
|---|---|---|
| `src/features/browser/BrowserApp.tsx` | Rewritten | Tabs, toolbar, omnibox, bookmarks, menu, page routing. |
| `src/features/browser/browserRoutes.ts` | Extended | Job/search routes, omnibox resolution, URL builders. |
| `src/features/browser/browser.css` | Rewritten | Chrome shell, QuestSearch, GigBoard, and not-found styles. |
| `src/features/browser/BrowserApp.test.tsx` | Rewritten | 20 focused browser tests. |
| `src/features/browser/data/gigboardJobs.ts` | Created | Seven fictional jobs, categories, difficulties, filters. |
| `src/features/browser/data/searchIndex.ts` | Created | Deterministic local search index and ranking function. |
| `src/features/browser/pages/BrowserHomePage.tsx` | Created | CodeQuest browser start page. |
| `src/features/browser/pages/QuestSearchPage.tsx` | Created | Search home, results, suggestions, empty state. |
| `src/features/browser/pages/GigBoardPage.tsx` | Created | Marketplace home, listings, search, filters. |
| `src/features/browser/pages/GigBoardJobDetails.tsx` | Created | Full job detail page and disabled apply preview. |
| `src/features/browser/pages/NotFoundPage.tsx` | Created | Friendly unknown-address fallback. |
| `docs/CODEQUEST_BROWSER_REALISTIC_UPGRADE.md` | Created | This document. |

The existing registry, Pixel OS shell, window manager, icon, Godot bridge, and
Chapter 1 progression code were not modified in this step.

## 3. Browser UI and tab architecture

```mermaid
flowchart TD
  T[Tab state: BrowserTab[]] --> H[BrowserHistory per tab]
  H --> A[Current address]
  A --> R[resolveBrowserAddress]
  O[Omnibox input] --> N[navigateBrowserHistory]
  N --> X[resolveOmniboxInput]
  X --> H
  R --> Home[Browser home]
  R --> Search[QuestSearch]
  R --> Gig[GigBoard]
  R --> NF[Not found]
  Search --> Idx[searchQuestSearch]
  Gig --> Jobs[GigBoard jobs + filters]
  Gig --> Detail[Job details]
```

Each tab stores its own `BrowserHistory` object. `BrowserApp` holds a small
tab array plus the active tab ID — no extra state library was added.

- **New Tab (+)** creates a fresh tab at `home.codequest`.
- **Switch** updates the active tab and address bar.
- **Close** removes a tab; closing the last tab replaces it with a fresh home tab.
- **History** back/forward commands only mutate the active tab's history.
- Page components are keyed by tab, address, and refresh counter, so switching
  tabs cannot leak search or filter state between pages.

The tab strip, rounded omnibox, compact icon buttons, dropdown menus, hover
states, and dark chrome give the browser a modern feel while the surrounding
Pixel OS keeps its pixel-art frame.

## 4. Navigation and address handling

`normalizeBrowserAddress` trims input, accepts an optional `http(s)://` prefix,
lowercases the host/path, removes trailing slashes, and re-encodes queries while
preserving search casing.

`resolveOmniboxInput` implements Chrome-style behavior:

- `gigboard.codequest` → GigBoard home.
- `home.codequest` → browser home.
- `search.codequest` → QuestSearch home.
- `https://gigboard.codequest/jobs` → GigBoard jobs.
- `python freelance jobs` → `search.codequest?q=python+freelance+jobs`.
- `unknown.example` → internal not-found page.

Any single token containing a dot is treated as an address; text containing
spaces, or a token without a dot, becomes a QuestSearch query. Enter submits the
omnibox. Ctrl+L focuses and selects the address bar only while the Browser window
is focused (`useWindows.focused === "browser"`).

## 5. QuestSearch behavior

`search.codequest` renders a light, Google-inspired search experience without
copying Google branding:

- Centered QuestSearch wordmark and large rounded search bar.
- Suggested searches: freelance programming jobs, beginner Python jobs, how to
  earn money online, Python tutorials, and remote freelance work.
- Deterministic local results with title, display URL, description, and a
  clickable in-app result.
- No-results state with suggestions.
- Result counts and a compact results header with its own search form.

The index in `data/searchIndex.ts` contains the supported pages only, so every
result navigates to a real internal route (GigBoard home, job listings, the café
detail page, browser home, or QuestSearch). Ranking gives title matches weight 6,
keyword matches weight 4, and description matches weight 1, then breaks ties by
index order.

## 6. GigBoard pages and job data

`data/gigboardJobs.ts` defines seven fictional projects: Build a Café Order
Calculator (Alex Morgan, $50, Beginner), Rename Files with Python (Priya Shah,
$80, Beginner), Build a Personal Portfolio (Daniel Reeves, $120, Intermediate),
CSV Data Cleaner (Mei Lin, $150, Intermediate), Simple Expense Tracker (Jordan
Blake, $100, Beginner), Website Contact Form (Sofia Alvarez, $90, Beginner), and
Automate Spreadsheet Reports (Marcus Cole, $200, Intermediate). Each job has an
ID, slug, title, client, budget, difficulty, category, skills, description,
deliverables, posted label, and job type. The café budget reuses
`CHAPTER1_PAYMENT_REWARD`; it does not duplicate or mutate quest progress.

`gigboard.codequest` is the marketplace home with header navigation, hero search,
category chips, featured jobs, and marketplace stats.
`gigboard.codequest/jobs` is the full listings page. Job cards show category,
budget, client, posted time, description, skills, difficulty, and a View Details
action.

`gigboard.codequest/jobs/<slug>` renders the details page with full description,
required skills, deliverables, budget sidebar, client metadata, and a
**Back to job listings** action. Unknown slugs fall back to the not-found page.

## 7. Search and filter implementation

`filterGigboardJobs` is a pure helper that applies:

- A case-insensitive query against title, client, and skills.
- Category matching.
- Difficulty matching.

The jobs page keeps filters in local React state, updates results immediately,
shows a live result count, and provides a Clear Filters action. An empty-results
state appears when nothing matches. The marketplace home search and category
chips navigate to `gigboard.codequest/jobs` with `q`, `category`, or `difficulty`
query parameters, which seed the jobs page filters.

## 8. Browser history behavior

History is still a `{ entries, index }` object with pure helpers:

- Navigate appends after the current index and discards forward history.
- Back and Forward move the index without changing the entry list.
- Refresh remounts the active page without changing history.
- Home navigates to `home.codequest` through normal navigation.
- Search queries, job filters, and job detail slugs are stored as normal history
  entries, so Back and Forward restore previous search results and listings.

Bookmarks are session-local and default to QuestSearch and GigBoard. The star
button adds or removes the current address; the Bookmarks dropdown lists saved
pages and allows removal. Bookmarks remain in the browser component only.

## 9. Testing results

`BrowserApp.test.tsx` contains 20 focused tests covering:

- Home rendering; tab open, switch, close, and last-tab replacement.
- Independent per-tab history.
- Address normalization and Enter navigation.
- Omnibox keyword search, encoding, QuestSearch home, suggestions, results,
  ranking, and no-results behavior.
- Search-result navigation with Back/Forward preservation.
- GigBoard listings, search, category/difficulty filters, and empty state.
- Job detail navigation, direct addresses, and GigBoard Back/Forward.
- Bookmarks, browser menu actions, Ctrl+L focus, and unknown-address fallback.
- No Chapter 1 progress mutation and registry/window-manager integration.

Results:

- Focused Browser tests: **20/20 passed**.
- Full suite: **85/85 tests across 8 files passed**.
- `npm run build`: **succeeded**.
- ESLint on `src/features/browser`: **clean**.

Four pre-existing TypeScript errors remain in unrelated files; no new browser
TypeScript errors were introduced.

## 10. Manual verification

1. Run `npm run dev`, open Pixel OS, launch **Browser**, and test opening,
   switching, and closing tabs.
2. Enter `gigboard.codequest`, `https://gigboard.codequest/jobs`, and
   `unknown.example`; confirm normalization, routing, and fallback.
3. Search `freelance Python jobs`, click a result, then use Back and Forward.
4. Press Ctrl+L while the browser is focused and confirm address selection.
5. On `gigboard.codequest/jobs`, search and filter by category/difficulty, then
   clear filters and verify the empty state.
6. Open the café job, confirm details and the disabled Apply action, then return.
7. Test bookmarks, the three-dot menu, window controls, and open the Godot game
   plus another app to confirm no integration regressions.

## 11. Known limitations

- Search covers the local index only; there is no external web or real engine.
- Bookmarks, tabs, and filter selections are session-local and not persisted.
- Job filters are local React state; the address bar only reflects initial query
  parameters after navigating from the marketplace home.
- QuestSearch has no academy/content pages yet; learning results link to the
  supported CodeQuest browser pages.
- GigBoard applications are intentionally disabled; no messages, contracts,
  payments, wallets, or quest completions exist.
- The browser is a React simulation, not a real browser engine or iframe.

## 12. Recommended next step

Implement the real GigBoard application workflow in Stage B, Step 5: allow the
player to apply for the café project, capture a short proposal, and connect the
accepted application to the existing Chapter 1 quest manager through its normal
progression API. Persist applications and bookmarks only after that workflow is
defined, and keep all browsing network-free.

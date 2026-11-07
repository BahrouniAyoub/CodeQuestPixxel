/**
 * Internal routing for the simulated CodeQuest browser.
 *
 * Everything here is pure and network-free so the navigation model can be
 * reused by future in-game websites and covered with focused tests.
 */

export const BROWSER_HOME_ADDRESS = "home.codequest";
export const GIGBOARD_ADDRESS = "gigboard.codequest";
export const GIGBOARD_JOBS_ADDRESS = `${GIGBOARD_ADDRESS}/jobs`;
export const SEARCH_ADDRESS = "search.codequest";

export type BrowserPageKind =
  "home" | "gigboard" | "gigboard-jobs" | "gigboard-job" | "search" | "not-found";

export interface ResolvedBrowserAddress {
  readonly address: string;
  readonly page: BrowserPageKind;
  readonly title: string;
  /** Decoded `?q=` search/filter text, or an empty string. */
  readonly query: string;
  readonly params: Readonly<Record<string, string>>;
  readonly jobSlug: string | null;
}

const JOB_DETAIL_PATTERN = /^gigboard\.codequest\/jobs\/([a-z0-9-]+)$/;

function parseQueryString(queryString: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(queryString));
}

/**
 * Normalize a user-entered address:
 * - trim surrounding whitespace
 * - accept an optional http(s):// prefix
 * - lowercase the host and path
 * - drop trailing slashes
 * - re-encode the query string while preserving search text casing
 */
export function normalizeBrowserAddress(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const withoutScheme = trimmed.replace(/^https?:\/\//i, "");
  const queryIndex = withoutScheme.indexOf("?");
  const rawPath = queryIndex === -1 ? withoutScheme : withoutScheme.slice(0, queryIndex);
  const rawQuery = queryIndex === -1 ? "" : withoutScheme.slice(queryIndex + 1);
  const path = rawPath.toLowerCase().replace(/\/+$/, "");
  if (!rawQuery) return path;
  const params = new URLSearchParams(rawQuery);
  const q = params.get("q");
  if (q !== null) params.set("q", q.trim());
  return `${path}?${params.toString()}`;
}

export function buildSearchAddress(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return SEARCH_ADDRESS;
  return `${SEARCH_ADDRESS}?${new URLSearchParams({ q: trimmed }).toString()}`;
}

export function buildGigBoardJobsAddress(
  filters: { query?: string; category?: string; difficulty?: string } = {},
): string {
  const params = new URLSearchParams();
  if (filters.query?.trim()) params.set("q", filters.query.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  const queryString = params.toString();
  return queryString ? `${GIGBOARD_JOBS_ADDRESS}?${queryString}` : GIGBOARD_JOBS_ADDRESS;
}

export function buildGigBoardJobAddress(slug: string): string {
  return `${GIGBOARD_JOBS_ADDRESS}/${slug}`;
}

/**
 * Chrome-style omnibox behavior: a single token containing a dot is treated as
 * a website address; everything else becomes a QuestSearch query.
 */
export function resolveOmniboxInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return BROWSER_HOME_ADDRESS;
  const withoutScheme = trimmed.replace(/^https?:\/\//i, "");
  const host = withoutScheme.split(/[/?#]/, 1)[0] ?? "";
  const looksLikeAddress = !/\s/.test(trimmed) && host.includes(".");
  return looksLikeAddress ? normalizeBrowserAddress(trimmed) : buildSearchAddress(trimmed);
}

export function resolveBrowserAddress(input: string): ResolvedBrowserAddress {
  const address = normalizeBrowserAddress(input);
  if (!address) return resolveBrowserAddress(BROWSER_HOME_ADDRESS);

  const queryIndex = address.indexOf("?");
  const path = queryIndex === -1 ? address : address.slice(0, queryIndex);
  const params = parseQueryString(queryIndex === -1 ? "" : address.slice(queryIndex + 1));
  const query = params["q"]?.trim() ?? "";
  const base = { address, query, params, jobSlug: null } as const;

  if (path === BROWSER_HOME_ADDRESS) {
    return { ...base, page: "home", title: "CodeQuest Browser" };
  }
  if (path === SEARCH_ADDRESS) {
    return {
      ...base,
      page: "search",
      title: query ? `QuestSearch — ${query}` : "QuestSearch",
    };
  }
  if (path === GIGBOARD_ADDRESS) {
    return { ...base, page: "gigboard", title: "GigBoard" };
  }
  if (path === GIGBOARD_JOBS_ADDRESS) {
    return { ...base, page: "gigboard-jobs", title: "GigBoard Jobs" };
  }
  const jobMatch = JOB_DETAIL_PATTERN.exec(path);
  if (jobMatch) {
    return { ...base, page: "gigboard-job", title: "GigBoard Job", jobSlug: jobMatch[1] ?? null };
  }
  return { ...base, page: "not-found", title: "Website not found" };
}

export interface BrowserHistory {
  readonly entries: readonly string[];
  readonly index: number;
}

export function createBrowserHistory(input: string = BROWSER_HOME_ADDRESS): BrowserHistory {
  const address = resolveOmniboxInput(input) || BROWSER_HOME_ADDRESS;
  return { entries: [address], index: 0 };
}

export function currentBrowserAddress(history: BrowserHistory): string {
  return history.entries[history.index] ?? BROWSER_HOME_ADDRESS;
}

/** Visit a page, discarding any forward history. */
export function navigateBrowserHistory(history: BrowserHistory, input: string): BrowserHistory {
  const address = resolveOmniboxInput(input) || BROWSER_HOME_ADDRESS;
  if (address === currentBrowserAddress(history)) return history;
  const entries = [...history.entries.slice(0, history.index + 1), address];
  return { entries, index: entries.length - 1 };
}

export function backBrowserHistory(history: BrowserHistory): BrowserHistory {
  return history.index <= 0 ? history : { ...history, index: history.index - 1 };
}

export function forwardBrowserHistory(history: BrowserHistory): BrowserHistory {
  return history.index >= history.entries.length - 1
    ? history
    : { ...history, index: history.index + 1 };
}

export function canGoBack(history: BrowserHistory): boolean {
  return history.index > 0;
}

export function canGoForward(history: BrowserHistory): boolean {
  return history.index < history.entries.length - 1;
}

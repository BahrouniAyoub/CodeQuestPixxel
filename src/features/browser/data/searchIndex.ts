import {
  BROWSER_HOME_ADDRESS,
  GIGBOARD_ADDRESS,
  GIGBOARD_JOBS_ADDRESS,
  SEARCH_ADDRESS,
  buildGigBoardJobAddress,
  buildGigBoardJobsAddress,
} from "../browserRoutes";

export const QUEST_SEARCH_SUGGESTIONS = [
  "Freelance programming jobs",
  "Beginner Python jobs",
  "How to earn money online",
  "Python tutorials",
  "Remote freelance work",
] as const;

export interface SearchIndexEntry {
  readonly title: string;
  readonly url: string;
  readonly displayUrl: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

export const QUEST_SEARCH_INDEX: readonly SearchIndexEntry[] = [
  {
    title: "GigBoard — Find Freelance Programming Jobs",
    url: GIGBOARD_JOBS_ADDRESS,
    displayUrl: "gigboard.codequest/jobs",
    description:
      "Browse beginner-friendly freelance programming and Python projects from local clients on GigBoard. Filter by skill, difficulty, and budget.",
    keywords: [
      "gigboard",
      "freelance",
      "programming",
      "jobs",
      "python",
      "gig",
      "work",
      "remote",
      "marketplace",
      "hire",
    ],
  },
  {
    title: "Build a Café Order Calculator — GigBoard",
    url: buildGigBoardJobAddress("cafe-calculator"),
    displayUrl: "gigboard.codequest/jobs/cafe-calculator",
    description:
      "A beginner Python project for Alex Morgan. Practise variables, arithmetic, and conditionals while building a café order calculator.",
    keywords: [
      "cafe",
      "calculator",
      "order",
      "python",
      "beginner",
      "job",
      "freelance",
      "alex",
      "morgan",
      "discount",
      "project",
    ],
  },
  {
    title: "Beginner Python Projects — GigBoard",
    url: buildGigBoardJobsAddress({ difficulty: "Beginner" }),
    displayUrl: "gigboard.codequest/jobs?difficulty=Beginner",
    description:
      "Start with small paid Python projects that build confidence. Compare beginner jobs, required skills, and fixed-price budgets.",
    keywords: [
      "beginner",
      "python",
      "projects",
      "tutorial",
      "tutorials",
      "practice",
      "jobs",
      "learning",
    ],
  },
  {
    title: "Python Tutorials for Beginners — CodeQuest",
    url: BROWSER_HOME_ADDRESS,
    displayUrl: "home.codequest",
    description:
      "Explore CodeQuest learning links and practise Python through the in-game browser, editor, and beginner freelance projects.",
    keywords: ["python", "tutorials", "learn", "beginner", "codequest", "practice", "guide"],
  },
  {
    title: "Remote Freelance Work — GigBoard",
    url: GIGBOARD_ADDRESS,
    displayUrl: "gigboard.codequest",
    description:
      "Find remote freelance work with local clients. GigBoard lists realistic fixed-price projects for new and intermediate developers.",
    keywords: ["remote", "freelance", "work", "online", "earn", "money", "jobs", "clients"],
  },
  {
    title: "How to Earn Money Online — GigBoard Guide",
    url: GIGBOARD_ADDRESS,
    displayUrl: "gigboard.codequest",
    description:
      "A practical guide to earning your first paycheck online: choose a beginner project, agree on a budget, and deliver clean work.",
    keywords: ["earn", "money", "online", "freelance", "beginner", "paycheck", "guide"],
  },
  {
    title: "CodeQuest Browser Home",
    url: BROWSER_HOME_ADDRESS,
    displayUrl: "home.codequest",
    description:
      "The starting point for the CodeQuest internal network, with shortcuts to GigBoard and QuestSearch.",
    keywords: ["codequest", "browser", "home", "portal", "start", "network"],
  },
  {
    title: "QuestSearch — Search the CodeQuest Network",
    url: SEARCH_ADDRESS,
    displayUrl: "search.codequest",
    description:
      "Search fictional CodeQuest websites, freelance projects, and learning resources without leaving Pixel OS.",
    keywords: ["search", "questsearch", "engine", "find", "web", "codequest"],
  },
];

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Deterministic local keyword search. Title matches rank above keyword matches,
 * which rank above description matches.
 */
export function searchQuestSearch(query: string): readonly SearchIndexEntry[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  return QUEST_SEARCH_INDEX.map((entry, order) => {
    const title = entry.title.toLowerCase();
    const keywords = entry.keywords.join(" ").toLowerCase();
    const description = entry.description.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) score += 6;
      if (keywords.includes(token)) score += 4;
      if (description.includes(token)) score += 1;
    }
    return { entry, order, score };
  })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((result) => result.entry);
}

import { CHAPTER1_PAYMENT_REWARD } from "@/features/chapter1/chapter1Quests";

export const GIGBOARD_CATEGORIES = [
  "Python Development",
  "Web Development",
  "Automation",
  "Data Analysis",
  "Beginner Projects",
] as const;

export const GIGBOARD_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;

/** The only GigBoard listing that participates in the Chapter 1 story. */
export const CAFE_CALCULATOR_JOB_ID = "GB-1042";
export const CAFE_CALCULATOR_JOB_SLUG = "cafe-calculator";

export type GigboardCategory = (typeof GIGBOARD_CATEGORIES)[number];
export type GigboardDifficulty = (typeof GIGBOARD_DIFFICULTIES)[number];

export interface GigboardJob {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly client: string;
  readonly budget: number;
  readonly difficulty: GigboardDifficulty;
  readonly category: GigboardCategory;
  readonly skills: readonly string[];
  readonly description: string;
  readonly deliverables: readonly string[];
  readonly posted: string;
  readonly type: string;
  /** True only for the Chapter 1 café project preview. */
  readonly chapter1Project: boolean;
}

export const GIGBOARD_JOBS: readonly GigboardJob[] = [
  {
    id: CAFE_CALCULATOR_JOB_ID,
    slug: CAFE_CALCULATOR_JOB_SLUG,
    title: "Build a Café Order Calculator",
    client: "Alex Morgan",
    budget: CHAPTER1_PAYMENT_REWARD,
    difficulty: "Beginner",
    category: "Python Development",
    skills: ["Python", "Variables", "Arithmetic", "Conditionals"],
    description:
      "Build a simple Python program that calculates café orders and applies discounts. The café owner needs a clear console receipt for each order so staff can check totals quickly.",
    deliverables: [
      "A runnable Python script",
      "Order subtotal, discount, and final total output",
      "A short README with usage examples",
    ],
    posted: "Posted 2 hours ago",
    type: "Fixed price",
    chapter1Project: true,
  },
];

export interface GigboardJobFilters {
  readonly query: string;
  readonly category: string;
  readonly difficulty: string;
}

export const EMPTY_GIGBOARD_FILTERS: GigboardJobFilters = {
  query: "",
  category: "",
  difficulty: "",
};

export function filterGigboardJobs(
  jobs: readonly GigboardJob[],
  filters: GigboardJobFilters,
): readonly GigboardJob[] {
  const query = filters.query.trim().toLowerCase();
  return jobs.filter((job) => {
    if (filters.category && job.category !== filters.category) return false;
    if (filters.difficulty && job.difficulty !== filters.difficulty) return false;
    if (!query) return true;
    const searchable = [job.title, job.client, ...job.skills].join(" ").toLowerCase();
    return searchable.includes(query);
  });
}

export function findGigboardJobBySlug(slug: string | null): GigboardJob | null {
  if (!slug) return null;
  return GIGBOARD_JOBS.find((job) => job.slug === slug) ?? null;
}

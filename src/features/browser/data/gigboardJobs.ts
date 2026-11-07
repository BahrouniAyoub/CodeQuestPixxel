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
  {
    id: "GB-1038",
    slug: "rename-files-python",
    title: "Rename Files with Python",
    client: "Priya Shah",
    budget: 80,
    difficulty: "Beginner",
    category: "Automation",
    skills: ["Python", "File Handling", "OS Module"],
    description:
      "Create a small script that renames batches of image and document files using a consistent naming pattern provided by the client.",
    deliverables: [
      "Reusable rename script",
      "Dry-run mode that previews changes",
      "Usage instructions",
    ],
    posted: "Posted 5 hours ago",
    type: "Fixed price",
    chapter1Project: false,
  },
  {
    id: "GB-1031",
    slug: "personal-portfolio",
    title: "Build a Personal Portfolio",
    client: "Daniel Reeves",
    budget: 120,
    difficulty: "Intermediate",
    category: "Web Development",
    skills: ["HTML", "CSS", "JavaScript", "Responsive Design"],
    description:
      "Design and build a clean one-page portfolio for a freelance photographer, including an about section, project gallery, and contact details.",
    deliverables: [
      "Responsive one-page website",
      "Gallery with placeholder images",
      "Deployment notes",
    ],
    posted: "Posted 1 day ago",
    type: "Fixed price",
    chapter1Project: false,
  },
  {
    id: "GB-1026",
    slug: "csv-data-cleaner",
    title: "CSV Data Cleaner",
    client: "Mei Lin",
    budget: 150,
    difficulty: "Intermediate",
    category: "Data Analysis",
    skills: ["Python", "Pandas", "CSV"],
    description:
      "Write a Python tool that removes duplicate rows, normalizes dates, and flags missing values in weekly sales exports.",
    deliverables: [
      "Cleaning script with configurable columns",
      "Before/after summary report",
      "Sample input and output files",
    ],
    posted: "Posted 2 days ago",
    type: "Fixed price",
    chapter1Project: false,
  },
  {
    id: "GB-1020",
    slug: "expense-tracker",
    title: "Simple Expense Tracker",
    client: "Jordan Blake",
    budget: 100,
    difficulty: "Beginner",
    category: "Beginner Projects",
    skills: ["Python", "Lists", "Functions"],
    description:
      "Build a console expense tracker that lets a small team add expenses, list totals by category, and save data between runs.",
    deliverables: [
      "Command-line expense tracker",
      "Category totals report",
      "JSON save file support",
    ],
    posted: "Posted 3 days ago",
    type: "Fixed price",
    chapter1Project: false,
  },
  {
    id: "GB-1014",
    slug: "website-contact-form",
    title: "Website Contact Form",
    client: "Sofia Alvarez",
    budget: 90,
    difficulty: "Beginner",
    category: "Web Development",
    skills: ["HTML", "CSS", "JavaScript", "Forms"],
    description:
      "Add a validated contact form to a small business website with clear error messages and a non-networked success preview.",
    deliverables: ["Accessible form markup", "Client-side validation", "Style guide notes"],
    posted: "Posted 4 days ago",
    type: "Fixed price",
    chapter1Project: false,
  },
  {
    id: "GB-1009",
    slug: "spreadsheet-reports",
    title: "Automate Spreadsheet Reports",
    client: "Marcus Cole",
    budget: 200,
    difficulty: "Intermediate",
    category: "Automation",
    skills: ["Python", "openpyxl", "Excel"],
    description:
      "Automate a weekly Excel report by combining source spreadsheets, calculating totals, and formatting a summary sheet.",
    deliverables: [
      "Report automation script",
      "Formatted Excel summary",
      "Scheduling instructions",
    ],
    posted: "Posted 5 days ago",
    type: "Fixed price",
    chapter1Project: false,
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

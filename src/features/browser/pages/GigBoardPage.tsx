import { useState, type FormEvent } from "react";
import { Briefcase, Filter, Search, Star, Users } from "lucide-react";
import {
  EMPTY_GIGBOARD_FILTERS,
  GIGBOARD_CATEGORIES,
  GIGBOARD_DIFFICULTIES,
  GIGBOARD_JOBS,
  filterGigboardJobs,
  type GigboardJob,
  type GigboardJobFilters,
} from "../data/gigboardJobs";
import {
  GIGBOARD_ADDRESS,
  GIGBOARD_JOBS_ADDRESS,
  buildGigBoardJobAddress,
  buildGigBoardJobsAddress,
} from "../browserRoutes";

interface GigBoardPageProps {
  view: "home" | "jobs";
  query: string;
  category: string;
  difficulty: string;
  onNavigate: (address: string) => void;
}

export function GigBoardHeader({
  onNavigate,
  active,
}: {
  onNavigate: (address: string) => void;
  active: "home" | "jobs";
}) {
  return (
    <header className="cq-gb-header">
      <button
        type="button"
        className="cq-gb-brand"
        onClick={() => onNavigate(GIGBOARD_ADDRESS)}
        aria-label="GigBoard home"
      >
        <span className="cq-gb-brand-mark" aria-hidden="true">
          GB
        </span>
        <span>
          <strong>GigBoard</strong>
          <small>Freelance, made local</small>
        </span>
      </button>
      <nav className="cq-gb-nav" aria-label="GigBoard navigation">
        <button
          type="button"
          className={active === "home" ? "cq-gb-nav-active" : ""}
          onClick={() => onNavigate(GIGBOARD_ADDRESS)}
        >
          Home
        </button>
        <button
          type="button"
          className={active === "jobs" ? "cq-gb-nav-active" : ""}
          onClick={() => onNavigate(GIGBOARD_JOBS_ADDRESS)}
        >
          Browse jobs
        </button>
      </nav>
      <span className="cq-gb-post-note">Post a job — coming soon</span>
    </header>
  );
}

function JobCard({ job, onNavigate }: { job: GigboardJob; onNavigate: (address: string) => void }) {
  return (
    <article className="cq-gb-job">
      <div className="cq-gb-job-top">
        <span className="cq-gb-chip">{job.category}</span>
        <span className="cq-gb-budget">${job.budget}</span>
      </div>
      <h3>{job.title}</h3>
      <p className="cq-gb-job-client">
        <Users size={13} aria-hidden="true" /> {job.client} · {job.posted}
      </p>
      <p className="cq-gb-job-desc">{job.description}</p>
      <ul className="cq-gb-skills" aria-label={`Skills for ${job.title}`}>
        {job.skills.map((skill) => (
          <li key={skill}>{skill}</li>
        ))}
      </ul>
      <div className="cq-gb-job-footer">
        <span className={`cq-gb-level cq-gb-level-${job.difficulty.toLowerCase()}`}>
          {job.difficulty}
        </span>
        <span className="cq-gb-type">{job.type}</span>
        <button
          type="button"
          className="cq-gb-details"
          aria-label={`View details for ${job.title}`}
          onClick={() => onNavigate(buildGigBoardJobAddress(job.slug))}
        >
          View details
        </button>
      </div>
    </article>
  );
}

function JobGrid({
  jobs,
  onNavigate,
}: {
  jobs: readonly GigboardJob[];
  onNavigate: (address: string) => void;
}) {
  return (
    <div className="cq-gb-job-grid">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export function GigBoardPage({ view, query, category, difficulty, onNavigate }: GigBoardPageProps) {
  const [filters, setFilters] = useState<GigboardJobFilters>({ query, category, difficulty });
  const [homeQuery, setHomeQuery] = useState("");

  const handleHomeSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onNavigate(buildGigBoardJobsAddress({ query: homeQuery }));
  };

  const updateFilters = (next: Partial<GigboardJobFilters>) =>
    setFilters((current) => ({ ...current, ...next }));

  const clearFilters = () => setFilters(EMPTY_GIGBOARD_FILTERS);

  if (view === "home") {
    return (
      <div className="cq-gb">
        <GigBoardHeader onNavigate={onNavigate} active="home" />
        <main>
          <section className="cq-gb-hero">
            <div className="cq-gb-hero-copy">
              <span className="cq-gb-eyebrow">
                <Star size={13} aria-hidden="true" /> TRUSTED BY LOCAL CLIENTS
              </span>
              <h1>Find work that fits your skills.</h1>
              <p>
                Browse fixed-price freelance projects from real-feeling local clients. Start small,
                build a portfolio, and earn your first paycheck.
              </p>
            </div>
            <form className="cq-gb-hero-search" role="search" onSubmit={handleHomeSearch}>
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="Search jobs"
                value={homeQuery}
                onChange={(event) => setHomeQuery(event.target.value)}
                placeholder="Search jobs by title or skill"
                autoComplete="off"
              />
              <button type="submit">Search jobs</button>
            </form>
            <div className="cq-gb-category-row" aria-label="Job categories">
              {GIGBOARD_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onNavigate(buildGigBoardJobsAddress({ category: item }))}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="cq-gb-featured">
            <div className="cq-gb-section-head">
              <div>
                <h2>Featured jobs</h2>
                <p>Hand-picked projects that are perfect for building experience.</p>
              </div>
              <button type="button" onClick={() => onNavigate(GIGBOARD_JOBS_ADDRESS)}>
                Browse all jobs
              </button>
            </div>
            <JobGrid jobs={GIGBOARD_JOBS.slice(0, 3)} onNavigate={onNavigate} />
          </section>

          <section className="cq-gb-stats">
            <div>
              <strong>{GIGBOARD_JOBS.length}</strong>
              <span>Open projects</span>
            </div>
            <div>
              <strong>5</strong>
              <span>Job categories</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Beginner friendly</span>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const filtered = filterGigboardJobs(GIGBOARD_JOBS, filters);

  return (
    <div className="cq-gb">
      <GigBoardHeader onNavigate={onNavigate} active="jobs" />
      <main className="cq-gb-browse">
        <div className="cq-gb-browse-head">
          <h1>Browse freelance jobs</h1>
          <p>Filter by skill, category, or difficulty. Every listing is internal to CodeQuest.</p>
        </div>

        <form className="cq-gb-filters" onSubmit={(event) => event.preventDefault()}>
          <label className="cq-gb-filter-search">
            <span>
              <Search size={13} aria-hidden="true" /> Search jobs
            </span>
            <input
              aria-label="Search jobs"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              placeholder="Title, client, or skill"
            />
          </label>
          <label>
            <span>
              <Filter size={13} aria-hidden="true" /> Category
            </span>
            <select
              aria-label="Filter by category"
              value={filters.category}
              onChange={(event) => updateFilters({ category: event.target.value })}
            >
              <option value="">All categories</option>
              {GIGBOARD_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Difficulty</span>
            <select
              aria-label="Filter by difficulty"
              value={filters.difficulty}
              onChange={(event) => updateFilters({ difficulty: event.target.value })}
            >
              <option value="">All levels</option>
              {GIGBOARD_DIFFICULTIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="cq-gb-clear" onClick={clearFilters}>
            Clear filters
          </button>
        </form>

        <p className="cq-gb-count" role="status">
          {filtered.length} job{filtered.length === 1 ? "" : "s"} found
        </p>

        {filtered.length > 0 ? (
          <JobGrid jobs={filtered} onNavigate={onNavigate} />
        ) : (
          <div className="cq-gb-empty">
            <Briefcase size={34} aria-hidden="true" />
            <h2>No jobs match those filters</h2>
            <p>Try a different keyword or clear the filters to see every project.</p>
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

import { ArrowRight, Briefcase, Globe2, Search, ShieldCheck } from "lucide-react";
import { GIGBOARD_ADDRESS, SEARCH_ADDRESS } from "../browserRoutes";

interface BrowserHomePageProps {
  onNavigate: (address: string) => void;
}

export function BrowserHomePage({ onNavigate }: BrowserHomePageProps) {
  return (
    <div className="cq-bchp">
      <section className="cq-bchp-hero">
        <span className="cq-bchp-eyebrow">
          <ShieldCheck size={14} aria-hidden="true" /> CODEQUEST INTERNAL NETWORK
        </span>
        <h1>
          <Globe2 size={30} aria-hidden="true" /> CodeQuest Browser
        </h1>
        <p>
          A safe, simulated web for CodeQuest. Browse fictional client sites, search for work, and
          build your portfolio without leaving Pixel OS.
        </p>
      </section>

      <div className="cq-bchp-grid">
        <button
          type="button"
          className="cq-bchp-card cq-bchp-card-gig"
          onClick={() => onNavigate(GIGBOARD_ADDRESS)}
        >
          <span className="cq-bchp-card-icon">
            <Briefcase size={22} aria-hidden="true" />
          </span>
          <span className="cq-bchp-card-address">gigboard.codequest</span>
          <strong>GigBoard</strong>
          <small>Browse paid freelance projects for beginner developers.</small>
          <span className="cq-bchp-card-open">
            Visit GigBoard <ArrowRight size={14} aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          className="cq-bchp-card cq-bchp-card-search"
          onClick={() => onNavigate(SEARCH_ADDRESS)}
        >
          <span className="cq-bchp-card-icon">
            <Search size={22} aria-hidden="true" />
          </span>
          <span className="cq-bchp-card-address">search.codequest</span>
          <strong>QuestSearch</strong>
          <small>Search the CodeQuest network for jobs and learning resources.</small>
          <span className="cq-bchp-card-open">
            Open QuestSearch <ArrowRight size={14} aria-hidden="true" />
          </span>
        </button>
      </div>

      <section className="cq-bchp-tip">
        <strong>Pro tip</strong>
        <p>
          Type a site address or a search phrase into the bar above. Try{" "}
          <button type="button" onClick={() => onNavigate(GIGBOARD_ADDRESS)}>
            gigboard.codequest
          </button>{" "}
          or search for <em>freelance Python jobs</em>.
        </p>
      </section>

      <p className="cq-bchp-note">
        <ShieldCheck size={13} aria-hidden="true" /> Only CodeQuest internal sites are available in
        this build. No external network requests are made.
      </p>
    </div>
  );
}

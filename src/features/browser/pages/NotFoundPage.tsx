import { ArrowLeft, Compass, Home as HomeIcon, Search } from "lucide-react";
import { BROWSER_HOME_ADDRESS, SEARCH_ADDRESS } from "../browserRoutes";

interface NotFoundPageProps {
  address: string;
  onNavigate: (address: string) => void;
}

export function NotFoundPage({ address, onNavigate }: NotFoundPageProps) {
  return (
    <div className="cq-nfp">
      <div className="cq-nfp-art" aria-hidden="true">
        <Compass size={54} />
      </div>
      <div className="cq-nfp-code" aria-hidden="true">
        404
      </div>
      <h1>Website not found</h1>
      <p>
        The CodeQuest network could not find <code>{address}</code>. Check the address or search the
        internal network instead.
      </p>
      <div className="cq-nfp-actions">
        <button type="button" onClick={() => onNavigate(BROWSER_HOME_ADDRESS)}>
          <HomeIcon size={15} aria-hidden="true" /> Browser home
        </button>
        <button type="button" onClick={() => onNavigate(SEARCH_ADDRESS)}>
          <Search size={15} aria-hidden="true" /> Search QuestSearch
        </button>
      </div>
      <button type="button" className="cq-nfp-back" onClick={() => onNavigate(SEARCH_ADDRESS)}>
        <ArrowLeft size={14} aria-hidden="true" /> Try a different search
      </button>
    </div>
  );
}

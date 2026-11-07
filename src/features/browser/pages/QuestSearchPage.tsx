import { useEffect, useState, type FormEvent } from "react";
import { Search, Sparkles } from "lucide-react";
import { SEARCH_ADDRESS, buildSearchAddress } from "../browserRoutes";
import {
  QUEST_SEARCH_SUGGESTIONS,
  searchQuestSearch,
  type SearchIndexEntry,
} from "../data/searchIndex";

interface QuestSearchPageProps {
  query: string;
  onSearch: (query: string) => void;
  onNavigate: (address: string) => void;
}

function SearchForm({
  value,
  onChange,
  onSubmit,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  compact: boolean;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className={`cq-qs-form ${compact ? "cq-qs-form-compact" : ""}`}
      role="search"
      onSubmit={handleSubmit}
    >
      <Search size={compact ? 17 : 20} aria-hidden="true" />
      <input
        aria-label="Search QuestSearch"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search the CodeQuest network"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit">Search</button>
    </form>
  );
}

function Results({
  query,
  results,
  onNavigate,
}: {
  query: string;
  results: readonly SearchIndexEntry[];
  onNavigate: (address: string) => void;
}) {
  return (
    <div className="cq-qs-results-body">
      <h1 className="cq-qs-results-title">Search results</h1>
      <p className="cq-qs-stats">
        {results.length === 0
          ? "No results found"
          : `About ${results.length} result${results.length === 1 ? "" : "s"}`}{" "}
        for <strong>“{query}”</strong>
      </p>

      {results.length === 0 ? (
        <div className="cq-qs-empty">
          <Sparkles size={30} aria-hidden="true" />
          <h2>No pages matched that search</h2>
          <p>Try a broader phrase or choose one of the suggested searches below.</p>
          <div className="cq-qs-suggestions">
            {QUEST_SEARCH_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onNavigate(buildSearchAddress(suggestion))}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol className="cq-qs-result-list">
          {results.map((result) => (
            <li key={result.title}>
              <button type="button" className="cq-qs-result" onClick={() => onNavigate(result.url)}>
                <span className="cq-qs-result-url">{result.displayUrl}</span>
                <span className="cq-qs-result-title">{result.title}</span>
                <span className="cq-qs-result-description">{result.description}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function QuestSearchPage({ query, onSearch, onNavigate }: QuestSearchPageProps) {
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query]);

  const results = searchQuestSearch(query);

  if (!query) {
    return (
      <div className="cq-qs cq-qs-home">
        <h1 className="cq-qs-logo">
          <span>Q</span>uest<span className="cq-qs-logo-accent">Search</span>
        </h1>
        <p className="cq-qs-tagline">Search the CodeQuest network</p>
        <SearchForm
          value={input}
          onChange={setInput}
          onSubmit={() => onSearch(input)}
          compact={false}
        />
        <div className="cq-qs-suggestions cq-qs-home-suggestions">
          {QUEST_SEARCH_SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => onSearch(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        <p className="cq-qs-footnote">
          Local, deterministic results · No external network requests
        </p>
      </div>
    );
  }

  return (
    <div className="cq-qs cq-qs-results">
      <header className="cq-qs-results-header">
        <button
          type="button"
          className="cq-qs-small-logo"
          aria-label="QuestSearch home"
          onClick={() => onNavigate(SEARCH_ADDRESS)}
        >
          Quest<span>Search</span>
        </button>
        <SearchForm
          value={input}
          onChange={setInput}
          onSubmit={() => onSearch(input)}
          compact={true}
        />
      </header>
      <Results query={query} results={results} onNavigate={onNavigate} />
    </div>
  );
}

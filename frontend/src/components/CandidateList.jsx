import ContactCard from "./ContactCard.jsx";
import { formatDate } from "../utils.js";

export default function CandidateList({ search }) {
  const {
    status,
    candidates,
    visibleCandidates,
    error,
    searchedAt,
    savingName,
    runSearch,
    useCandidate,
    dismissCandidate,
  } = search;

  return (
    <>
      {error && <div className="alert">{error}</div>}

      {status === "idle" && (
        <div className="hint-box">
          No search yet. Use <strong>Find contact</strong> to look for the buyer at this
          gym.
        </div>
      )}

      {status === "loading" && (
        <div className="search-loading">
          <span className="spinner" aria-hidden="true" />
          <div>
            <strong>Searching the web…</strong>
            <p className="sub">
              Reading the gym's site, Google listing and social profiles. This can take up
              to a minute.
            </p>
          </div>
        </div>
      )}

      {status === "done" && (
        <>
          <div className="results-meta">
            <span>
              {visibleCandidates.length} of {candidates.length} candidate
              {candidates.length === 1 ? "" : "s"} shown
            </span>
            <div className="results-meta-right">
              {searchedAt && (
                <span className="sub">Searched {formatDate(searchedAt)}</span>
              )}
              <button className="btn btn-secondary btn-sm" onClick={runSearch}>
                Re-run search
              </button>
            </div>
          </div>

          {visibleCandidates.length === 0 ? (
            <div className="empty">
              No contact found. Try a re-run, or add the gym's general inbox by hand.
            </div>
          ) : (
            <div className="candidate-list">
              {visibleCandidates.map((candidate) => (
                <ContactCard
                  key={`${candidate.name}-${candidate.role || ""}`}
                  candidate={candidate}
                  busy={savingName === candidate.name}
                  onUse={() => useCandidate(candidate)}
                  onDismiss={() => dismissCandidate(candidate)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {status === "error" && (
        <div className="results-meta">
          <span>Search failed</span>
          <button className="btn btn-secondary btn-sm" onClick={runSearch}>
            Re-run search
          </button>
        </div>
      )}
    </>
  );
}

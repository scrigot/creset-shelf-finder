import { useEffect, useState } from "react";

import { fetchProspect } from "../api";
import useContactSearch from "../hooks/useContactSearch";

const STATUS_LABEL = {
  verified: "Verified email",
  listed_publicly: "Email listed publicly",
  guessed: "Pattern guess",
  none: "No email found",
};

const CONFIDENCE_LABEL = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

function isReachable(status) {
  return status === "verified" || status === "listed_publicly";
}

function CandidateCard({ candidate, busy, onUse, onDismiss }) {
  const { name, role, email, email_status, confidence, reasoning, source_url } = candidate;

  return (
    <article className="candidate">
      <div className="candidate-head">
        <div>
          <b className="candidate-name">{name}</b>
          <span className="candidate-role">{role || "Role unknown"}</span>
        </div>
        <span className={`chip confidence-${confidence}`}>{CONFIDENCE_LABEL[confidence]}</span>
      </div>

      <div className="candidate-email">
        <span className={email ? "email-value" : "email-value empty"}>
          {email || "No email published"}
        </span>
        <span className={`status-chip status-${isReachable(email_status) ? "ok" : email_status === "guessed" ? "warn" : "none"}`}>
          {STATUS_LABEL[email_status] ?? email_status}
        </span>
      </div>

      {reasoning && <p className="candidate-reasoning">{reasoning}</p>}

      <div className="candidate-meta">
        {source_url ? (
          <a href={source_url} target="_blank" rel="noreferrer">
            Source ↗
          </a>
        ) : (
          <span className="muted">No source link</span>
        )}
        {candidate.linkedin_url && (
          <a href={candidate.linkedin_url} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        )}
        {candidate.instagram && <span>{candidate.instagram}</span>}
        {candidate.phone && <span>{candidate.phone}</span>}
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={onUse} disabled={busy}>
          {busy ? "Saving…" : "Use this contact"}
        </button>
        <button type="button" className="btn ghost" onClick={onDismiss} disabled={busy}>
          Not right
        </button>
      </div>
    </article>
  );
}

/**
 * Contact search for one prospect: the people already on file, Find contact, and
 * the candidates it returns.
 */
export default function ContactsPanel({ prospectId, contacts = [], onSaved, compact = false }) {
  const [saved, setSaved] = useState(contacts);

  useEffect(() => {
    setSaved(contacts);
  }, [contacts]);

  const search = useContactSearch(prospectId, {
    onContactSaved: async () => {
      const fresh = await fetchProspect(prospectId).catch(() => null);
      if (fresh) setSaved(fresh.contacts || []);
      if (onSaved) await onSaved();
    },
  });

  const { status, candidates, visibleCandidates, error, savingName, runSearch, useCandidate, dismissCandidate } =
    search;

  return (
    <div className={`contacts ${compact ? "compact" : ""}`}>
      <div className="contacts-head">
        <span className="muted">
          {saved.length === 0
            ? "No contact on file."
            : `${saved.length} contact${saved.length === 1 ? "" : "s"} on file`}
        </span>
        <button
          type="button"
          className="btn"
          onClick={runSearch}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Searching…" : saved.length ? "Find another contact" : "Find contact"}
        </button>
      </div>

      {saved.length > 0 && (
        <ul className="saved-contacts">
          {saved.map((contact) => (
            <li key={contact.id} className={contact.is_primary ? "is-primary" : ""}>
              <div className="saved-line">
                <b>{contact.name}</b>
                <span className="saved-role">{contact.role || "Role unknown"}</span>
                {contact.is_primary && <span className="chip">Primary</span>}
              </div>
              <div className="candidate-email">
                <span className={contact.email ? "email-value" : "email-value empty"}>
                  {contact.email || "No email published"}
                </span>
                <span
                  className={`status-chip status-${
                    isReachable(contact.email_status)
                      ? "ok"
                      : contact.email_status === "guessed"
                        ? "warn"
                        : "none"
                  }`}
                >
                  {STATUS_LABEL[contact.email_status] ?? contact.email_status}
                </span>
                {contact.source_url && (
                  <a href={contact.source_url} target="_blank" rel="noreferrer">
                    Source ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error inline">{error}</p>}

      {status === "idle" && saved.length === 0 && (
        <p className="muted">
          Find contact searches the gym's site, Google listing, Instagram and LinkedIn for the
          person who decides what the gym stocks.
        </p>
      )}

      {status === "loading" && (
        <p className="search-loading">
          Searching the web… this reads the gym's site and listings and can take up to a minute.
        </p>
      )}

      {status === "done" && (
        <div className="candidate-list">
          {visibleCandidates.length === 0 ? (
            <p className="muted">
              No contact found. Re-run the search, or look the gym up by hand.
            </p>
          ) : (
            visibleCandidates.map((candidate) => (
              <CandidateCard
                key={`${candidate.name}-${candidate.role || ""}`}
                candidate={candidate}
                busy={savingName === candidate.name}
                onUse={() => useCandidate(candidate)}
                onDismiss={() => dismissCandidate(candidate)}
              />
            ))
          )}
          {candidates.length > 0 && (
            <button type="button" className="btn ghost" onClick={runSearch}>
              Re-run search
            </button>
          )}
        </div>
      )}
    </div>
  );
}

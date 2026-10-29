import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getProspect } from "../api.js";
import CandidateList from "../components/CandidateList.jsx";
import DraftOutreachDialog from "../components/DraftOutreachDialog.jsx";
import { EmailStatusBadge } from "../components/Badge.jsx";
import useContactSearch from "../hooks/useContactSearch.js";
import { gymTypeLabel, prettyHost } from "../utils.js";

export default function ProspectDetailPage() {
  const { id } = useParams();

  const [prospect, setProspect] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);

  const load = useCallback(async () => {
    const data = await getProspect(id);
    setProspect(data);
  }, [id]);

  useEffect(() => {
    load().catch((err) => setLoadError(err.message));
  }, [load]);

  const handleContactSaved = useCallback(async () => {
    await load();
    setDraftOpen(true);
  }, [load]);

  const search = useContactSearch(id, { onContactSaved: handleContactSaved });

  if (loadError) {
    return (
      <div className="stack-lg">
        <Link to="/" className="back">
          ← All prospects
        </Link>
        <div className="alert">{loadError}</div>
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="stack-lg">
        <Link to="/" className="back">
          ← All prospects
        </Link>
        <div className="skeleton">Loading prospect…</div>
      </div>
    );
  }

  const primaryContact = prospect.contacts.find((contact) => contact.is_primary);

  return (
    <div className="stack-lg">
      <Link to="/" className="back">
        ← All prospects
      </Link>

      <header className="detail-head">
        <div className="detail-title">
          <p className="eyebrow">Prospect</p>
          <h1>{prospect.name}</h1>
          <div className="detail-meta">
            <span className="chip">{gymTypeLabel(prospect.gym_type)}</span>
            {prospect.address && <span>{prospect.address}</span>}
            {prospect.website && (
              <a href={prospect.website} target="_blank" rel="noreferrer">
                {prettyHost(prospect.website)}
              </a>
            )}
            {prospect.instagram && <span>{prospect.instagram}</span>}
          </div>
        </div>
        <div className="score-block">
          <span className="score-value big">{prospect.score}</span>
          <span className="sub">fit score</span>
        </div>
      </header>

      <div className="detail-actions">
        <button
          className="btn btn-primary"
          onClick={search.runSearch}
          disabled={search.status === "loading"}
        >
          {search.status === "loading" ? "Searching the web…" : "Find contact"}
        </button>
        <button className="btn btn-secondary" onClick={() => setDraftOpen(true)}>
          Draft outreach
        </button>
        <Link className="btn btn-secondary" to={`/outreach?prospect=${prospect.id}`}>
          Open in outreach
        </Link>
      </div>

      {search.usedName && (
        <div className="notice">
          Saved {search.usedName} as the primary contact — draft outreach is ready.
        </div>
      )}

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Contact search</h2>
              <p className="panel-sub">
                Looks at the gym's website, Google listing, Instagram, LinkedIn and local
                news for the person who decides what drinks and supplements get stocked.
              </p>
            </div>
          </div>

          <CandidateList search={search} />
        </section>

        <aside className="panel">
          <div className="panel-head">
            <div>
              <h2>Contacts on file</h2>
              <p className="panel-sub">
                {primaryContact
                  ? "The primary contact receives the outreach draft."
                  : "No primary contact yet."}
              </p>
            </div>
          </div>

          {prospect.contacts.length === 0 ? (
            <div className="empty">
              Nobody saved yet. Find contact adds people here once you pick one.
            </div>
          ) : (
            <ul className="saved-contacts">
              {prospect.contacts.map((contact) => (
                <li
                  key={contact.id}
                  className={contact.is_primary ? "saved-contact primary" : "saved-contact"}
                >
                  <div className="saved-contact-head">
                    <span className="contact-name">{contact.name}</span>
                    {contact.is_primary && <span className="pill-primary">Primary</span>}
                  </div>
                  <p className="sub">{contact.role || "Role unknown"}</p>
                  <div className="saved-contact-email">
                    <span className="email-value small">
                      {contact.email || "No email published"}
                    </span>
                    <EmailStatusBadge status={contact.email_status} />
                  </div>
                  {contact.source_url && (
                    <a
                      className="small-link"
                      href={contact.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <DraftOutreachDialog
        prospectId={id}
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
      />
    </div>
  );
}

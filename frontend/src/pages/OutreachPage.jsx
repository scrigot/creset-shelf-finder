import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getProspect, listProspects } from "../api.js";
import CandidateList from "../components/CandidateList.jsx";
import OutreachForm from "../components/OutreachForm.jsx";
import useContactSearch from "../hooks/useContactSearch.js";
import { emailStatusLabel, gymTypeLabel, isPublicEmail, prettyHost } from "../utils.js";

export default function OutreachPage() {
  const [searchParams] = useSearchParams();
  const requestedId = Number(searchParams.get("prospect")) || null;

  const [prospects, setProspects] = useState(null);
  const [selectedId, setSelectedId] = useState(requestedId);
  const [prospect, setProspect] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    listProspects()
      .then((rows) => {
        const safeRows = rows || [];
        setProspects(safeRows);
        setSelectedId((current) => current ?? safeRows[0]?.id ?? null);
      })
      .catch((err) => setError(err.message));
  }, [version]);

  useEffect(() => {
    if (!selectedId) {
      setProspect(null);
      return undefined;
    }
    let alive = true;
    setProspect(null);
    getProspect(selectedId)
      .then((data) => {
        if (alive) setProspect(data);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [selectedId, version]);

  useEffect(() => {
    if (requestedId) setSelectedId(requestedId);
  }, [requestedId]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const search = useContactSearch(selectedId, { onContactSaved: reload });

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <p className="eyebrow">Find &amp; outreach</p>
          <h1>Reach the people who stock the shelf</h1>
          <p className="lede">
            Pick a prospect, find its founder, owner or general manager, then write the
            email without leaving the page.
          </p>
        </div>
        {prospects && <span className="count-pill">{prospects.length} prospects</span>}
      </header>

      {error && <div className="alert">{error}</div>}

      <div className="outreach-layout">
        <aside className="panel picker">
          <div className="panel-head">
            <div>
              <h2>Prospects</h2>
              <p className="panel-sub">Ranked by fit. Pick one to work on.</p>
            </div>
          </div>

          {!prospects && <div className="skeleton">Loading prospects…</div>}

          <ul className="picker-list">
            {(prospects || []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === selectedId ? "picker-item active" : "picker-item"}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="picker-top">
                    <span className="picker-name">{item.name}</span>
                    <span className="picker-score">{item.score}</span>
                  </span>
                  <span className="picker-sub">
                    {item.primary_contact ? (
                      <>
                        {isPublicEmail(item.primary_contact.email_status) && (
                          <span className="dot dot-live" />
                        )}
                        {item.primary_contact.name}
                        {item.primary_contact.role ? ` · ${item.primary_contact.role}` : ""}
                      </>
                    ) : (
                      "No contact yet"
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="outreach-main">
          {!prospect ? (
            <div className="panel">
              <div className="skeleton">
                {selectedId
                  ? "Loading prospect…"
                  : "Choose a prospect to find someone to write to."}
              </div>
            </div>
          ) : (
            <>
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>{prospect.name}</h2>
                    <p className="panel-sub">
                      {gymTypeLabel(prospect.gym_type)}
                      {prospect.address ? ` · ${prospect.address}` : ""}
                      {prospect.website ? (
                        <>
                          {" · "}
                          <a
                            className="small-link"
                            href={prospect.website}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {prettyHost(prospect.website)}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="outreach-actions">
                    <button
                      className="btn btn-primary"
                      onClick={search.runSearch}
                      disabled={search.status === "loading"}
                    >
                      {search.status === "loading" ? "Searching the web…" : "Find contact"}
                    </button>
                    <Link
                      className="btn btn-secondary"
                      to={`/prospects/${prospect.id}`}
                    >
                      Open prospect
                    </Link>
                  </div>
                </div>

                {search.usedName && (
                  <div className="notice">
                    Saved {search.usedName} as the primary contact — the draft below is
                    addressed to them.
                  </div>
                )}

                <CandidateList search={search} />
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Outreach email</h2>
                    <p className="panel-sub">
                      {prospect.contacts.length > 0
                        ? `Addressed to ${
                            prospect.contacts.find((contact) => contact.is_primary)
                              ?.name || prospect.contacts[0].name
                          } by first name and role.`
                        : "No contact on file yet — the draft addresses the gym team."}
                    </p>
                  </div>
                </div>
                <OutreachForm prospectId={prospect.id} version={version} />
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Contacts on file</h2>
                    <p className="panel-sub">
                      Everyone saved for {prospect.name}. Use a card above to change the
                      primary.
                    </p>
                  </div>
                </div>

                {prospect.contacts.length === 0 ? (
                  <div className="empty">Nobody saved yet.</div>
                ) : (
                  <ul className="saved-contacts">
                    {prospect.contacts.map((contact) => (
                      <li
                        key={contact.id}
                        className={
                          contact.is_primary ? "saved-contact primary" : "saved-contact"
                        }
                      >
                        <div className="saved-contact-head">
                          <span className="contact-name">{contact.name}</span>
                          {contact.is_primary && (
                            <span className="pill-primary">Primary</span>
                          )}
                        </div>
                        <p className="sub">
                          {[contact.role || "Role unknown", emailStatusLabel(contact.email_status)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <div className="saved-contact-email">
                          <span className="email-value small">
                            {contact.email || "No email published"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

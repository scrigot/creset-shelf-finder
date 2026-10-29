import { useEffect, useState } from "react";

import { fetchProspect } from "../api";
import { TYPE_LABEL, formatMoney } from "../scoring";
import ContactsPanel from "./ContactsPanel";
import OutreachDraft from "./OutreachDraft";

function isReachable(contact) {
  return Boolean(contact) && (contact.email_status === "verified" || contact.email_status === "listed_publicly");
}

/**
 * Pick a prospect, find the person who decides what it stocks, and write the
 * outreach email — all on one screen.
 */
export default function OutreachWorkspace({ rows, onSelect, onChanged }) {
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? null);
  const [detail, setDetail] = useState(null);
  const [version, setVersion] = useState(0);

  // Keep the selection valid when the search filter changes the list.
  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!rows.some((row) => row.id === selectedId)) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetail(null);
    fetchProspect(selectedId)
      .then((data) => alive && setDetail(data))
      .catch(() => alive && setDetail(null));
    return () => {
      alive = false;
    };
  }, [selectedId, version]);

  const refresh = () => {
    setVersion((current) => current + 1);
    if (onChanged) onChanged();
  };

  const selected = rows.find((row) => row.id === selectedId) || null;

  return (
    <section className="outreach">
      <div className="view-head">
        <h1>Find &amp; outreach</h1>
        <p className="muted">
          Pick a prospect, find the owner or general manager who decides what goes on the
          shelf, then write the email without leaving the page.
        </p>
      </div>

      {rows.length === 0 && <p className="empty">No prospects match that filter.</p>}

      {rows.length > 0 && (
        <div className="outreach-grid">
          <div className="picker">
            <div className="picker-head">
              <span className="block-title">Prospects</span>
              <span className="muted">{rows.length}</span>
            </div>
            <div className="picker-list">
              {rows.map((row, index) => (
                <button
                  type="button"
                  key={row.id}
                  className={`picker-item ${row.id === selectedId ? "active" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className="picker-rank">{index + 1}</span>
                  <span className="picker-main">
                    <span className="picker-name">
                      {isReachable(row.primary_contact) && (
                        <span
                          className="contact-dot"
                          title="Email verified or listed publicly"
                        />
                      )}
                      {row.name}
                    </span>
                    <span className="picker-sub">
                      {row.primary_contact
                        ? `${row.primary_contact.name} · ${row.primary_contact.role || "role unknown"}`
                        : "No contact yet"}
                    </span>
                  </span>
                  <span className="picker-score num">{Math.round(row.score)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="outreach-main">
            {!selected && <p className="empty">Pick a prospect to start.</p>}

            {selected && (
              <>
                <div className="outreach-head">
                  <div>
                    <h2>{selected.name}</h2>
                    <p className="drawer-meta">
                      {TYPE_LABEL[selected.type] ?? selected.type} ·{" "}
                      {selected.members.toLocaleString()} members ·{" "}
                      {selected.distance_miles} mi from campus ·{" "}
                      {formatMoney(selected.value)}/yr
                    </p>
                    <p className="drawer-address">{selected.address}</p>
                  </div>
                  <div className="btn-row">
                    <button type="button" className="btn ghost" onClick={() => onSelect(selected.id)}>
                      Open prospect
                    </button>
                  </div>
                </div>

                <div className="block">
                  <div className="block-head">
                    <span className="block-title">Contact</span>
                  </div>
                  <ContactsPanel
                    prospectId={selected.id}
                    contacts={detail?.contacts || []}
                    onSaved={refresh}
                  />
                </div>

                <div className="block">
                  <div className="block-head">
                    <span className="block-title">Outreach email</span>
                  </div>
                  <OutreachDraft prospectId={selected.id} version={version} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";

import { deleteContact, fetchProspect, logTouch, patchContact, saveContact } from "../api";
import useContactSearch from "../hooks/useContactSearch";
import { EMAIL_STATUS_LABEL, TOUCH_LABEL, ago, emailTone, mailto } from "../people";

const STATUS_LABEL = EMAIL_STATUS_LABEL;

const CONFIDENCE_LABEL = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};


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
        <span className={`status-chip status-${emailTone(email_status)}`}>
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

const BLANK = { name: "", role: "", email: "", email_status: "verified", phone: "", linkedin_url: "" };

function ContactForm({ initial = BLANK, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const [busy, setBusy] = useState(false);
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    const clean = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : value]),
    );
    if (!clean.email) clean.email_status = "none";
    try {
      await onSubmit(clean);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="contact-form" onSubmit={submit}>
      <input placeholder="Name" value={form.name} onChange={set("name")} aria-label="Name" required />
      <input placeholder="Role (owner, GM, head coach)" value={form.role ?? ""} onChange={set("role")} aria-label="Role" />
      <input placeholder="Email" type="email" value={form.email ?? ""} onChange={set("email")} aria-label="Email" />
      <select value={form.email_status} onChange={set("email_status")} aria-label="Email status">
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <input placeholder="Phone" value={form.phone ?? ""} onChange={set("phone")} aria-label="Phone" />
      <input placeholder="LinkedIn URL" value={form.linkedin_url ?? ""} onChange={set("linkedin_url")} aria-label="LinkedIn" />
      <div className="btn-row">
        <button type="submit" className="btn sm" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function SavedContact({ contact, prospectId, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");

  const act = async (label, action) => {
    setBusy(label);
    try {
      await action();
      await onChanged();
    } finally {
      setBusy("");
    }
  };

  if (editing) {
    return (
      <li>
        <ContactForm
          initial={contact}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={(data) => act("edit", () => patchContact(contact.id, data)).then(() => setEditing(false))}
        />
      </li>
    );
  }

  return (
    <li className={contact.is_primary ? "is-primary" : ""}>
      <div className="saved-line">
        <b>{contact.name}</b>
        <span className="saved-role">{contact.role || "Role unknown"}</span>
        {contact.is_primary && <span className="chip">Primary</span>}
        <span className="spacer" />
        {contact.last_touch_at && (
          <span className="touch-meta">
            {TOUCH_LABEL[contact.last_touch_kind]} {ago(contact.last_touch_at)} · {contact.touch_count}
          </span>
        )}
      </div>
      <div className="candidate-email">
        <span className={contact.email ? "email-value" : "email-value empty"}>
          {contact.email || "No email published"}
        </span>
        <span className={`status-chip status-${emailTone(contact.email_status)}`}>
          {STATUS_LABEL[contact.email_status] ?? contact.email_status}
        </span>
        {contact.phone && <span className="muted">{contact.phone}</span>}
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        )}
        {contact.source_url && (
          <a href={contact.source_url} target="_blank" rel="noreferrer">
            Source ↗
          </a>
        )}
      </div>
      <div className="contact-actions">
        {contact.email && (
          <a className="btn ghost sm" href={mailto(contact.email)}>
            Email
          </a>
        )}
        <button type="button" className="btn ghost sm" disabled={Boolean(busy)}
          onClick={() => act("sent", () => logTouch(prospectId, { kind: "sent", contact_id: contact.id }))}>
          {busy === "sent" ? "…" : "Mark sent"}
        </button>
        <button type="button" className="btn ghost sm" disabled={Boolean(busy)}
          onClick={() => act("reply", () => logTouch(prospectId, { kind: "reply", contact_id: contact.id }))}>
          {busy === "reply" ? "…" : "Got reply"}
        </button>
        {!contact.is_primary && (
          <button type="button" className="btn ghost sm" disabled={Boolean(busy)}
            onClick={() => act("primary", () => patchContact(contact.id, { is_primary: true }))}>
            Make primary
          </button>
        )}
        <button type="button" className="link-btn" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className="link-btn danger" disabled={Boolean(busy)}
          onClick={() => window.confirm(`Delete ${contact.name}?`) && act("delete", () => deleteContact(contact.id))}>
          Delete
        </button>
      </div>
    </li>
  );
}

/**
 * Contacts for one prospect: the people on file (with outreach actions), adding
 * one by hand, Find contact, and the candidates it returns.
 */
export default function ContactsPanel({ prospectId, contacts = [], onSaved, compact = false }) {
  const [saved, setSaved] = useState(contacts);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setSaved(contacts);
  }, [contacts]);

  useEffect(() => setAdding(false), [prospectId]);

  const reload = async () => {
    const fresh = await fetchProspect(prospectId).catch(() => null);
    if (fresh) setSaved(fresh.contacts || []);
    if (onSaved) await onSaved();
  };

  const search = useContactSearch(prospectId, { onContactSaved: reload });

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
        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={() => setAdding((open) => !open)}>
            Add by hand
          </button>
          <button
            type="button"
            className="btn"
            onClick={runSearch}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Searching…" : saved.length ? "Find another" : "Find contact"}
          </button>
        </div>
      </div>

      {adding && (
        <ContactForm
          submitLabel="Add contact"
          onCancel={() => setAdding(false)}
          onSubmit={async (data) => {
            await saveContact(prospectId, {
              ...data,
              confidence: "high",
              reasoning: "Added by hand.",
              is_primary: saved.length === 0,
            });
            setAdding(false);
            await reload();
          }}
        />
      )}

      {saved.length > 0 && (
        <ul className="saved-contacts">
          {saved.map((contact) => (
            <SavedContact key={contact.id} contact={contact} prospectId={prospectId} onChanged={reload} />
          ))}
        </ul>
      )}

      {error && <p className="error inline">{error}</p>}

      {status === "idle" && saved.length === 0 && !adding && (
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
              No contact found. Re-run the search, or add one by hand.
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

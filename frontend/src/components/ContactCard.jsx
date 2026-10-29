import { ConfidenceBadge, EmailStatusBadge } from "./Badge.jsx";

export default function ContactCard({ candidate, onUse, onDismiss, busy }) {
  const { name, role, email, email_status, confidence, reasoning, source_url } = candidate;

  return (
    <article className="candidate-card">
      <div className="candidate-head">
        <div>
          <h3>{name}</h3>
          <p className="candidate-role">{role || "Role unknown"}</p>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      <div className="candidate-email">
        <span className={email ? "email-value" : "email-value empty"}>
          {email || "No email published"}
        </span>
        <EmailStatusBadge status={email_status} />
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

      <div className="candidate-actions">
        <button className="btn btn-primary btn-sm" onClick={onUse} disabled={busy}>
          {busy ? "Saving…" : "Use this contact"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDismiss} disabled={busy}>
          Not right
        </button>
      </div>
    </article>
  );
}

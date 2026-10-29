import { useEffect, useState } from "react";

import { getOutreachDraft } from "../api.js";

/**
 * The editable outreach email. To, subject and body come from the server so the
 * draft always matches the current primary contact.
 */
export default function OutreachForm({ prospectId, version = 0 }) {
  const [draft, setDraft] = useState(null);
  const [draftFor, setDraftFor] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setError("");
    setDraft(null);
    setDraftFor(null);
    setCopied(false);

    getOutreachDraft(prospectId)
      .then((data) => {
        if (!alive) return;
        setDraft(data);
        setDraftFor(prospectId);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, [prospectId, version]);

  if (status === "error") return <div className="alert">{error}</div>;

  // Never show a draft built for another prospect while the new one loads.
  const ready = Boolean(draft) && draftFor === prospectId;
  if (!ready) return <div className="skeleton">Preparing the draft…</div>;

  function update(field, value) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  async function copyDraft() {
    const text = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="draft-form">
      <label className="field">
        <span>To</span>
        <input
          value={draft.to}
          placeholder="No email on file for the primary contact"
          onChange={(event) => update("to", event.target.value)}
        />
      </label>

      <label className="field">
        <span>Subject</span>
        <input
          value={draft.subject}
          onChange={(event) => update("subject", event.target.value)}
        />
      </label>

      <label className="field">
        <span>Body</span>
        <textarea
          rows={12}
          value={draft.body}
          onChange={(event) => update("body", event.target.value)}
        />
      </label>

      <div className="draft-actions">
        <span className="sub">
          {draft.contact_id
            ? "Addressed to the primary contact by first name and role."
            : "No primary contact yet — addressed to the gym team."}
        </span>
        <button className="btn btn-primary btn-sm" onClick={copyDraft}>
          {copied ? "Copied" : "Copy email"}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

import { draftOutreach } from "../api";

/**
 * The editable outreach email. Nothing is generated until asked, because a draft
 * is logged on the prospect and (with a key) costs a model call.
 */
export default function OutreachDraft({ prospectId }) {
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(null);
    setStatus("idle");
    setError("");
    setCopied(false);
  }, [prospectId]);

  const generate = async () => {
    setStatus("loading");
    setError("");
    setCopied(false);
    try {
      setDraft(await draftOutreach(prospectId));
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const update = (field, value) =>
    setDraft((current) => (current ? { ...current, [field]: value } : current));

  const copy = async () => {
    if (!draft) return;
    const text = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="draft-form">
      <div className="btn-row">
        <button type="button" className="btn" onClick={generate} disabled={status === "loading"}>
          {status === "loading" ? "Drafting…" : draft ? "Draft again" : "Draft outreach"}
        </button>
        {draft && (
          <button type="button" className="btn ghost" onClick={copy}>
            {copied ? "Copied" : "Copy email"}
          </button>
        )}
      </div>

      {error && <p className="error inline">{error}</p>}

      {!draft && status !== "loading" && (
        <p className="muted">
          Writes the email to the primary contact by first name and role, with their address in
          the To field.
        </p>
      )}

      {draft && (
        <>
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

          <div className="btn-row draft-actions">
            <span className="draft-source">
              {draft.contact_id
                ? "Addressed to the primary contact by first name and role."
                : "No primary contact yet — addressed to the gym team."}
              {draft.source === "ai" ? " Written by AI." : " Written from the template."}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

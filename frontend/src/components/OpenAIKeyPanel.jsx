import { useEffect, useState } from "react";

import { fetchOpenAIKey, saveOpenAIKey } from "../api";

/**
 * Status of the OpenAI key behind Find contact and AI drafts. Locally the key
 * can be pasted here; the API only ever returns its last four characters.
 */
export default function OpenAIKeyPanel() {
  const [status, setStatus] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOpenAIKey().then(setStatus).catch((err) => setError(err.message));
  }, []);

  const save = async (key) => {
    setBusy(true);
    setError("");
    try {
      setStatus(await saveOpenAIKey(key));
      setDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <div className="panel-section">
      <div className="section-label">
        OpenAI key
        <span className={`key-state ${status.configured ? "is-set" : ""}`}>
          {status.configured ? `Set ${status.hint}` : "Not set"}
        </span>
      </div>

      {status.editable ? (
        <form
          className="key-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) save(draft);
          }}
        >
          <input
            type="password"
            autoComplete="off"
            placeholder={status.configured ? "New key" : "sk-…"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="OpenAI API key"
          />
          <button type="submit" className="btn sm" disabled={busy || !draft.trim()}>
            Save
          </button>
          {status.source === "saved" && (
            <button type="button" className="link-btn" disabled={busy} onClick={() => save("")}>
              Clear
            </button>
          )}
        </form>
      ) : (
        !status.configured && <small className="formula">Set OPENAI_API_KEY on the server.</small>
      )}

      {error && <small className="late">{error}</small>}
      <small className="formula">
        {status.source === "env"
          ? "From OPENAI_API_KEY. Powers Find contact and AI drafts."
          : "Powers Find contact and AI drafts. Stored in your local database."}
      </small>
    </div>
  );
}

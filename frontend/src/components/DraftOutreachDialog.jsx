import { useEffect } from "react";

import OutreachForm from "./OutreachForm.jsx";

export default function DraftOutreachDialog({ prospectId, open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Draft outreach"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>Draft outreach</h2>
            <p className="panel-sub">Personalised to the primary contact on file.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>

        <OutreachForm prospectId={prospectId} />

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

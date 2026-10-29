import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listProspects } from "../api.js";
import {
  emailStatusLabel,
  gymTypeLabel,
  isPublicEmail,
  prettyHost,
} from "../utils.js";

export default function ProspectsPage() {
  const [prospects, setProspects] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listProspects()
      .then((rows) => {
        if (alive) setProspects(rows || []);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <p className="eyebrow">Prospect ranking</p>
          <h1>Gyms worth a shelf conversation</h1>
          <p className="lede">
            Ranked by fit. The contact column shows the primary person on file for each
            gym.
          </p>
        </div>
        {prospects && <span className="count-pill">{prospects.length} prospects</span>}
      </header>

      {error && <div className="alert">{error}</div>}
      {!prospects && !error && <div className="skeleton">Loading prospects…</div>}

      {prospects && prospects.length === 0 && (
        <div className="empty">No prospects yet.</div>
      )}

      {prospects && prospects.length > 0 && (
        <div className="table-card">
          <table className="ranked-table">
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th>Gym</th>
                <th className="hide-sm">Type</th>
                <th className="hide-md">Location</th>
                <th className="col-score">Fit score</th>
                <th>Contact</th>
                <th className="col-go" aria-label="Open prospect" />
              </tr>
            </thead>
            <tbody>
              {prospects.map((prospect) => {
                const contact = prospect.primary_contact;
                return (
                  <tr key={prospect.id}>
                    <td className="rank">{prospect.rank}</td>
                    <td>
                      <Link to={`/prospects/${prospect.id}`} className="gym-link">
                        {prospect.name}
                      </Link>
                      <div className="sub">
                        {prospect.website
                          ? prettyHost(prospect.website)
                          : "No website on file"}
                      </div>
                    </td>
                    <td className="hide-sm">
                      <span className="chip">{gymTypeLabel(prospect.gym_type)}</span>
                    </td>
                    <td className="hide-md sub">{prospect.address || "—"}</td>
                    <td className="score-cell">
                      <span className="score-value">{prospect.score}</span>
                      <span className="score-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.max(0, Math.min(100, prospect.score))}%`,
                          }}
                        />
                      </span>
                    </td>
                    <td>
                      {contact ? (
                        <div className="contact-cell">
                          <span className="contact-name">
                            {isPublicEmail(contact.email_status) && (
                              <span
                                className="dot dot-live"
                                title="Email is verified or listed publicly"
                              />
                            )}
                            {contact.name}
                          </span>
                          <span className="sub">
                            {[contact.role, emailStatusLabel(contact.email_status)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      ) : (
                        <span className="sub">No contact yet</span>
                      )}
                    </td>
                    <td className="col-go">
                      <Link
                        to={`/prospects/${prospect.id}`}
                        className="go"
                        aria-label={`Open ${prospect.name}`}
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

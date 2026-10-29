import { useMemo, useState } from "react";

import { logTouch } from "../api";
import { TYPE_LABEL } from "../scoring";
import {
  EMAIL_STATUS_LABEL,
  PEOPLE_STATUSES,
  TOUCH_LABEL,
  ago,
  emailTone,
  mailto,
  personStatus,
} from "../people";
import StagePill from "./StagePill";

const SORTS = {
  score: (a, b) => b.score - a.score,
  name: (a, b) => a.name.localeCompare(b.name),
  touch: (a, b) => (b.last_touch_at || "").localeCompare(a.last_touch_at || ""),
};

/**
 * Every contact across every gym, as a sortable table or an outreach board.
 * Dropping a card on Contacted or Replied logs that touch.
 */
export default function PeopleView({ people, scores, mode, onSelect, onChanged }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("score");
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState("");
  const [error, setError] = useState("");

  const rows = useMemo(
    () =>
      people
        .map((person) => ({ ...person, status: personStatus(person), score: scores[person.prospect_id] ?? 0 }))
        .sort(SORTS[sort]),
    [people, scores, sort],
  );

  const counts = PEOPLE_STATUSES.reduce(
    (acc, status) => ({ ...acc, [status.key]: rows.filter((row) => row.status === status.key).length }),
    {},
  );
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  const touch = async (person, kind) => {
    setBusy(person.id);
    setError("");
    try {
      await logTouch(person.prospect_id, { kind, contact_id: person.id });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(0);
    }
  };

  const actions = (person) => (
    <span className="row-actions" onClick={(event) => event.stopPropagation()}>
      {person.email && (
        <a className="btn ghost xs" href={mailto(person.email)}>
          Email
        </a>
      )}
      <button type="button" className="btn ghost xs" disabled={busy === person.id} onClick={() => touch(person, "sent")}>
        Sent
      </button>
      <button type="button" className="btn ghost xs" disabled={busy === person.id} onClick={() => touch(person, "reply")}>
        Reply
      </button>
    </span>
  );

  if (people.length === 0) {
    return <p className="empty">No contacts yet. Run Find contact on a company to add people.</p>;
  }

  return (
    <div className="people">
      <div className="filter-bar">
        <button type="button" className={`chip-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          All <b>{rows.length}</b>
        </button>
        {PEOPLE_STATUSES.map((status) => (
          <button
            type="button"
            key={status.key}
            className={`chip-btn ${filter === status.key ? "active" : ""}`}
            onClick={() => setFilter(status.key)}
          >
            {status.label} <b>{counts[status.key]}</b>
          </button>
        ))}
        <span className="spacer" />
        {mode === "table" && (
          <label className="inline-field">
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="score">Gym score</option>
              <option value="touch">Last touch</option>
              <option value="name">Name</option>
            </select>
          </label>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {mode === "table" ? (
        <div className="table-wrap">
          <table className="prospect-table people-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Company</th>
                <th>Email</th>
                <th>Last touch</th>
                <th>Stage</th>
                <th className="col-score">Score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => (
                <tr key={person.id} onClick={() => onSelect(person.prospect_id)}>
                  <td className="prospect-cell">
                    <span className="prospect-name">
                      {person.name}
                      {person.is_primary && <span className="chip xs">Primary</span>}
                    </span>
                    <span className="prospect-meta">{person.role || "Role unknown"}</span>
                  </td>
                  <td className="prospect-cell">
                    <span>{person.prospect_name}</span>
                    <span className="prospect-meta">{TYPE_LABEL[person.prospect_type] ?? person.prospect_type}</span>
                  </td>
                  <td>
                    <span className="email-cell">
                      <span className={`dot dot-${emailTone(person.email_status)}`} title={EMAIL_STATUS_LABEL[person.email_status]} />
                      {person.email || <span className="muted">{person.linkedin_url ? "LinkedIn only" : "—"}</span>}
                    </span>
                  </td>
                  <td>
                    {person.last_touch_at ? (
                      <span className={person.status === "replied" ? "touch-replied" : ""}>
                        {TOUCH_LABEL[person.last_touch_kind]} {ago(person.last_touch_at)}
                        <span className="muted"> · {person.touch_count}</span>
                      </span>
                    ) : (
                      <span className="muted">Never</span>
                    )}
                  </td>
                  <td>
                    <StagePill stage={person.prospect_stage} />
                  </td>
                  <td className="col-score num">{Math.round(person.score)}</td>
                  <td>{actions(person)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="kanban kanban-4">
          {PEOPLE_STATUSES.map((status) => {
            const droppable = status.key === "contacted" || status.key === "replied";
            return (
              <div
                key={status.key}
                className={`kanban-col ${over === status.key ? "is-over" : ""}`}
                onDragOver={(event) => {
                  if (!droppable) return;
                  event.preventDefault();
                  setOver(status.key);
                }}
                onDragLeave={() => setOver("")}
                onDrop={(event) => {
                  setOver("");
                  const person = rows.find((row) => row.id === Number(event.dataTransfer.getData("text/plain")));
                  if (person && person.status !== status.key) touch(person, status.key === "replied" ? "reply" : "sent");
                }}
              >
                <div className="kanban-head">
                  <span>{status.label}</span>
                  <span className="num">{counts[status.key]}</span>
                </div>
                <div className="kanban-cards">
                  {rows
                    .filter((row) => row.status === status.key)
                    .map((person) => (
                      <div
                        key={person.id}
                        className="kcard"
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", String(person.id))}
                        onClick={() => onSelect(person.prospect_id)}
                      >
                        <div className="kcard-top">
                          <b>{person.name}</b>
                          <span className="num score-value">{Math.round(person.score)}</span>
                        </div>
                        <div className="kcard-sub">
                          {person.role || "Role unknown"} · {person.prospect_name}
                        </div>
                        <div className="kcard-foot">
                          <span className="email-cell">
                            <span className={`dot dot-${emailTone(person.email_status)}`} />
                            {person.email ? person.email : <span className="muted">no email</span>}
                          </span>
                          {person.last_touch_at && <span className="muted">{ago(person.last_touch_at)}</span>}
                        </div>
                        {status.key !== "replied" && <div className="kcard-actions">{actions(person)}</div>}
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

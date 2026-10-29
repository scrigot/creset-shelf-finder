import { useEffect, useState } from "react";
import ContactsPanel from "./ContactsPanel";
import OutreachDraft from "./OutreachDraft";
import ScoreBar from "./ScoreBar";
import StagePill from "./StagePill";
import {
  TYPE_LABEL,
  breakdown,
  formatDate,
  formatMoney,
  formatMoneyFull,
  isOverdue,
  opportunityValue,
  todayISO,
} from "../scoring";
import {
  fetchProspect,
  logFollowUp,
  patchProspect,
} from "../api";

const STAGES = ["Not contacted", "Reached out", "Meeting", "Sampling", "Stocked", "Lost"];

export default function ProspectDetail({ prospectId, weights, settings, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [follow, setFollow] = useState({ next_action: "", next_action_date: todayISO(), note: "" });

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError("");
    fetchProspect(prospectId)
      .then((data) => {
        if (!alive) return;
        setDetail(data);
        setNotes(data.notes || "");
        setFollow({
          next_action: "",
          next_action_date: data.next_action_date || todayISO(),
          note: "",
        });
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [prospectId]);

  const run = async (label, action) => {
    setBusy(label);
    setError("");
    try {
      const result = await action();
      if (result && result.id) setDetail(result);
      onChanged();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy("");
    }
  };

  const changeStage = (event) =>
    run("stage", () => patchProspect(prospectId, { stage: event.target.value }));

  const submitFollowUp = async (event) => {
    event.preventDefault();
    if (!follow.next_action.trim()) {
      setError("Describe the next action first.");
      return;
    }
    const result = await run("follow", () =>
      logFollowUp(prospectId, {
        next_action: follow.next_action.trim(),
        next_action_date: follow.next_action_date,
        note: follow.note.trim(),
      }),
    );
    if (result) setFollow((current) => ({ ...current, next_action: "", note: "" }));
  };

  const saveNotes = () => run("notes", () => patchProspect(prospectId, { notes }));

  const refreshDetail = async () => {
    try {
      setDetail(await fetchProspect(prospectId));
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <section className="drawer" onClick={(event) => event.stopPropagation()}>
        {!detail && !error && <p className="empty">Loading prospect…</p>}
        {error && <p className="error inline">{error}</p>}

        {detail && (
          <>
            <div className="drawer-head">
              <div>
                <h2>{detail.name}</h2>
                <p className="drawer-meta">
                  {TYPE_LABEL[detail.type] ?? detail.type} · {detail.members.toLocaleString()}{" "}
                  members · {detail.distance_miles} mi from campus
                </p>
                <p className="drawer-address">{detail.address}</p>
              </div>
              <button type="button" className="close-x" onClick={onClose} aria-label="Close prospect">
                ×
              </button>
            </div>

            {(() => {
              const scored = breakdown(detail, weights);
              const value = opportunityValue(detail, settings);
              return (
                <>
                  <div className="score-hero">
                    <b>{Math.round(scored.score)}</b>
                    <span>fit score / 100</span>
                    <span className="hero-value num">{formatMoneyFull(value)}/yr</span>
                  </div>
                  <ScoreBar parts={scored.parts} tall />

                  <div className="block">
                    <div className="block-head">
                      <span className="block-title">Score breakdown</span>
                      {isOverdue(detail) && <span className="late-tag">Follow-up late</span>}
                    </div>
                    {scored.parts.map((part) => (
                      <div className="part-row" key={part.key}>
                        <span>{part.label}</span>
                        <span className="part-raw">{part.raw.toFixed(0)}</span>
                        <div className="track">
                          <div className="fill" style={{ width: `${Math.min(part.points, 100)}%` }} />
                        </div>
                        <span className="pts" title={`${Math.round(part.share * 100)}% weight`}>
                          +{part.points.toFixed(1)}
                        </span>
                      </div>
                    ))}
                    <p className="formula">
                      {detail.members.toLocaleString()} members × {settings.adoption_pct}% ×{" "}
                      {settings.bottles_per_week} bottles/wk × ${settings.margin_per_bottle} × 52
                      = {formatMoneyFull(value)}
                    </p>
                  </div>

                  <div className="block">
                    <div className="block-head">
                      <span className="block-title">Stage</span>
                      <StagePill stage={detail.stage} />
                    </div>
                    <select value={detail.stage} onChange={changeStage} disabled={busy === "stage"}>
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="block">
                    <div className="block-head">
                      <span className="block-title">Next step</span>
                      <span className="block-note">
                        {detail.next_action || "No action set"}
                        {detail.next_action_date && ` · ${formatDate(detail.next_action_date)}`}
                      </span>
                    </div>
                    <form className="form-grid" onSubmit={submitFollowUp}>
                      <input
                        type="text"
                        placeholder="Next action (e.g. drop samples at front desk)"
                        value={follow.next_action}
                        onChange={(event) =>
                          setFollow((current) => ({ ...current, next_action: event.target.value }))
                        }
                        aria-label="Next action"
                      />
                      <div className="row-2">
                        <input
                          type="date"
                          value={follow.next_action_date}
                          onChange={(event) =>
                            setFollow((current) => ({
                              ...current,
                              next_action_date: event.target.value,
                            }))
                          }
                          aria-label="Next action date"
                        />
                        <button type="submit" className="btn" disabled={busy === "follow"}>
                          {busy === "follow" ? "Saving…" : "Log follow-up"}
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Optional note"
                        value={follow.note}
                        onChange={(event) =>
                          setFollow((current) => ({ ...current, note: event.target.value }))
                        }
                        aria-label="Follow-up note"
                      />
                    </form>
                  </div>

                  <div className="block">
                    <div className="block-head">
                      <span className="block-title">Contact</span>
                    </div>
                    <ContactsPanel
                      prospectId={prospectId}
                      contacts={detail.contacts || []}
                      onSaved={refreshDetail}
                      compact
                    />
                  </div>

                  <div className="block">
                    <div className="block-head">
                      <span className="block-title">Outreach email</span>
                    </div>
                    <OutreachDraft prospectId={prospectId} onSent={refreshDetail} />
                  </div>

                  <div className="block">
                    <div className="block-head">
                      <span className="block-title">Activity</span>
                    </div>
                    {detail.activities?.length === 0 && <p className="muted">No activity yet.</p>}
                    {detail.activities?.map((activity) => (
                      <div className="activity" key={activity.id}>
                        <b>
                          {activity.kind} ·{" "}
                          {new Date(activity.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </b>
                        {activity.body}
                      </div>
                    ))}
                  </div>

                  <div className="block">
                    <div className="block-head">
                      <span className="block-title">Notes</span>
                    </div>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      aria-label="Prospect notes"
                    />
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={saveNotes}
                        disabled={busy === "notes" || notes === detail.notes}
                      >
                        {busy === "notes" ? "Saving…" : "Save notes"}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </section>
    </div>
  );
}

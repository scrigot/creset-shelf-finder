import { useEffect, useState } from "react";
import ScoreBar from "./ScoreBar";
import StagePill from "./StagePill";
import {
  TYPE_LABEL,
  breakdown,
  fitReasons,
  formatDate,
  formatMoney,
  formatMoneyFull,
  isOverdue,
  opportunityValue,
  todayISO,
} from "../scoring";
import {
  draftOutreach,
  fetchProspect,
  logFollowUp,
  patchProspect,
} from "../api";

const STAGES = ["Not contacted", "Reached out", "Meeting", "Sampling", "Stocked", "Lost"];

export default function ProspectDetail({ prospectId, weights, settings, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [follow, setFollow] = useState({ next_action: "", next_action_date: todayISO(), note: "" });

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setDraft(null);
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

  const makeDraft = () =>
    run("draft", async () => {
      const generated = await draftOutreach(prospectId);
      setDraft(generated);
      return fetchProspect(prospectId);
    });

  const saveNotes = () => run("notes", () => patchProspect(prospectId, { notes }));

  const copyDraft = () => {
    if (!draft) return;
    navigator.clipboard
      ?.writeText(`${draft.subject}\n\n${draft.body}`)
      .then(() => setBusy("copied"))
      .catch(() => {})
      .finally(() => setTimeout(() => setBusy(""), 1200));
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

                  <div className="block fit-assessment">
                    <div className="block-head"><span className="block-title">Why this gym could fit</span></div>
                    <p className="muted">Based on saved prospect data and your current weights. These are model signals, not a confirmed buying decision.</p>
                    {[
                      { title: "Strengths", test: (part) => part.weight > 0 && part.raw >= 70, empty: "No active scoring factors reach 70/100 with the recorded data." },
                      { title: "Concerns & tradeoffs", test: (part) => part.weight > 0 && part.raw < 70, empty: "All active factors score at least 70/100. Confirm interest and operational requirements with the gym." },
                      { title: "Not weighted in this score", test: (part) => part.weight === 0, empty: null },
                    ].map(({ title, test, empty }) => {
                      const reasons = fitReasons(detail, weights).filter(test);
                      if (!reasons.length && !empty) return null;
                      return <div className="fit-reasons" key={title}>
                        <h3>{title}</h3>
                        {reasons.length ? <ul>{reasons.map((part) => <li key={part.key}>
                          <b>{part.label} · {part.raw.toFixed(0)}/100</b>
                          <span>{part.evidence}</span>
                          <small>{Math.round(part.share * 100)}% weight · {part.points.toFixed(1)} points toward total</small>
                        </li>)}</ul> : <p className="muted">{empty}</p>}
                      </div>;
                    })}
                    <p className="formula">Strengths score at least 70/100; concerns score below 70. All recorded factors appear above, including any you have weighted at zero.</p>
                    {detail.notes && <p className="fit-context"><b>Recorded context:</b> {detail.notes}</p>}
                    {detail.stage === "Lost" && <p className="fit-context"><b>Pipeline concern:</b> This gym is marked Lost. Review the notes before reaching out again.</p>}
                  </div>

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
                      <span className="block-title">Outreach</span>
                      <button type="button" className="btn" onClick={makeDraft} disabled={busy === "draft"}>
                        {busy === "draft" ? "Drafting…" : "Draft outreach"}
                      </button>
                    </div>
                    {draft ? (
                      <div className="draft">
                        <div className="draft-subject">{draft.subject}</div>
                        <pre>{draft.body}</pre>
                        <div className="btn-row">
                          <button type="button" className="btn ghost" onClick={copyDraft}>
                            {busy === "copied" ? "Copied" : "Copy email"}
                          </button>
                          <span className="draft-source">
                            {draft.source === "ai" ? "Written by AI" : "Template draft · add an AI key for model copy"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="muted">
                        Writes a short email referencing this {TYPE_LABEL[detail.type] ?? detail.type}{" "}
                        and its {detail.members.toLocaleString()} members.
                      </p>
                    )}
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

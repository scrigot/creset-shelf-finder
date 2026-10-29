import { useState } from "react";

import { formatDate, formatMoney, isOverdue } from "../scoring";
import { isReachable } from "../people";

const STAGES = ["Not contacted", "Reached out", "Meeting", "Sampling", "Stocked", "Lost"];

/** Pipeline by stage. Drag a card to another column to change its stage. */
export default function CompaniesKanban({ rows, onSelect, onMove }) {
  const [over, setOver] = useState("");

  return (
    <div className="kanban">
      {STAGES.map((stage) => {
        const cards = rows.filter((row) => row.stage === stage);
        const value = cards.reduce((sum, row) => sum + row.value, 0);
        return (
          <div
            key={stage}
            className={`kanban-col ${over === stage ? "is-over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(stage);
            }}
            onDragLeave={() => setOver("")}
            onDrop={(event) => {
              setOver("");
              const id = Number(event.dataTransfer.getData("text/plain"));
              const row = rows.find((item) => item.id === id);
              if (row && row.stage !== stage) onMove(id, stage);
            }}
          >
            <div className="kanban-head">
              <span>{stage}</span>
              <span className="num">
                {cards.length} · {formatMoney(value)}
              </span>
            </div>
            <div className="kanban-cards">
              {cards.map((row) => (
                <div
                  key={row.id}
                  className={`kcard ${isOverdue(row) ? "is-overdue" : ""}`}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", String(row.id))}
                  onClick={() => onSelect(row.id)}
                >
                  <div className="kcard-top">
                    <b>{row.name}</b>
                    <span className="num score-value">{Math.round(row.score)}</span>
                  </div>
                  <div className="kcard-sub">
                    {row.primary_contact ? (
                      <>
                        {isReachable(row.primary_contact) && <span className="contact-dot" />}
                        {row.primary_contact.name}
                        {row.contact_count > 1 && <span className="muted"> +{row.contact_count - 1}</span>}
                      </>
                    ) : (
                      <span className="muted">No contact</span>
                    )}
                  </div>
                  <div className="kcard-foot">
                    <span className="num">{formatMoney(row.value)}</span>
                    {row.next_action_date && (
                      <span className={isOverdue(row) ? "late" : "muted"}>{formatDate(row.next_action_date)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

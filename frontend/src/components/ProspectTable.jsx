import ScoreBar from "./ScoreBar";
import StagePill from "./StagePill";
import {
  TYPE_LABEL,
  daysFromToday,
  formatDate,
  formatMoney,
  isOverdue,
} from "../scoring";

export default function ProspectTable({ rows, onSelect }) {
  if (rows.length === 0) {
    return <p className="empty">No prospects match that filter.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="prospect-table">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th>Prospect</th>
            <th className="col-score">Score</th>
            <th className="col-value">$/yr</th>
            <th className="col-stage">Stage</th>
            <th className="col-next">Next action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const overdue = isOverdue(row);
            const days = row.next_action_date ? daysFromToday(row.next_action_date) : null;
            return (
              <tr
                key={row.id}
                className={overdue ? "is-overdue" : ""}
                onClick={() => onSelect(row.id)}
                tabIndex={0}
                onKeyDown={(event) => event.key === "Enter" && onSelect(row.id)}
              >
                <td className="col-rank">{index + 1}</td>
                <td className="prospect-cell">
                  <span className="prospect-name">{row.name}</span>
                  <span className="prospect-meta">
                    {TYPE_LABEL[row.type] ?? row.type} · {row.distance_miles} mi ·{" "}
                    {row.members.toLocaleString()} members
                  </span>
                </td>
                <td className="col-score">
                  <span className="score-value">{Math.round(row.score)}</span>
                  <ScoreBar parts={row.parts} />
                </td>
                <td className="col-value num">{formatMoney(row.value)}</td>
                <td className="col-stage">
                  <StagePill stage={row.stage} />
                </td>
                <td className="col-next">
                  <span className="next-action">{row.next_action || "—"}</span>
                  {row.next_action_date && (
                    <span className={`next-date ${overdue ? "is-late" : ""}`}>
                      {formatDate(row.next_action_date)}
                      {overdue && days !== null && ` · ${Math.abs(days)}d late`}
                      {!overdue && days === 0 && " · today"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

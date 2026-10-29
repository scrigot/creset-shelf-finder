import StagePill from "./StagePill";
import {
  TYPE_LABEL,
  daysFromToday,
  formatDate,
  formatMoney,
  isOverdue,
} from "../scoring";

export default function FollowUpsView({ rows, onSelect }) {
  if (rows.length === 0) {
    return <p className="empty">Nothing due today. Every follow-up is scheduled ahead.</p>;
  }

  const late = rows.filter((row) => daysFromToday(row.next_action_date) < 0).length;

  return (
    <div className="followups">
      <div className="followups-head">
        <span className="section-label">Due today or overdue</span>
        <span className="followups-count">
          {rows.length} open · <span className="late">{late} late</span>
        </span>
      </div>

      {rows.map((row) => {
        const days = daysFromToday(row.next_action_date);
        const overdue = isOverdue(row) || days < 0;
        return (
          <div
            className="follow-row"
            key={row.id}
            onClick={() => onSelect(row.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => event.key === "Enter" && onSelect(row.id)}
          >
            <span className={`follow-date ${overdue ? "late" : ""}`}>
              {formatDate(row.next_action_date)}
              <small>{days === 0 ? "today" : `${Math.abs(days)}d late`}</small>
            </span>
            <span className="follow-name">
              <b>{row.name}</b>
              <small>
                {TYPE_LABEL[row.type] ?? row.type} · {row.distance_miles} mi
              </small>
            </span>
            <span className="follow-action">{row.next_action}</span>
            <span className="follow-stage">
              <StagePill stage={row.stage} />
            </span>
            <span className="follow-value num">{formatMoney(row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

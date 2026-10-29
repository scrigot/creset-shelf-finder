import { confidenceLabel, emailStatusLabel } from "../utils.js";

export function EmailStatusBadge({ status }) {
  const key = status || "none";
  return <span className={`badge badge-${key}`}>{emailStatusLabel(key)}</span>;
}

export function ConfidenceBadge({ confidence }) {
  const key = confidence || "low";
  return (
    <span className={`confidence confidence-${key}`}>
      <span className="confidence-dot" />
      {confidenceLabel(key)}
    </span>
  );
}

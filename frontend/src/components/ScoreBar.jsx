export default function ScoreBar({ parts, tall = false }) {
  return (
    <div className={`scorebar ${tall ? "scorebar-tall" : ""}`} role="img" aria-label="Score breakdown">
      {parts.map((part, index) => (
        <span
          key={part.key}
          className={`seg seg-${index}`}
          style={{ width: `${Math.max(part.points, 0)}%` }}
          title={`${part.label}: ${part.raw.toFixed(0)} × ${Math.round(part.share * 100)}%`}
        />
      ))}
    </div>
  );
}

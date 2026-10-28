export default function StagePill({ stage }) {
  return <span className={`stage st-${stage.replace(/\s+/g, "-").toLowerCase()}`}>{stage}</span>;
}

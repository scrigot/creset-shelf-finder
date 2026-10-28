const WEIGHTS = [
  { key: "weight_fit", label: "Fit", hint: "gym type" },
  { key: "weight_size", label: "Size", hint: "members, log-scaled" },
  { key: "weight_demo", label: "Demographics", hint: "18–34 · women · athlete focus" },
  { key: "weight_location", label: "Location", hint: "closer scores higher" },
  { key: "weight_ease", label: "Ease", hint: "fridge · supplements · intro" },
];

const ASSUMPTIONS = [
  { key: "adoption_pct", label: "Adoption %", step: 0.5, suffix: "%" },
  { key: "bottles_per_week", label: "Bottles / week", step: 0.5, suffix: "" },
  { key: "margin_per_bottle", label: "Margin / bottle", step: 0.05, suffix: "$" },
];

export default function WeightsPanel({ settings, onChange }) {
  const total =
    settings.weight_fit +
    settings.weight_size +
    settings.weight_demo +
    settings.weight_location +
    settings.weight_ease;

  return (
    <>
      <div className="panel-section">
        <div className="section-label">
          Score weights <span className="weight-total">Σ {Math.round(total)}%</span>
        </div>
        {WEIGHTS.map((weight) => (
          <div className="slider-row" key={weight.key}>
            <div className="slider-head">
              <span>{weight.label}</span>
              <span className="val">{Math.round(settings[weight.key])}</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={settings[weight.key]}
              aria-label={`${weight.label} weight`}
              onChange={(event) =>
                onChange({ [weight.key]: Number(event.target.value) })
              }
            />
            <small>{weight.hint}</small>
          </div>
        ))}
      </div>

      <div className="panel-section">
        <div className="section-label">Value model</div>
        {ASSUMPTIONS.map((input) => (
          <label className="field-row" key={input.key}>
            <span>{input.label}</span>
            <input
              type="number"
              min="0"
              step={input.step}
              value={settings[input.key]}
              aria-label={input.label}
              onChange={(event) =>
                onChange({ [input.key]: Number(event.target.value) })
              }
            />
          </label>
        ))}
        <small className="formula">
          members × adoption × bottles/wk × margin × 52
        </small>
      </div>
    </>
  );
}

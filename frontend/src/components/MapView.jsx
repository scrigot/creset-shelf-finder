import { useState } from "react";
import { TYPE_LABEL, scoreShade } from "../scoring";

const WIDTH = 860;
const HEIGHT = 560;
const PAD = 46;
const CAMPUS = { lat: 35.9132, lng: -79.0558 };

export default function MapView({ rows, onSelect, selectedId }) {
  const [hovered, setHovered] = useState(null);

  const lats = [...rows.map((row) => row.lat), CAMPUS.lat];
  const lngs = [...rows.map((row) => row.lng), CAMPUS.lng];
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1;
  const spanLng = maxLng - minLng || 1;

  const x = (lng) => PAD + ((lng - minLng) / spanLng) * (WIDTH - PAD * 2);
  const y = (lat) => HEIGHT - PAD - ((lat - minLat) / spanLat) * (HEIGHT - PAD * 2);

  const active = rows.find((row) => row.id === (hovered ?? selectedId));

  return (
    <div className="map-wrap">
      <svg
        className="map-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Map of prospects coloured by score"
      >
        <defs>
          <pattern id="grid" width="62" height="62" patternUnits="userSpaceOnUse">
            <path d="M 62 0 L 0 0 0 62" fill="none" stroke="#161616" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" />

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={PAD}
            x2={WIDTH - PAD}
            y1={PAD + ratio * (HEIGHT - PAD * 2)}
            y2={PAD + ratio * (HEIGHT - PAD * 2)}
            stroke="#1d1d1d"
            strokeDasharray="3 6"
          />
        ))}

        {/* UNC campus reference */}
        <g>
          <circle cx={x(CAMPUS.lng)} cy={y(CAMPUS.lat)} r="5" fill="none" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx={x(CAMPUS.lng)} cy={y(CAMPUS.lat)} r="12" fill="none" stroke="#333333" strokeWidth="1" />
          <text x={x(CAMPUS.lng) + 17} y={y(CAMPUS.lat) + 4} fill="#8f8f8f" fontSize="10" letterSpacing="2">
            UNC
          </text>
        </g>

        {rows.map((row) => {
          const isSelected = row.id === selectedId;
          return (
            <g
              key={row.id}
              className="map-pin"
              onMouseEnter={() => setHovered(row.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(row.id)}
            >
              <circle
                cx={x(row.lng)}
                cy={y(row.lat)}
                r={isSelected ? 8 : 6}
                fill={scoreShade(row.score)}
                stroke={isSelected ? "#ffffff" : "#000000"}
                strokeWidth={isSelected ? 2 : 1}
              />
              <circle cx={x(row.lng)} cy={y(row.lat)} r="15" fill="transparent" />
              <title>{`${row.name} · ${Math.round(row.score)} · ${TYPE_LABEL[row.type] ?? row.type}`}</title>
            </g>
          );
        })}
      </svg>

      <div className="map-caption">
        {active ? (
          <span>
            <b>{active.name}</b> · {TYPE_LABEL[active.type] ?? active.type} ·{" "}
            {active.members.toLocaleString()} members · score {Math.round(active.score)}
          </span>
        ) : (
          <span>Click a marker to open the prospect. Points sit by real distance from campus.</span>
        )}
      </div>

      <div className="map-legend">
        <span>Low score</span>
        <span className="legend-bar" />
        <span>High score</span>
        <span className="legend-note">{rows.length} prospects</span>
      </div>
    </div>
  );
}

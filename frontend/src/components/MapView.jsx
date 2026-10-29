import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TYPE_LABEL, scoreShade } from "../scoring";

const CAMPUS = [35.9132, -79.0558];
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export default function MapView({ rows, onSelect, selectedId }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lastIdsRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState(null);

  // Build the map once; StrictMode remounts clean it up and rebuild it.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { center: CAMPUS, zoom: 12, scrollWheelZoom: false });
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const markers = L.layerGroup().addTo(map);
    L.circleMarker(CAMPUS, { radius: 5, color: "#1a1a1a", weight: 1.5, fill: false })
      .bindTooltip("UNC Chapel Hill", {
        permanent: true,
        direction: "right",
        className: "map-campus-label",
      })
      .addTo(markers);

    mapRef.current = map;
    layerRef.current = markers;
    lastIdsRef.current = null;
    setReady(true);
    map.invalidateSize();

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !map || !layer) return;

    layer.eachLayer((item) => {
      if (item.__prospectId) layer.removeLayer(item);
    });

    rows.forEach((row) => {
      const isSelected = row.id === selectedId;
      const marker = L.circleMarker([row.lat, row.lng], {
        radius: isSelected ? 9 : 6,
        fillColor: scoreShade(row.score),
        fillOpacity: 1,
        color: isSelected ? "#1a1a1a" : "#ffffff",
        weight: isSelected ? 2.5 : 1.5,
        bubblingMouseEvents: false,
      });
      marker.__prospectId = row.id;
      marker.bindTooltip(`${row.name} · ${Math.round(row.score)} · ${TYPE_LABEL[row.type] ?? row.type}`);
      marker.on("click", () => onSelect(row.id));
      marker.on("mouseover", () => setHovered(row.id));
      marker.on("mouseout", () => setHovered(null));
      marker.addTo(layer);
    });

    // Only re-frame when the visible set of prospects changes.
    const ids = rows.map((row) => row.id).join(",");
    if (ids !== lastIdsRef.current) {
      lastIdsRef.current = ids;
      const points = [...rows.map((row) => [row.lat, row.lng]), CAMPUS];
      if (points.length > 1) {
        map.fitBounds(points, { padding: [42, 42], maxZoom: 14 });
      } else {
        map.setView(CAMPUS, 13);
      }
    }
  }, [rows, selectedId, ready, onSelect]);

  const active = rows.find((row) => row.id === (hovered ?? selectedId));

  return (
    <div className="map-wrap">
      <div className="map-canvas" ref={containerRef} role="application" aria-label="Map of prospects coloured by score" />

      <div className="map-caption">
        {active ? (
          <span>
            <b>{active.name}</b> · {TYPE_LABEL[active.type] ?? active.type} ·{" "}
            {active.members.toLocaleString()} members · score {Math.round(active.score)}
          </span>
        ) : (
          <span>Click a marker to open the prospect. Pins sit at each gym&rsquo;s real address.</span>
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

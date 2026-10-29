import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TYPE_LABEL, scoreShade } from "../scoring";

const CAMPUS = [35.9132, -79.0558];
const validPosition = (row) => Number.isFinite(row.lat) && Number.isFinite(row.lng) && Math.abs(row.lat) <= 90 && Math.abs(row.lng) <= 180;

export default function MapView({ rows, onSelect, selectedId }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const [tileError, setTileError] = useState(false);
  const located = useMemo(() => rows.filter(validPosition), [rows]);
  const positionsKey = JSON.stringify(located.map(({ id, lat, lng }) => [id, lat, lng]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  const fit = () => {
    if (!map.current) return;
    map.current.fitBounds(L.latLngBounds([CAMPUS, ...located.map(row => [row.lat, row.lng])]), { padding: [45, 45], maxZoom: 15 });
  };

  useEffect(() => {
    const instance = L.map(container.current).setView(CAMPUS, 13);
    map.current = instance;
    const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    tiles.on("tileerror", () => setTileError(true));
    L.control.scale({ imperial: true, metric: false }).addTo(instance);
    const campusLabel = document.createElement("span");
    campusLabel.textContent = "UNC campus";
    L.circleMarker(CAMPUS, { radius: 7, color: "#1a1a1a", fillColor: "#fff", fillOpacity: 1, weight: 2 })
      .addTo(instance).bindTooltip(campusLabel, { permanent: true, direction: "right" });
    markers.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; markers.current = null; };
  }, []);

  useEffect(() => { fit(); }, [positionsKey]);

  useEffect(() => {
    const layer = markers.current;
    if (!layer) return;
    layer.clearLayers();
    located.forEach(row => {
      const label = document.createElement("span");
      label.textContent = String(Math.round(row.score));
      label.className = "prospect-map-score";
      label.style.background = scoreShade(row.score);
      label.style.color = row.score >= 55 ? "white" : "#1a1a1a";
      if (row.id === selectedId) label.classList.add("selected");
      const tooltip = document.createElement("span");
      tooltip.textContent = `${row.name} · ${TYPE_LABEL[row.type] ?? row.type} · Score ${Math.round(row.score)}`;
      L.marker([row.lat, row.lng], {
        icon: L.divIcon({ html: label, className: "prospect-map-marker", iconSize: [36, 36], iconAnchor: [18, 18] }),
        title: `${row.name}, score ${Math.round(row.score)}`,
        alt: row.name,
        zIndexOffset: row.id === selectedId ? 1000 : Math.round(row.score),
      }).addTo(layer).bindTooltip(tooltip, { direction: "top", offset: [0, -18] })
        .on("click", () => onSelect(row.id));
    });
    return () => layer.clearLayers();
  }, [located, selectedId, onSelect]);

  return (
    <div className="map-wrap">
      <div className="map-toolbar">
        <div><strong>Explore your territory</strong><span>Chapel Hill & the Triangle</span></div>
        <button className="tab" type="button" onClick={fit}>Fit all prospects</button>
      </div>
      {tileError && <p role="status" className="map-caption">Some map tiles could not load. Check your connection or reload the page.</p>}
      <div ref={container} className="street-map" aria-label="Street map of prospects. Use arrow keys to pan and plus or minus to zoom." />
      <div className="map-caption">Drag to explore · Zoom in for streets and mapped buildings · Select a score to open a prospect.</div>
      {!rows.length && <p className="map-caption">No prospects match your search.</p>}
      {rows.length > located.length && <p className="map-caption">{rows.length - located.length} prospects have missing or invalid coordinates.</p>}
      <div className="map-legend"><span>Low score</span><span className="legend-bar" /><span>High score</span><span className="legend-note">{located.length} prospects mapped</span></div>
    </div>
  );
}

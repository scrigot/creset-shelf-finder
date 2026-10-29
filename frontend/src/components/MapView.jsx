import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TYPE_LABEL, scoreShade } from "../scoring";

const CAMPUS = [35.9132, -79.0558];
const hasLocation = (row) => Number.isFinite(row.lat) && Number.isFinite(row.lng)
  && Math.abs(row.lat) <= 90 && Math.abs(row.lng) <= 180;

export default function MapView({ rows, onSelect, selectedId }) {
  const container = useRef(null);
  const map = useRef(null);
  const pins = useRef(null);
  const select = useRef(onSelect);
  const boundsKey = useRef(null);
  const [tileError, setTileError] = useState(false);
  select.current = onSelect;

  useEffect(() => {
    const instance = L.map(container.current).setView(CAMPUS, 12);
    map.current = instance;
    boundsKey.current = null;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("tileload", () => setTileError(false));
    pins.current = L.layerGroup().addTo(instance);
    const label = document.createElement("span");
    label.textContent = "UNC Chapel Hill · campus reference";
    L.circleMarker(CAMPUS, { radius: 6, color: "#1a1a1a", fillColor: "#fff", fillOpacity: 1 })
      .bindTooltip(label).addTo(instance);
    L.control.scale({ imperial: true, metric: false }).addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const located = rows.filter(hasLocation);
    pins.current.clearLayers();
    located.forEach((row) => {
      const label = `${row.name} · fit ${Math.round(row.score)}/100 · ${TYPE_LABEL[row.type] ?? row.type}`;
      const tooltip = document.createElement("span");
      tooltip.textContent = label;
      const marker = L.marker([row.lat, row.lng], {
        title: label, alt: label,
        zIndexOffset: row.id === selectedId ? 1000 : 0,
        icon: L.divIcon({
          className: `gym-marker ${row.id === selectedId ? "selected" : ""}`,
          html: `<span class="gym-marker-shape" style="background:${scoreShade(row.score)}"><span>${Math.round(row.score)}</span></span>`,
          iconSize: [36, 46], iconAnchor: [18, 44], tooltipAnchor: [0, -42],
        }),
      }).bindTooltip(tooltip).on("click", () => select.current(row.id)).addTo(pins.current);
      marker.getElement()?.setAttribute("aria-label", label);
      marker.on("keydown", ({ originalEvent }) => {
        if (originalEvent.key === "Enter" || originalEvent.key === " ") {
          L.DomEvent.stop(originalEvent);
          select.current(row.id);
        }
      });
    });
    // Updating weights should preserve the user's zoom and pan.
    const key = JSON.stringify(located.map(({ id, lat, lng }) => [id, lat, lng]).sort((a, b) => a[0] - b[0]));
    if (boundsKey.current !== key) {
      boundsKey.current = key;
      map.current.fitBounds(L.latLngBounds([CAMPUS, ...located.map((row) => [row.lat, row.lng])]), {
        padding: [48, 48], maxZoom: 14,
      });
    }
  }, [rows, selectedId]);

  const fitAll = () => map.current.fitBounds(
    L.latLngBounds([CAMPUS, ...rows.filter(hasLocation).map((row) => [row.lat, row.lng])]),
    { padding: [48, 48], maxZoom: 14 },
  );
  const missing = rows.filter((row) => !hasLocation(row));

  return (
    <div className="map-wrap">
      <div className="map-toolbar">
        <span><b>{rows.length - missing.length}</b> gym locations · select a pin to explore fit</span>
        <button type="button" className="btn ghost" onClick={fitAll}>Show all locations</button>
      </div>
      <div ref={container} className="street-map" role="region" aria-label="Gym prospect street map" />
      {tileError && <p className="map-caption" role="status">Street tiles could not load. Check your connection; gym pins and details are still available.</p>}
      {rows.length === 0 && <p className="map-caption" role="status">No gyms match your search. Clear the search to see all locations.</p>}
      {missing.length > 0 && <div className="map-caption">Missing map coordinates: {missing.map((row) => (
        <button className="btn ghost" type="button" key={row.id} onClick={() => onSelect(row.id)}>{row.name}</button>
      ))}</div>}
      <p className="map-caption">Drag to explore, use + / − to zoom, or press Enter on a focused pin for the gym’s score, strengths, concerns and notes. Pins use saved prospect coordinates.</p>
      <div className="map-legend">
        <span>Lower fit</span><span className="legend-bar" /><span>Higher fit</span>
        <span className="legend-note">Pin number = fit score / 100</span>
      </div>
    </div>
  );
}

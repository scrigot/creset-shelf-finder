import { useEffect, useMemo, useRef, useState } from "react";
import { fetchProspects, fetchSettings, saveSettings } from "./api";
import { breakdown, daysFromToday, formatMoney, opportunityValue } from "./scoring";
import ProspectTable from "./components/ProspectTable";
import MapView from "./components/MapView";
import FollowUpsView from "./components/FollowUpsView";
import ProspectDetail from "./components/ProspectDetail";
import WeightsPanel from "./components/WeightsPanel";

export default function App() {
  const [prospects, setProspects] = useState([]);
  const [settings, setSettings] = useState(null);
  const [view, setView] = useState("pipeline");
  const [mode, setMode] = useState("table");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => {
    Promise.all([fetchProspects(), fetchSettings()])
      .then(([list, prefs]) => {
        setProspects(list);
        setSettings(prefs);
      })
      .catch((err) => setError(err.message));
  }, []);

  const refresh = () =>
    fetchProspects()
      .then(setProspects)
      .catch((err) => setError(err.message));

  const changeSettings = (patch) => {
    setSettings((current) => ({ ...current, ...patch }));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSettings(patch).catch((err) => setError(err.message));
    }, 350);
  };

  const weights = useMemo(
    () =>
      settings
        ? {
            fit: settings.weight_fit,
            size: settings.weight_size,
            demo: settings.weight_demo,
            location: settings.weight_location,
            ease: settings.weight_ease,
          }
        : null,
    [settings],
  );

  const rows = useMemo(() => {
    if (!settings || !weights) return [];
    return prospects
      .map((prospect) => {
        const { score, parts } = breakdown(prospect, weights);
        return {
          ...prospect,
          score,
          parts,
          value: opportunityValue(prospect, settings),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [prospects, settings, weights]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.name, row.type, row.address, row.stage].join(" ").toLowerCase().includes(term),
    );
  }, [rows, query]);

  const followUps = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            row.next_action_date &&
            row.stage !== "Lost" &&
            daysFromToday(row.next_action_date) <= 0,
        )
        .sort((a, b) => a.next_action_date.localeCompare(b.next_action_date)),
    [rows],
  );

  const pipelineValue = rows.reduce((sum, row) => sum + row.value, 0);
  const averageScore = rows.length
    ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length
    : 0;

  const showTable = () => {
    setView("pipeline");
    setMode("table");
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${panelOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-name">Crest</div>
          <div className="brand-sub">Shelf Finder</div>
          <div className="brand-tag">creatine water · UNC Chapel Hill</div>
        </div>

        <nav className="nav">
          <button
            type="button"
            className={view === "pipeline" ? "active" : ""}
            onClick={() => {
              setView("pipeline");
              setPanelOpen(false);
            }}
          >
            Pipeline <span className="badge">{rows.length}</span>
          </button>
          <button
            type="button"
            className={view === "followups" ? "active" : ""}
            onClick={() => {
              setView("followups");
              setPanelOpen(false);
            }}
          >
            Follow-ups <span className={`badge ${followUps.length ? "badge-alert" : ""}`}>{followUps.length}</span>
          </button>
        </nav>

        {settings && <WeightsPanel settings={settings} onChange={changeSettings} />}

        <p className="sidebar-foot">Weights normalise to 100%. Scores and value recompute live.</p>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="tabs">
            <button type="button" className={`tab ${mode === "table" && view === "pipeline" ? "active" : ""}`} onClick={showTable}>
              Table
            </button>
            <button
              type="button"
              className={`tab ${mode === "map" && view === "pipeline" ? "active" : ""}`}
              onClick={() => {
                setView("pipeline");
                setMode("map");
              }}
            >
              Map
            </button>
          </div>
          <span className="spacer" />
          <label className="search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search prospects"
            />
          </label>
          <button type="button" className="tab mobile-toggle" onClick={() => setPanelOpen((open) => !open)}>
            Targets
          </button>
        </div>

        <div className="summary">
          <div className="stat">
            <b>{rows.length}</b>
            <span>prospects</span>
          </div>
          <div className="stat">
            <b>{formatMoney(pipelineValue)}</b>
            <span>pipeline / yr</span>
          </div>
          <div className="stat">
            <b>{averageScore.toFixed(1)}</b>
            <span>avg score</span>
          </div>
          <div className="stat">
            <b className={followUps.length ? "late" : ""}>{followUps.length}</b>
            <span>due now</span>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {view === "pipeline" &&
          (mode === "table" ? (
            <ProspectTable rows={filtered} onSelect={setDetailId} />
          ) : (
            <MapView rows={filtered} onSelect={setDetailId} selectedId={detailId} />
          ))}

        {view === "followups" && <FollowUpsView rows={followUps} onSelect={setDetailId} />}
      </main>

      {detailId && settings && (
        <ProspectDetail
          prospectId={detailId}
          weights={weights}
          settings={settings}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

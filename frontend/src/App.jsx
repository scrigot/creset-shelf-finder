import { useEffect, useMemo, useRef, useState } from "react";
import { fetchContacts, fetchProspects, fetchSettings, patchProspect, saveSettings } from "./api";
import { breakdown, daysFromToday, formatMoney, opportunityValue } from "./scoring";
import ProspectTable from "./components/ProspectTable";
import MapView from "./components/MapView";
import FollowUpsView from "./components/FollowUpsView";
import ProspectDetail from "./components/ProspectDetail";
import WeightsPanel from "./components/WeightsPanel";
import OutreachWorkspace from "./components/OutreachWorkspace";
import CompaniesKanban from "./components/CompaniesKanban";
import PeopleView from "./components/PeopleView";
import { isReachable, personStatus } from "./people";

const MODES = {
  companies: ["table", "kanban", "map"],
  people: ["table", "kanban"],
};

export default function App() {
  const [prospects, setProspects] = useState([]);
  const [people, setPeople] = useState([]);
  const [settings, setSettings] = useState(null);
  const [view, setView] = useState("companies");
  const [modes, setModes] = useState({ companies: "table", people: "table" });
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => {
    Promise.all([fetchProspects(), fetchContacts(), fetchSettings()])
      .then(([list, contacts, prefs]) => {
        setProspects(list);
        setPeople(contacts);
        setSettings(prefs);
      })
      .catch((err) => setError(err.message));
  }, []);

  const refresh = () =>
    Promise.all([fetchProspects(), fetchContacts()])
      .then(([list, contacts]) => {
        setProspects(list);
        setPeople(contacts);
      })
      .catch((err) => setError(err.message));

  const moveStage = async (id, stage) => {
    setProspects((current) => current.map((row) => (row.id === id ? { ...row, stage } : row)));
    await patchProspect(id, { stage }).catch((err) => setError(err.message));
    refresh();
  };

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
      [row.name, row.type, row.address, row.stage, row.primary_contact?.name]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [rows, query]);

  const scores = useMemo(() => Object.fromEntries(rows.map((row) => [row.id, row.score])), [rows]);

  const filteredPeople = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return people;
    return people.filter((person) =>
      [person.name, person.role, person.email, person.prospect_name].join(" ").toLowerCase().includes(term),
    );
  }, [people, query]);

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

  const withContact = rows.filter((row) => row.primary_contact).length;
  const reachable = rows.filter((row) => isReachable(row.primary_contact)).length;
  const contacted = rows.filter((row) => row.stage !== "Not contacted").length;
  const replied = people.filter((person) => personStatus(person) === "replied").length;
  const stocked = rows.filter((row) => row.stage === "Stocked").length;

  const pipelineValue = rows.reduce((sum, row) => sum + row.value, 0);
  const averageScore = rows.length
    ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length
    : 0;
  const pct = (n) => (rows.length ? `${Math.round((n / rows.length) * 100)}%` : "0%");

  const mode = modes[view];
  const go = (next) => {
    setView(next);
    setPanelOpen(false);
  };

  const NAV = [
    ["companies", "Companies", rows.length],
    ["people", "People", people.length],
    ["followups", "Follow-ups", followUps.length],
    ["outreach", "Outreach", withContact],
  ];

  return (
    <div className="shell">
      <aside className={`sidebar ${panelOpen ? "open" : ""}`}>
        <div className="brand">
          <img className="brand-mark" src="/creset-logo.png" alt="Creset" />
          <div className="brand-sub">Shelf Finder</div>
          <div className="brand-tag">creatine water · UNC Chapel Hill</div>
        </div>

        <nav className="nav">
          {NAV.map(([key, label, count]) => (
            <button type="button" key={key} className={view === key ? "active" : ""} onClick={() => go(key)}>
              {label}{" "}
              <span className={`badge ${key === "followups" && count ? "badge-alert" : ""}`}>{count}</span>
            </button>
          ))}
        </nav>

        {settings && <WeightsPanel settings={settings} onChange={changeSettings} />}

        <p className="sidebar-foot">Weights normalise to 100%. Scores and value recompute live.</p>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="tabs">
            {(MODES[view] || []).map((key) => (
              <button
                type="button"
                key={key}
                className={`tab ${mode === key ? "active" : ""}`}
                onClick={() => setModes((current) => ({ ...current, [view]: key }))}
              >
                {key}
              </button>
            ))}
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
            Menu
          </button>
        </div>

        <div className="summary">
          {[
            [rows.length, "companies"],
            [`${withContact}`, `with contact · ${pct(withContact)}`],
            [`${reachable}`, `with email · ${pct(reachable)}`],
            [`${contacted}`, `contacted · ${pct(contacted)}`],
            [replied, "replies"],
            [stocked, "stocked"],
            [formatMoney(pipelineValue), "pipeline / yr"],
            [averageScore.toFixed(1), "avg score"],
          ].map(([value, label]) => (
            <div className="stat" key={label}>
              <b>{value}</b>
              <span>{label}</span>
            </div>
          ))}
          <div className="stat">
            <b className={followUps.length ? "late" : ""}>{followUps.length}</b>
            <span>due now</span>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {view === "companies" && mode === "table" && <ProspectTable rows={filtered} onSelect={setDetailId} />}
        {view === "companies" && mode === "kanban" && (
          <CompaniesKanban rows={filtered} onSelect={setDetailId} onMove={moveStage} />
        )}
        {view === "companies" && mode === "map" && (
          <MapView rows={filtered} onSelect={setDetailId} selectedId={detailId} />
        )}

        {view === "people" && (
          <PeopleView
            people={filteredPeople}
            scores={scores}
            mode={mode}
            onSelect={setDetailId}
            onChanged={refresh}
          />
        )}

        {view === "followups" && <FollowUpsView rows={followUps} onSelect={setDetailId} />}

        {view === "outreach" && (
          <OutreachWorkspace
            rows={filtered}
            onSelect={setDetailId}
            onChanged={refresh}
          />
        )}
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

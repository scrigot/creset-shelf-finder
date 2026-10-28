import { useEffect, useState } from "react";
import { fetchItems, fetchShelves } from "./api";
import ItemCard from "./components/ItemCard";
import ShelvesPanel from "./components/ShelvesPanel";
import AddItemForm from "./components/AddItemForm";

export default function App() {
  const [shelves, setShelves] = useState([]);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [activeShelf, setActiveShelf] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadShelves = () => fetchShelves().then(setShelves);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      fetchItems({ q: query, shelfId: activeShelf })
        .then((data) => {
          if (!alive) return;
          setItems(data);
          setError("");
        })
        .catch((err) => alive && setError(err.message))
        .finally(() => alive && setLoading(false));
    }, 180);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, activeShelf]);

  useEffect(() => {
    loadShelves().catch((err) => setError(err.message));
  }, []);

  const handleCreated = async () => {
    setShowForm(false);
    await Promise.all([
      loadShelves(),
      fetchItems({ q: query, shelfId: activeShelf }).then(setItems),
    ]).catch(() => {});
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Catalogue of crest-marked pieces</p>
          <h1>Crest Shelf Finder</h1>
          <p className="lead">
            Search a name, an emblem, or a room — and see exactly which shelf holds it.
          </p>
        </div>
        <button type="button" className="primary" onClick={() => setShowForm((open) => !open)}>
          {showForm ? "Close form" : "Add item"}
        </button>
      </header>

      <div className="search">
        <span className="search-icon" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “goblet”, “raven”, or “Study” …"
          aria-label="Search the collection"
        />
        {query && (
          <button type="button" className="clear" onClick={() => setQuery("")} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      {showForm && (
        <AddItemForm shelves={shelves} onCreated={handleCreated} onCancel={() => setShowForm(false)} />
      )}

      <div className="content">
        <ShelvesPanel shelves={shelves} activeShelf={activeShelf} onSelect={setActiveShelf} />

        <main className="results">
          <div className="results-head">
            <h2 className="panel-title">
              {items.length} {items.length === 1 ? "piece" : "pieces"}
            </h2>
            {loading && <span className="status">Searching…</span>}
          </div>

          {error && <p className="error">{error}</p>}

          {!loading && !error && items.length === 0 && (
            <p className="empty">Nothing matches that search yet. Try another word or another shelf.</p>
          )}

          <div className="grid">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

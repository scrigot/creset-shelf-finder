export default function ShelvesPanel({ shelves, activeShelf, onSelect }) {
  const total = shelves.reduce((sum, shelf) => sum + shelf.item_count, 0);

  return (
    <aside className="shelves">
      <h2 className="panel-title">Shelves</h2>
      <button
        type="button"
        className={`shelf ${activeShelf == null ? "is-active" : ""}`}
        onClick={() => onSelect(null)}
      >
        <span>All shelves</span>
        <span className="count">{total}</span>
      </button>
      {shelves.map((shelf) => (
        <button
          type="button"
          key={shelf.id}
          className={`shelf ${activeShelf === shelf.id ? "is-active" : ""}`}
          onClick={() => onSelect(shelf.id)}
        >
          <span>
            {shelf.name}
            <small>{shelf.room}</small>
          </span>
          <span className="count">{shelf.item_count}</span>
        </button>
      ))}
    </aside>
  );
}

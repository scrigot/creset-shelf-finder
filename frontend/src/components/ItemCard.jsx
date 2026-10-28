export default function ItemCard({ item }) {
  return (
    <article className="card">
      <div className="card-top">
        <span className="chip">{item.category}</span>
        {item.slot && <span className="slot">Slot {item.slot}</span>}
      </div>
      <h3 className="card-title">{item.name}</h3>
      {item.crest && <p className="crest">{item.crest}</p>}
      <p className="location">
        <span className="pin" aria-hidden="true" />
        {item.shelf_name}
        <span className="dot">·</span>
        {item.room}
      </p>
    </article>
  );
}

import { useState } from "react";
import { createItem } from "../api";

const EMPTY = { name: "", crest: "", category: "", slot: "", shelf_id: "" };

export default function AddItemForm({ shelves, onCreated, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, shelf_id: shelves[0]?.id ?? "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.shelf_id) {
      setError("A name and a shelf are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createItem({
        name: form.name.trim(),
        crest: form.crest.trim(),
        category: form.category.trim() || "Uncategorised",
        slot: form.slot.trim(),
        shelf_id: Number(form.shelf_id),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <h2 className="panel-title">Add an item</h2>
      <div className="fields">
        <label>
          Item name
          <input value={form.name} onChange={update("name")} placeholder="Ravensworth Crest Plaque" autoFocus />
        </label>
        <label>
          Crest or emblem
          <input value={form.crest} onChange={update("crest")} placeholder="Raven rampant on a silver chevron" />
        </label>
        <label>
          Category
          <input value={form.category} onChange={update("category")} placeholder="Plaque" />
        </label>
        <label>
          Slot
          <input value={form.slot} onChange={update("slot")} placeholder="A2" />
        </label>
        <label>
          Shelf
          <select value={form.shelf_id} onChange={update("shelf_id")}>
            {shelves.map((shelf) => (
              <option key={shelf.id} value={shelf.id}>
                {shelf.name} — {shelf.room}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving…" : "Add to shelf"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

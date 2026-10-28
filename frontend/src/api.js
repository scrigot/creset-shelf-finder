const parse = async (response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
};

export const fetchShelves = () => fetch("/api/shelves").then(parse);

export const fetchItems = ({ q = "", shelfId = null }) => {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (shelfId != null) params.set("shelf_id", shelfId);
  const suffix = params.toString();
  return fetch(`/api/items${suffix ? `?${suffix}` : ""}`).then(parse);
};

export const createItem = (payload) =>
  fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(parse);

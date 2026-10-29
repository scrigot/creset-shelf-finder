const JSON_HEADERS = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...JSON_HEADERS, ...(options.headers || {}) },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail = data && (data.detail || data.message);
    const message =
      typeof detail === "string"
        ? detail
        : detail
          ? JSON.stringify(detail)
          : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export function listProspects() {
  return request("/api/prospects");
}

export function getProspect(id) {
  return request(`/api/prospects/${id}`);
}

export function findContact(id) {
  return request(`/api/prospects/${id}/find-contact`, { method: "POST" });
}

export function saveContact(id, contact) {
  return request(`/api/prospects/${id}/contacts`, {
    method: "POST",
    body: JSON.stringify(contact),
  });
}

export function getOutreachDraft(id) {
  return request(`/api/prospects/${id}/outreach-draft`, { method: "POST" });
}

const parse = async (response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : detail
          ? JSON.stringify(detail)
          : `Request failed (${response.status})`,
    );
  }
  return response.json();
};

const withJson = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const fetchProspects = () => fetch("/api/prospects").then(parse);

export const fetchProspect = (id) => fetch(`/api/prospects/${id}`).then(parse);

export const patchProspect = (id, patch) =>
  fetch(`/api/prospects/${id}`, withJson("PATCH", patch)).then(parse);

export const logFollowUp = (id, payload) =>
  fetch(`/api/prospects/${id}/follow-up`, withJson("POST", payload)).then(parse);

export const draftOutreach = (id) =>
  fetch(`/api/prospects/${id}/draft-outreach`, { method: "POST" }).then(parse);

export const findContact = (id) =>
  fetch(`/api/prospects/${id}/find-contact`, { method: "POST" }).then(parse);

export const saveContact = (id, contact) =>
  fetch(`/api/prospects/${id}/contacts`, withJson("POST", contact)).then(parse);

export const fetchSettings = () => fetch("/api/settings").then(parse);

export const saveSettings = (patch) =>
  fetch("/api/settings", withJson("PUT", patch)).then(parse);

export const fetchContacts = () => fetch("/api/contacts").then(parse);

export const patchContact = (id, patch) =>
  fetch(`/api/contacts/${id}`, withJson("PATCH", patch)).then(parse);

export const deleteContact = (id) =>
  fetch(`/api/contacts/${id}`, { method: "DELETE" }).then((response) => {
    if (!response.ok) throw new Error(`Delete failed (${response.status})`);
  });

export const logTouch = (prospectId, touch) =>
  fetch(`/api/prospects/${prospectId}/touches`, withJson("POST", touch)).then(parse);

export const fetchOpenAIKey = () => fetch("/api/openai-key").then(parse);

export const saveOpenAIKey = (key) =>
  fetch("/api/openai-key", withJson("PUT", { key })).then(parse);

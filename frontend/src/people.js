export const EMAIL_STATUS_LABEL = {
  verified: "Verified",
  listed_publicly: "Listed publicly",
  guessed: "Pattern guess",
  none: "No email",
};

export const isReachable = (contact) =>
  Boolean(contact?.email) &&
  (contact.email_status === "verified" || contact.email_status === "listed_publicly");

export const emailTone = (status) =>
  status === "verified" || status === "listed_publicly" ? "ok" : status === "guessed" ? "warn" : "none";

// Where a person sits in the outreach loop; drives the People kanban columns.
export const PEOPLE_STATUSES = [
  { key: "needs-email", label: "Needs email" },
  { key: "ready", label: "Ready to send" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
];

export function personStatus(contact) {
  if (contact.last_touch_kind === "reply") return "replied";
  if (contact.touch_count > 0) return "contacted";
  return contact.email ? "ready" : "needs-email";
}

export function ago(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days <= 0) return "today";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export const TOUCH_LABEL = { sent: "Sent", reply: "Replied", call: "Call", note: "Note" };

export function mailto(to, subject = "", body = "") {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${encodeURIComponent(to || "")}?${params.toString().replace(/\+/g, "%20")}`;
}

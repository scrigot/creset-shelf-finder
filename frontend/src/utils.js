export const GYM_TYPE_LABELS = {
  independent_strength: "Independent strength",
  crossfit: "CrossFit box",
  boutique_franchise: "Boutique / franchise",
  campus_rec: "Campus rec",
  run_club: "Run club",
};

export const EMAIL_STATUS_LABELS = {
  verified: "Verified",
  listed_publicly: "Listed publicly",
  guessed: "Guessed",
  none: "No email",
};

export const CONFIDENCE_LABELS = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export function gymTypeLabel(value) {
  return GYM_TYPE_LABELS[value] || value || "Gym";
}

export function emailStatusLabel(value) {
  return EMAIL_STATUS_LABELS[value] || "No email";
}

export function confidenceLabel(value) {
  return CONFIDENCE_LABELS[value] || "Low confidence";
}

// A green dot means the address is safe to write to without guessing.
export function isPublicEmail(status) {
  return status === "verified" || status === "listed_publicly";
}

export function prettyHost(url) {
  if (!url) return "";
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const TYPE_FIT = {
  strength: 100,
  crossfit: 95,
  "campus rec": 92,
  "run club": 88,
  boutique: 72,
  "yoga/spin": 64,
  "big-box": 52,
};

export const ATHLETE_FIT = { low: 40, med: 70, high: 100 };

export const TYPE_LABEL = {
  strength: "Strength",
  crossfit: "CrossFit",
  boutique: "Boutique",
  "big-box": "Big-box",
  "run club": "Run club",
  "campus rec": "Campus rec",
  "yoga/spin": "Yoga / spin",
};

const SIZE_CAP = 3000;
const MILES_PER_POINT = 7.5;

export function breakdown(prospect, weights) {
  const fit = TYPE_FIT[prospect.type] ?? 50;
  const size = Math.min(
    100,
    (Math.log10(Math.max(prospect.members, 1)) / Math.log10(SIZE_CAP)) * 100,
  );
  const demo =
    0.4 * prospect.pct_18_34 +
    0.2 * prospect.pct_women +
    0.4 * (ATHLETE_FIT[prospect.athlete_focus] ?? 60);
  const location = Math.max(0, 100 - prospect.distance_miles * MILES_PER_POINT);
  const ease =
    (prospect.has_drink_fridge ? 35 : 0) +
    (prospect.sells_supplements ? 25 : 0) +
    (prospect.warm_intro ? 40 : 0);

  const total =
    weights.fit + weights.size + weights.demo + weights.location + weights.ease || 1;

  const parts = [
    { key: "fit", label: "Fit", raw: fit, weight: weights.fit },
    { key: "size", label: "Size", raw: size, weight: weights.size },
    { key: "demo", label: "Demographics", raw: demo, weight: weights.demo },
    { key: "location", label: "Location", raw: location, weight: weights.location },
    { key: "ease", label: "Ease", raw: ease, weight: weights.ease },
  ].map((part) => ({
    ...part,
    points: (part.raw * part.weight) / total,
    share: part.weight / total,
  }));

  return { score: parts.reduce((sum, part) => sum + part.points, 0), parts };
}

export function opportunityValue(prospect, settings) {
  return (
    prospect.members *
    (settings.adoption_pct / 100) *
    settings.bottles_per_week *
    settings.margin_per_bottle *
    52
  );
}

export function formatMoney(value) {
  if (value >= 10000) return `$${(value / 1000).toFixed(1)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}k`;
  return `$${Math.round(value)}`;
}

export function formatMoneyFull(value) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export const todayISO = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export function daysFromToday(iso) {
  const today = Date.parse(`${todayISO()}T00:00:00`);
  return Math.round((Date.parse(`${iso}T00:00:00`) - today) / 86400000);
}

export function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(prospect) {
  if (!prospect.next_action_date) return false;
  if (prospect.stage === "Stocked" || prospect.stage === "Lost") return false;
  return daysFromToday(prospect.next_action_date) < 0;
}

export function scoreShade(score) {
  const level = Math.round(214 - (score / 100) * 188);
  return `rgb(${level}, ${level}, ${level})`;
}

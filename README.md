# Creset Shelf Finder

Prospect scoring and outreach tracker for Creset, a creatine water brand selling into gyms, studios and fitness partners around UNC Chapel Hill.

## What's in the app

**Scoring (0–100)** — computed in `frontend/src/scoring.js`, weighted by five sidebar sliders that re-rank the table live:

| Component | Default weight | Input |
| --- | --- | --- |
| Fit | 30 | gym type map (strength 100 → big-box 52) |
| Size | 25 | members, log-scaled against a 3,000-member cap |
| Demographics | 20 | 40% age 18–34, 20% % women, 40% athlete focus (low 40 / med 70 / high 100) |
| Location | 15 | 100 − 7.5 points per mile |
| Ease | 10 | drink fridge 35 + sells supplements 25 + warm intro 40 |

Weights are normalised by their sum, so any slider combination re-ranks consistently.

**Opportunity value ($/yr)** = members × adoption % × bottles per week × margin per bottle × 52. Adoption, bottles and margin are global inputs in the sidebar and persist in the `settings` table.

**Views**

- *Pipeline* — dense ranked table (score, breakdown bar, $/yr, contact, stage, next action with overdue dates in red), plus a map of prospects shaded by score.
- *Follow-ups* — everything due today or overdue, oldest first.
- *Find & outreach* — pick a prospect, run **Find contact**, and write the email on one screen.
- *Prospect drawer* — score breakdown, stage dropdown, contact search, activity log, "Log follow-up" (sets next action + date), and "Draft outreach".

**Find contact** searches the web (OpenAI Responses API with the `web_search` tool) for the person who decides what the gym stocks. The role it targets follows the gym type: owner then head coach for independent/CrossFit gyms, franchise owner or GM for boutiques and chains (with a note when corporate approval is needed), retail/operations manager for campus rec, organizer or host store for run clubs. It reads the gym's own About/Team/Contact pages, its Google Business listing, Instagram, LinkedIn and local press, and returns up to three candidates with a source link each.

**Email rules** — enforced in `backend/app/services/contact_search.py`, not just in the prompt:

- No published address → the gym's general address marked `listed_publicly`, or `none` when only a contact form exists.
- A pattern guess must be marked `guessed`, and the server forces its confidence to `low`.
- Invalid addresses are dropped, and typographic hyphens copied from web pages are repaired.

**Draft outreach** addresses the primary contact by first name and role, with their email in the To field. It calls OpenAI when `OPENAI_API_KEY` is set and otherwise falls back to a written template.

## Stack

- `frontend/` — React + Vite dev server on port 3000; proxies `/api` to the backend so the app is same-origin.
- `backend/` — FastAPI + SQLAlchemy on port 8000 (OpenAPI at `/docs`), with `pytest` coverage of the contact rules and API.
- `db` — Postgres 16, seeded with 25 Chapel Hill / Durham prospects on first start.

## Running it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

UI: http://localhost:3000 · API: http://localhost:8000

## Deploying

`Dockerfile` builds one production image: the Vite bundle from `npm run build`, served by the same FastAPI process that owns `/api`, so the deployed app stays same-origin. `STATIC_DIR` is the only switch — the image sets it, development leaves it unset and Vite serves the UI.

```bash
docker build -t crest-shelf-finder .
docker run -p 8000:8000 -e DATABASE_URL=postgresql+psycopg://user:pass@host:5432/crest crest-shelf-finder
```

The container needs a Postgres reachable through `DATABASE_URL`; tables are created on first boot and the demo prospects seeded unless `SEED_DEMO_DATA=0`. For a single host, `docker-compose.prod.yml` runs the same image beside its own Postgres:

```bash
POSTGRES_PASSWORD=change-me APP_PORT=8080 docker compose -f docker-compose.prod.yml up -d --build
```

Nothing here is tied to one provider: Render, Railway, Fly and a plain VPS all run this image plus a managed Postgres URL. No platform-specific config is committed yet.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Set by Compose to the local Postgres service |
| `OPENAI_API_KEY` | Web search for Find contact and model copy for drafts. Delivered by the platform to `/run/base44/app.env`; without it Find contact returns a clear 503 and drafts stay templated |
| `OPENAI_MODEL` | Defaults to `gpt-4.1` for contact search |
| `OPENAI_BASE_URL` | Defaults to `https://api.openai.com/v1` |
| `SEED_DEMO_DATA` | `0` disables demo seeding (the tests set it) |

## Tests

```bash
docker compose -f docker-compose.base44.yml exec -T api python -m pytest -q
```

The suite uses a throwaway SQLite file at `/tmp/crest_test.db`, so it never touches the development database or the network.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness (used by the compose healthcheck) |
| GET | `/api/prospects` | All prospects with their primary contact |
| GET | `/api/prospects/{id}` | Prospect with contacts and activity log |
| PATCH | `/api/prospects/{id}` | Stage, next action/date, notes |
| POST | `/api/prospects/{id}/activities` | Append an activity |
| POST | `/api/prospects/{id}/follow-up` | Set next action + date and log it |
| POST | `/api/prospects/{id}/find-contact` | Web-search contact candidates |
| POST | `/api/prospects/{id}/contacts` | Save a contact (primary demotes others) |
| POST | `/api/prospects/{id}/draft-outreach` | AI or template email draft |
| GET/PUT | `/api/settings` | Weights and value-model inputs |

## Sandbox notes

- `BASE44_PREVIEW_MODE` is passed through to both services; only `vite.config.js` branches on it, to extend the dev-server host allowlist.
- Vite receives the preview host via `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` (passed through by Compose) and, inside the sandbox, an explicit `allowedHosts` entry.
- The backend waits for Postgres (`wait_for_db`) before creating tables.

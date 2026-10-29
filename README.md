# Creset Shelf Finder

Prospect scoring and outreach tracker for Creset, a creatine water brand selling into gyms, studios and fitness partners around UNC Chapel Hill.

## Stack

- `frontend/` — React + Vite dev server on port 3000; proxies `/api` to the backend so the app is same-origin.
- `backend/` — FastAPI + SQLAlchemy on port 8000 (OpenAPI at `/docs`).
- `db` — Postgres 16, seeded with 25 Chapel Hill / Durham prospects on first start.

## Running it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

UI: http://localhost:3000 · API: http://localhost:8000

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

- *Pipeline* — dense ranked table (score, breakdown bar, $/yr, stage, next action with overdue dates in red), plus a zoomable OpenStreetMap street map. Score-labelled pins use saved prospect coordinates; clicking a pin opens full gym details, strengths, concerns, scoring inputs and notes. Search filters the pins; Show all locations resets the view. Street tiles require internet access; no API key is needed.
- *Follow-ups* — everything due today or overdue, oldest first.
- *Prospect drawer* — score breakdown, stage dropdown, activity log, "Log follow-up" (sets next action + date), and "Draft outreach".

**Draft outreach** calls the backend, which uses `OPENAI_API_KEY` when present and otherwise falls back to a written template built from the gym's type and member count. Add the key under Secrets to get model-written copy.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness (used by the compose healthcheck) |
| GET | `/api/prospects` | All prospects |
| GET | `/api/prospects/{id}` | Prospect with activity log |
| PATCH | `/api/prospects/{id}` | Stage, next action/date, notes |
| POST | `/api/prospects/{id}/activities` | Append an activity |
| POST | `/api/prospects/{id}/follow-up` | Set next action + date and log it |
| POST | `/api/prospects/{id}/draft-outreach` | AI or template email draft |
| GET/PUT | `/api/settings` | Weights and value-model inputs |

## Sandbox notes

- `BASE44_PREVIEW_MODE` is passed through to both services; nothing branches on it yet.
- Vite receives the preview host via `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` (passed through by Compose) so dev assets and HMR work behind the proxy.
- The backend waits for Postgres (`wait_for_db`) before creating tables.

## Share the full app

GitHub stores the source. For a shared application with saved notes, follow-ups and settings, deploy the web app and Postgres together:

[Deploy this branch to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fscrigot%2Fcrest-shelf-finder%2Ftree%2Fwills-branch)

The root `Dockerfile` builds the frontend and serves it from FastAPI on the same URL as `/api`. `render.yaml` provisions a web service and a private Postgres database; Render supplies the database connection string. No local computer needs to stay running. After deployment, share the service's HTTPS `onrender.com` URL. You can share this GitHub README as the project link, but visitors use the deployed service to open the app.

The blueprint explicitly chooses **free trial** resources. Render's free database expires after 30 days and its free web service sleeps after 15 minutes idle. Upgrade before the database expires for ongoing use; review current pricing in Render before accepting any paid plan. No paid resources are provisioned by this repository alone. Auto-deployment is off; deploy future branch changes manually from Render.

This version has no sign-in: anyone with the app URL can read and update the shared pipeline. It starts with the repository's 25 sample prospects; verify these before outreach. Keep confidential prospect data out until access controls are added. Outreach uses templates unless you add `OPENAI_API_KEY` in the hosting service's environment settings; never put a key in GitHub.

### Verify a deployment

- Open `/api/health` and check for `{"status":"ok"}`.
- Open the app, select Map and open a gym pin.
- Save a note, then open the same gym in a second browser; confirm that the note appears.

### Local tests

Build first with `cd frontend && npm ci && npm test && npm run build`. Install `backend/requirements.txt` and `httpx`, then run `cd backend && python -m unittest discover -s tests`. The backend integration tests use a temporary SQLite database and test UI routing and saves across independent clients; the hosted database remains Postgres.

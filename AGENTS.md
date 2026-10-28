# Notes for working in this repo

Crest Shelf Finder is a prospect scoring + outreach tracker for a creatine water brand selling into gyms near UNC Chapel Hill.

## Running it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- `web` (Vite dev server) is the only public entry: host port 3000, proxying `/api` to `http://api:8000`. The app is same-origin — there is no CORS config and none is needed.
- `api` (FastAPI, uvicorn `--reload`) is also published on host port 8000; `/docs` is the OpenAPI UI.
- `db` is Postgres 16 with generated dev credentials inline in the compose file (local infra, not secrets).

## Things that bite

- **Scoring lives in the frontend** (`frontend/src/scoring.js`), not the backend: sliders must re-rank without a round-trip. The API returns raw prospect fields only. If you add a server-side consumer of the score, mirror that module rather than inventing a second formula.
- Weights are normalised by their sum, so sliders need not total 100 — do not "correct" the individual values.
- Value uses global assumptions stored in the `settings` row (id 1) and loaded on mount; `App.jsx` debounces PUTs 350 ms after a slider stops.
- Tables are created and the 25-prospect pipeline seeded in the FastAPI lifespan hook (`backend/app/seed.py`), only when `prospects` is empty. Seeded next-action dates are relative to the day of seeding, so "overdue" counts drift if the volume is old. Reset with `docker compose -f docker-compose.base44.yml down -v` (also wipes `web-node-modules`).
- `wait_for_db()` retries because Postgres' healthcheck can pass a moment before it accepts connections.
- Python deps live in the image (`backend/Dockerfile` copies only `requirements.txt`): adding a package means `up -d --build api`.
- npm deps live in the `web-node-modules` volume and install on container start; adding a package needs a container restart, not a rebuild.
- Vite accepts the preview host through `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`, passed bare into `web`. Without it the proxied host is rejected with "Blocked request".
- `Draft outreach` calls OpenAI when `OPENAI_API_KEY` is set (delivered from `/run/base44/app.env`, mounted as an optional `env_file`), and otherwise returns a template draft. Never hardcode a key; a template fallback is intentional so the button always works. The failure is silent, so an invalid or expired key looks exactly like having no key — when a draft reads generic, check the `activities` row it logged ("Outreach drafted (ai)…" vs "(template)…").
- `BASE44_PREVIEW_MODE` is passed to both app services; nothing branches on it today.

## Verifying

- `curl -s localhost:3000/api/health` → `{"status":"ok"}` proves the Vite proxy and API are both alive.
- `curl -s localhost:3000/api/prospects | head -c 200` returns seeded rows; an empty array on a fresh volume means seeding did not run.
- In the UI: the table is sorted by score descending; moving a weight slider re-ranks it; Follow-ups lists dates today or earlier with late ones in red; the drawer's stage change and Log follow-up persist (reopen to confirm).

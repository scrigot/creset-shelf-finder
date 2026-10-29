# Notes for working in this repo

Creset Shelf Finder is a prospect scoring + outreach tracker for a creatine water brand selling into gyms near UNC Chapel Hill.

## Running it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- `web` (Vite dev server) is the public entry: host port 3000, proxying `/api` to `http://api:8000`. The app is same-origin — there is no CORS config and none is needed.
- `api` (FastAPI, uvicorn `--reload`) is also published on host port 8000; `/docs` is the OpenAPI UI.
- `db` is Postgres 16 with generated dev credentials inline in the compose file (local infra, not secrets).
- Demo data is seeded only when `prospects` is empty (`SEED_DEMO_DATA=0` disables it; the test suite sets that).

## Deploying

- Production is the repo-root `Dockerfile`: stage 1 builds `frontend/dist`, stage 2 serves that bundle from FastAPI alongside `/api`, so a deployment is same-origin like the dev proxy and `frontend/src/api.js` needs no changes.
- `STATIC_DIR` is the only switch. The image sets it; the sandbox never does, so the static mount does not exist in development and Vite keeps serving the UI there. A deployment therefore adds no route the dev stack has to satisfy.
- `docker-compose.prod.yml` (separate project name, host port `8080`) is a single-host flavour of the same image; managed hosts only need the image plus a Postgres `DATABASE_URL`. No provider config is committed.

## Brand

The UI follows Creset's own identity (`drinkcreset.com`): off-white field `#f4f4f4`, near-black ink `#1a1a1a`, a single red accent `#e31d2b` reserved for overdue/late states, bold uppercase labels and pill controls. The wordmark is the brand's own black-on-transparent PNG, self-hosted at `frontend/public/creset-logo.png` (also the favicon). Brand colours live as CSS variables at the top of `frontend/src/styles.css`; the contact/outreach surfaces add their rules in `frontend/src/outreach.css` (imported after `styles.css` in `main.jsx`) and reuse those variables — keep new UI on the same tokens instead of inventing a palette. The map is a real Leaflet map (`frontend/src/components/MapView.jsx`, `leaflet` is a runtime dependency) on public OpenStreetMap raster tiles — no API key, so keep the OSM/CARTO-style providers that demand a key out of the tile URL. Pin colour comes from `scoreShade()` in `scoring.js`, which ramps light→dark for a light background.

## Things that bite

- **Scoring lives in the frontend** (`frontend/src/scoring.js`), not the backend: sliders must re-rank without a round-trip. The API returns raw prospect fields only. If you add a server-side consumer of the score, mirror that module rather than inventing a second formula.
- Weights are normalised by their sum, so sliders need not total 100 — do not "correct" the individual values.
- Value uses global assumptions stored in the `settings` row (id 1) and loaded on mount; `App.jsx` debounces PUTs 350 ms after a slider stops.
- Tables are created in the FastAPI lifespan hook (`Base.metadata.create_all`) and the 25-prospect pipeline seeded from `backend/app/seed.py`. `create_all` never alters an existing table, so a model change needs the old schema dropped (`docker compose … exec -T db psql -U crest -d crest -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'`) and the stack restarted — the demo pipeline reseeds itself.
- Seeded next-action dates are relative to the day of seeding, so "overdue" counts drift if the volume is old.
- `wait_for_db()` retries because Postgres' healthcheck can pass a moment before it accepts connections.
- Python deps live in the image (`backend/Dockerfile` copies only `requirements.txt`): adding a package means `up -d --build api`.
- npm deps live in the `web-node-modules` volume and install on container start (`npm ci`, so `package.json` and `package-lock.json` must move together).
- Vite accepts the preview host through `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`, passed bare into `web`; inside the sandbox `vite.config.js` also appends `3000-$BASE44_PUBLIC_HOST_SUFFIX` and `.$BASE44_SANDBOX_HOST_DOMAIN` to `allowedHosts` when `BASE44_PREVIEW_MODE === "1"`. Without either, the proxied host is rejected with "Blocked request".
- **Find contact** calls the OpenAI Responses API with the `web_search` tool and a strict JSON schema (`backend/app/services/llm.py`). The key arrives via `/run/base44/app.env`; with no key the endpoint returns 503 and the UI shows that message. A search can take up to a minute — the UI keeps its loading state.
- **Email policy lives in code, not only in the prompt**: `contact_search.normalize_candidates` caps results at three, dedupes by name, drops invalid addresses, repairs typographic hyphens, and forces `confidence = "low"` on any `guessed` address. Keep those guarantees if you touch the prompt.
- **Scoring type -> contact rule.** Prospect types are the pipeline's labels (`strength`, `crossfit`, `boutique`, `big-box`, `yoga/spin`, `campus rec`, `run club`); `contact_search.TYPE_RULES` maps each to the role to chase. A new type falls back to "whoever decides what the gym stocks".
- **Primary contact** is the saved contact flagged `is_primary`; saving a new one demotes the rest. The table, the drawer and the draft all read through `sorted_contacts` / `primary_contact` in `backend/app/routers/contacts.py`.
- **Two surfaces, one implementation.** Find contact appears in the prospect drawer and on the *Find & outreach* view. Both use `frontend/src/components/ContactsPanel.jsx` and `frontend/src/hooks/useContactSearch.js`; the email is `components/OutreachDraft.jsx`. Fix the shared pieces, not each screen.
- **Outreach draft** (`backend/app/outreach.py`) is contact-aware: the template greets the primary contact by first name and names their role, and falls back to the gym team without one. It uses OpenAI when `OPENAI_API_KEY` is set and the written template otherwise — the AI failure is silent, so a generic draft means no working key; the `activities` row logs "(ai)" or "(template)".
- `BASE44_PREVIEW_MODE` is passed to both app services; only `vite.config.js` branches on it.

## Verifying

- `docker compose -f docker-compose.base44.yml exec -T api python -m pytest -q` — contact rules, API surface and the pipeline endpoints (uses `/tmp/crest_test.db`, no network).
- `curl -s localhost:3000/api/health` → `{"status":"ok"}` proves the Vite proxy and API are both alive; `curl -s localhost:3000/api/prospects | head -c 200` returns seeded rows.
- `curl -X POST localhost:3000/api/prospects/1/find-contact` exercises the real web search end to end and takes tens of seconds.
- To prove the UI without spending a real search, point `OPENAI_BASE_URL` at a local stub of `POST /v1/responses` via a temporary Compose override and remove it afterwards — never commit stubbed data or a fake key.
- In the UI: the table is sorted by score descending; moving a weight slider re-ranks it; Follow-ups lists dates today or earlier with late ones in red; the drawer's stage change and Log follow-up persist (reopen to confirm); Find & outreach keeps the selected prospect and shows the saved contact in the draft's To field.

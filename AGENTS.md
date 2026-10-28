# Notes for working in this repo

## Running it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- `web` (Vite dev server) is the only public entry: host port 3000. It proxies `/api` to `http://api:8000`, so the app is same-origin — no CORS config exists or is needed.
- `api` (FastAPI, uvicorn `--reload`) is also published on host port 8000 for direct API work; `/docs` is the OpenAPI UI.
- `db` is Postgres 16 with generated dev credentials inline in the compose file (not secrets — local infrastructure only).

## Things that bite

- Tables are created and the demo collection is seeded in the FastAPI lifespan hook (`backend/app/seed.py`), only when the `shelves` table is empty. Reset the demo data with `docker compose -f docker-compose.base44.yml down -v` (this also wipes `web-node-modules`, so the next boot reinstalls npm deps).
- `wait_for_db()` retries because Postgres' healthcheck can pass a moment before it accepts connections; without it `create_all` fails on first boot.
- Python dependencies live in the image (`backend/Dockerfile` copies only `requirements.txt`), so adding a package means `up -d --build api`.
- npm dependencies live in the `web-node-modules` volume and are installed on container start from `frontend/package.json`; adding a package needs a container restart, not a rebuild.
- Vite accepts the preview host through `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`, passed bare into the `web` service. Without it the proxied host is rejected with "Blocked request".
- `BASE44_PREVIEW_MODE` is passed to both app services. Nothing branches on it today; gate any sandbox-only override on `=== "1"`.

## Verifying

- `curl -s localhost:3000/api/health` → `{"status":"ok"}` proves the Vite proxy and the API are both alive (the `web` healthcheck probes exactly this plus `/`).
- `curl -s 'localhost:3000/api/items?q=raven'` returns the seeded plaque; an empty array on a fresh volume means seeding did not run.
- The UI has three flows: free-text search, shelf filter (left panel), and the "Add item" form.

# Crest Shelf Finder

A small fullstack app that catalogues crest-marked pieces (plaques, goblets, seals) and tells you which shelf each one sits on.

## Stack

- `frontend/` — React 18 + Vite dev server, served on port 3000; proxies `/api` to the backend so everything is same-origin.
- `backend/` — FastAPI + SQLAlchemy, listens on port 8000.
- `db` — Postgres 16, seeded with a demo collection on first start (only when the shelves table is empty).

## Running it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

The UI is on http://localhost:3000 and the API on http://localhost:8000 (docs at `/docs`).

## API

| Method | Path                   | Purpose                                   |
| ------ | ---------------------- | ----------------------------------------- |
| GET    | `/api/health`          | Liveness, also used by the compose healthcheck |
| GET    | `/api/shelves`         | Shelves with item counts                  |
| GET    | `/api/items?q=&shelf_id=` | Search across name, crest, category, slot, shelf and room |
| POST   | `/api/items`           | Add an item to a shelf                    |

## Sandbox notes

- `BASE44_PREVIEW_MODE` is passed through to services. When it equals `"1"` the environment is a Base44 sandbox; nothing in this app currently branches on it.
- Vite is given the preview host through `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` (Compose passes the platform's value through), so dev assets and HMR work behind the preview proxy.
- The backend waits for Postgres (`wait_for_db`) before creating tables, because the container healthcheck can pass a moment before connections are accepted.

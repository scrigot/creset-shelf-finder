# Crest Shelf Finder

A prospecting tool for Crest: it ranks gyms that could stock Crest drinks and
supplements, finds the person who decides what goes on their shelf, and drafts the
first outreach email.

## What it does

- **Ranked prospect table** — gyms ordered by fit score, with the primary contact
  in the Contact column and a green dot when that person's email is verified or
  listed publicly.
- **Prospect detail** — gym name, type, address, website, Instagram, fit score and
  every contact on file.
- **Find contact** — runs one LLM request with internet context (OpenAI Responses
  API + the `web_search` tool) against the gym's website, Google Business listing,
  Instagram, LinkedIn and local news. It targets the role that owns drinks and
  supplement purchasing for that gym type, and returns up to three candidates,
  best first, each with a source URL.
- **Contact cards** — name, role, email with a status badge (verified / listed
  publicly / guessed / no email), confidence, source link and one line of
  reasoning. *Use this contact* saves the person as primary; *Not right* hides the
  card; *Re-run search* starts over.
- **Find & outreach page** (`/outreach`) — a workspace that pairs the ranked
  prospect list with the contact search and the outreach email, so a founder,
  owner or general manager can be found and written to without changing screens.
- **Draft outreach** — addresses the primary contact by first name and mentions
  their role, with their email already in the To field.

## Email rules

The search never invents an address. Enforced in
`backend/app/services/contact_search.py`:

- No published email → the gym's general address is used and marked
  `listed_publicly`, or `none` when there is only a contact form.
- A pattern guess must be marked `guessed`, and the server forces its confidence to
  `low`.
- Invalid addresses are dropped rather than shown.
- Typographic hyphens copied from web pages are repaired to `-`.

## Pages

| Route | Page |
| --- | --- |
| `/` | Ranked prospect table |
| `/prospects/:id` | Prospect detail with contact search and saved contacts |
| `/outreach` | Find & outreach workspace (pick a prospect, search, draft) |

## Stack

- `backend/` — FastAPI + SQLAlchemy + PostgreSQL, served by uvicorn with `--reload`
- `frontend/` — React + Vite dev server on port 3000, proxying `/api` to the API
  (single origin, so no CORS or cookie settings are needed)
- `db` — PostgreSQL 16 with a named volume

## Run it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

The app is at http://localhost:3000. Demo prospects are seeded once, when the
prospects table is empty.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Set by Compose to the local Postgres service |
| `OPENAI_API_KEY` | Enables Find contact's live web search. Delivered by the platform to `/run/base44/app.env`; without a key the endpoint returns a clear 503 instead of guessing |
| `OPENAI_MODEL` | Defaults to `gpt-4.1` |
| `OPENAI_BASE_URL` | Defaults to `https://api.openai.com/v1` |
| `SEED_DEMO_DATA` | `0` disables demo seeding (the tests set it) |

## Tests

```bash
docker compose -f docker-compose.base44.yml exec -T api python -m pytest -q
```

The suite uses a throwaway SQLite file at `/tmp/crest_test.db`, so it never touches
the development database or the network.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/prospects` | Ranked table with primary contacts |
| `GET` | `/api/prospects/{id}` | Prospect detail with contacts |
| `POST` | `/api/prospects/{id}/find-contact` | Web-search contact candidates |
| `POST` | `/api/prospects/{id}/contacts` | Save a contact (primary demotes others) |
| `POST` | `/api/prospects/{id}/outreach-draft` | Build the outreach email |
| `GET` | `/api/health` | Health check |

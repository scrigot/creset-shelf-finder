# Agent notes

## Running

- `docker compose -f docker-compose.base44.yml up -d --build`; app on host port
  3000, API internal at `api:8000`, PostgreSQL in the `db` service.
- Frontend changes hot-reload. Backend runs `uvicorn --reload` on `/app/app`, so
  Python edits reload too; restart `api` only after dependency or env changes.
- Demo data is seeded only when the `prospects` table is empty (`SEED_DEMO_DATA=0`
  disables it; the test suite sets that).

## Non-obvious details

- **Single origin.** The browser only talks to port 3000; Vite proxies `/api` to
  `api:8000`, so there is no CORS configuration and no cross-site session issue.
  Do not expose the API on its own host port without adding CORS.
- **Vite host allowlist.** Vite 5.4 does not read
  `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`, so `frontend/vite.config.js` appends
  `3000-$BASE44_PUBLIC_HOST_SUFFIX` and `.$BASE44_SANDBOX_HOST_DOMAIN` to
  `server.allowedHosts` only when `BASE44_PREVIEW_MODE === "1"`. Without it the
  preview proxy gets a 403 "Blocked request" page from the dev server. The
  variables are passed through as bare Compose `environment:` entries.
- **Find contact** calls the OpenAI Responses API with the `web_search` tool and a
  strict JSON schema (`backend/app/services/llm.py`). The key arrives via
  `/run/base44/app.env`; with no key the endpoint returns 503 and the UI shows that
  message. Requests can take up to a minute — the UI keeps its loading state.
- **Email policy lives in code, not only in the prompt**:
  `contact_search.normalize_candidates` caps results at three, dedupes by name,
  drops invalid addresses, repairs typographic hyphens, and forces
  `confidence = "low"` on any `guessed` address. Keep those guarantees if you
  touch the prompt.
- **Primary contact** is the saved contact flagged `is_primary`; saving a new one
  demotes the rest. The ranked table and the outreach draft both read through the
  same helper in `backend/app/routers/prospects.py`.
- **Two surfaces, one implementation.** Find contact appears on the prospect
  detail page and on the `/outreach` workspace. Both use
  `frontend/src/hooks/useContactSearch.js` and
  `frontend/src/components/CandidateList.jsx`; the email is
  `components/OutreachForm.jsx` (wrapped in `DraftOutreachDialog` on the detail
  page, inline on `/outreach`). Fix the shared pieces, not each page.
- **Outreach deep link.** `/outreach?prospect=<id>` opens that gym; the detail
  page links to it.
- **Outreach draft** is built from a template in
  `backend/app/services/outreach.py` (no LLM), so it is deterministic and free.

## Verifying

- `docker compose -f docker-compose.base44.yml exec -T api python -m pytest -q`
  (uses `/tmp/crest_test.db`, no network).
- `curl -X POST localhost:3000/api/prospects/1/find-contact` exercises the real web
  search end to end and takes tens of seconds.
- To prove the UI without spending a real search, point `OPENAI_BASE_URL` at a
  local stub of `POST /v1/responses` via a temporary Compose override and remove it
  afterwards — never commit stubbed data or a fake key.

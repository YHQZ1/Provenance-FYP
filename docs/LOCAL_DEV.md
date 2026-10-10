# Local development

## Prerequisites

- **Docker Desktop** with at least 8 GB of memory. The classifier, OCR and Ollama together are heavy; with too little, containers are killed with exit code 137.
- **Node 20 or newer** (CI uses Node 22).
- **Python 3.11**, only for running the Python service tests outside Docker.
- **A Supabase project**, plus `psql` if you want to apply migrations from the terminal.
- **GNU Make**; the version that ships with macOS works.

## 1. Environment files

None of these are committed. Copy each example and fill it in:

```bash
cp apps/backend-service/.env.example apps/backend-service/.env.development
cp apps/web-app/.env.example        apps/web-app/.env.development
cp apps/rag-classify/.env.example   apps/rag-classify/.env
cp infra/.env.example                infra/.env
```

| File | Key values |
| --- | --- |
| `backend-service/.env.development` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Docker Compose overrides the service URLs with container hostnames. |
| `web-app/.env.development` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL=http://localhost:3000` |
| `infra/.env` | Every port and service address the Docker stack uses (`REDIS_URL`, `OLLAMA_HOST`, `OCR_SERVICE_URL`, `CORS_ORIGIN`, `PUBLIC_API_URL`, and so on). Compose and the Makefile both read it; nothing is hardcoded. Change a port or address here. |
| `rag-classify/.env` | `DATABASE_URL`: the Supabase Postgres connection string (Project Settings → Database). The `db-*` make targets read it too. |

The service-role key and database URL are full-access credentials. Keep them out of the frontend and out of git.

## 2. Supabase

1. **Schema.** Apply `supabase/migrations/000` → `007`, then `supabase/seed.sql`. See [DATABASE.md](DATABASE.md#migrations).
2. **Auth providers.** Enable Email, plus Google and Azure if you want social sign-in.
3. **Redirect URLs.** Under Authentication → URL Configuration, add `http://localhost:5173/**`. Without it, sign-in and password reset send you to the deployed site.
4. **Storage.** Create a **private** bucket named `documents`; the backend stores uploads there. Migrations don't create buckets. The app shows files through signed URLs, so the bucket needs no client policies.

## 3. Run

```bash
make up        # build and start all eight services; the app is at FRONTEND_URL in infra/.env
make models    # first run: pull llama3.2:3b into the Ollama container
make ingest    # first run: download and index the regulatory sources (a few minutes)
make bench     # optional: time the slow paths, to compare before and after a change
make status    # health of every service
```

The first `make up` takes a while. It downloads images and the embedding model, and on Apple Silicon the OCR image runs under amd64 emulation.

## Kubernetes instead of Docker Compose

The same stack runs on a local Kubernetes cluster from a Helm chart. See [KUBERNETES.md](KUBERNETES.md).

## Everyday commands

Run `make` to list everything. Stack commands act on all services unless you pass `s=<service>` (`frontend`, `backend`, `ocr-service`, `rag-classify`, `rag-regulatory`, `qdrant`, `ollama`).

```bash
make logs s=backend        # follow one service's logs
make rebuild s=frontend    # rebuild and recreate after code changes
make restart s=ocr-service # restart without rebuilding
make stop / make start     # pause and resume containers
make down                  # remove containers (volumes, models and indexes are kept)
make shell s=backend       # shell inside a container
make db-shell              # psql on the Supabase database
make db-migrate f=supabase/migrations/007_x.sql
```

Containers copy the source in at build time, so code changes need `make rebuild s=<service>`.

## Running one service outside Docker

This is useful for fast reloads while working on the backend or the frontend.

```bash
make up                    # everything else in Docker
make stop s=backend
cd apps/backend-service && npm run dev
```

Outside Docker, the backend can't resolve container hostnames, so point it at the published ports in `.env.development`:

```dotenv
OCR_SERVICE_URL=http://localhost:8000
RAG_SERVICE_URL=http://localhost:8001
REGULATORY_RAG_URL=http://localhost:8002
```

The frontend works the same way: `make stop s=frontend`, then `cd apps/web-app && npm run dev`.

## Tests

```bash
make setup     # once: npm installs plus a .venv for the Python tests
make check     # what CI runs: lint, every test suite, the web build
make format    # Prettier for JS, CSS and JSON; Black for Python
make test-backend   # or test-web, test-ocr, test-classify, test-regulatory
make e2e            # the browser test: starts a local Supabase in Docker (about 1.5 GB)
make e2e-stop       # stops that Supabase again
```

| Suite | Runner | Covers |
| --- | --- | --- |
| Web app | Vitest + Testing Library | Pages render, review keyboard flow, filing states |
| Backend | `node --test` | Auth middleware, filing summary, finalized-year rules, quantity and date normalisation |
| OCR | pytest | Line-item and date parsing, PDF page handling, concurrent requests |
| Classifier | pytest | Category taxonomy, model response parsing |
| Regulatory | pytest | Header stripping, chunking, prompt building |
| End to end | Playwright | Sign up, set the profile, upload, review every line, finalize, export a CSV, in a real browser against the real backend and a local Supabase |

The unit tests need no network or credentials, and CI runs them with no `.env` files. Keep it that way: a unit test must not import a module that creates the Supabase client.

### The end-to-end test

`make e2e` runs the Supabase CLI (`supabase/config.toml`) to start Postgres, Auth and Storage in Docker, applies every migration and the seed, creates the `documents` bucket, then Playwright starts the backend and a production build of the web app against it. The backend runs with `USE_MOCK_SERVICES=true`, so no OCR, classifier or language model is needed: the mock returns three invoice lines with no material, which the test then classifies by hand in Review. Everything else is real: sign-up, the company profile, storage, the database, finalization and the CSV export.

The test creates its own account with a timestamped email, so reruns need no cleanup. It uses ports 3100 and 5174, so it won't clash with the stack on 3000 and 5173. On a failure, Playwright keeps a screenshot and a trace in `apps/web-app/test-results/`; open a trace with `npx playwright show-trace`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The `ollama` container won't start, or the port is already in use | The Ollama Mac app is also using port 11434. Quit it, or remove the `ollama` port mapping. |
| A container exits with code 137 | Out of memory. Give Docker more memory, or stop services you don't need. |
| Backend logs show `ENOTFOUND ocr-service` | The backend is running outside Docker with container hostnames. Use the `localhost` URLs above. |
| Backend warns "Missing optional schema" | A migration hasn't been applied. The message names it. Apply it with `make db-migrate`. |
| Sign-in or password reset lands on the deployed site | `http://localhost:5173/**` isn't in Supabase's Redirect URLs. |
| Regulatory research says the source library is unavailable | The index is empty or the service is down. Run `make ingest` and check `make logs s=rag-regulatory`. |
| Every line comes back "Needs material" | The classifier can't reach Ollama, or the model isn't pulled. Run `make models`, then `make logs s=rag-classify`. |
| An upload says "Already uploaded as …" | Working as intended. The same file exists, possibly dated in another financial year. The message names the year. |
| Documents stay "Queued" | The worker isn't running or can't reach Redis. Check `make status` and `make logs s=backend` for `[Worker]` lines. |
| A change doesn't show up (for example, after editing data directly in the database) | The cache only knows about changes made through the API. Run `make cache-clear`. |
| A document failed "after 3 attempts" | The message names the service that failed. Fix it (`make status`), then press Retry. |

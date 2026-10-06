# Local Development

This is the current canonical local-dev note while the repo is being wired into one product.

## Current Canonical Entry Points

```bash
# Shared Qdrant, Ollama, classifier, and regulatory RAG runtime
cp apps/rag-classify/.env.example apps/rag-classify/.env
# Set DATABASE_URL in apps/rag-classify/.env to your Supabase PostgreSQL connection string.
docker compose -f infra/docker-compose.yaml up -d
docker exec -it infra-ollama-1 ollama pull llama3.2:3b

# Seed regulatory sources (after the regulatory service is healthy)
# Re-run after changing sources.yaml; each source's old chunks are replaced.
docker exec infra-rag-regulatory-1 python scripts/ingest.py --config src/config/sources.yaml

# Database: apply supabase/migrations in order, then supabase/seed.sql
# (Supabase SQL editor, or `supabase db push` followed by `supabase db reset` for the seed locally)
#   000_baseline.sql creates the core tables. Skip it on a project that already has them.
#   001_fy_filings.sql enables finalizing a financial year on the Filing page.
#   002_classification_category.sql stores the CPCB category for each classified line.
#   003_company_epr_registration.sql stores the company's CPCB EPR registration number.
#   004_review_audit_and_upload_dedupe.sql records who reviewed each line and blocks duplicate uploads.
#   005_lock_down_public_access.sql stops the public anon key from reading other companies' data.
#   seed.sql loads the polymer list and trade-name synonyms the classifier needs.

# Backend API
cd apps/backend-service
cp .env.example .env.development
npm install
npm run dev

# Frontend
cd apps/web-app
cp .env.example .env
npm install
npm run dev
```

## Service Notes

- `apps/backend-service` expects Supabase-style environment variables and currently uses Supabase client APIs.
- Supabase PostgreSQL is the database source of truth; the local Compose stack does not run PostgreSQL.
- `apps/ocr-service` serves `POST /v1/ocr` (PDF, JPEG, PNG, TIFF) on port 8000.
- The frontend needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` (see `apps/web-app/.env.example`).
- `apps/rag-classify` runs from the shared infra compose and reads Supabase data through its configured PostgreSQL connection.
- `apps/rag-regulatory` provides authenticated regulatory research through the backend at /api/regulatory/query; it does not submit filings.

## Immediate Hygiene Target

The next cleanup step should be one of:

1. Replace service-local compose files with one root compose.
2. Add filing-specific regulatory guidance and citation review to the report workflow.
3. Convert frontend dummy views to API-backed states.

# Local Development

This is the current canonical local-dev note while the repo is being wired into one product.

## Current Canonical Entry Points

```bash
# Local database dependency
docker compose -f infra/docker-compose.yaml up -d

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
- `infra/postgres/init.sql` provides a local Postgres schema, but the backend is not fully converted to direct local Postgres access.
- `apps/ocr-service` has OCR engine modules, but the FastAPI app entrypoint is not implemented yet.
- `apps/rag-classify` has its own service-local compose for Qdrant/Ollama/RAG. It is not yet wired into the backend's external RAG adapter.
- `apps/rag-regulatory` is an adjacent regulatory chatbot/scraper service and should not block the first EPR upload-review-report flow.

## Immediate Hygiene Target

The next cleanup step should be one of:

1. Replace service-local compose files with one root compose.
2. Wire backend adapters to real OCR/RAG services.
3. Convert frontend dummy views to API-backed states.

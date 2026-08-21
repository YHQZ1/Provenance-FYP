# Local Development

This is the current canonical local-dev note while the repo is being wired into one product.

## Current Canonical Entry Points

```bash
# Shared Qdrant, Ollama, and classifier runtime
cp apps/rag-classify/.env.example apps/rag-classify/.env
# Set DATABASE_URL in apps/rag-classify/.env to your Supabase PostgreSQL connection string.
docker compose -f infra/docker-compose.yaml up -d
docker exec -it provenance-ollama ollama pull llama3.2:3b

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
- `apps/ocr-service` has OCR engine modules, but the FastAPI app entrypoint is not implemented yet.
- `apps/rag-classify` runs from the shared infra compose and reads Supabase data through its configured PostgreSQL connection.
- `apps/rag-regulatory` is an adjacent regulatory chatbot/scraper service and should not block the first EPR upload-review-report flow.

## Immediate Hygiene Target

The next cleanup step should be one of:

1. Replace service-local compose files with one root compose.
2. Wire backend adapters to real OCR/RAG services.
3. Convert frontend dummy views to API-backed states.

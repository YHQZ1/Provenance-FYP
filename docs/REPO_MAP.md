# Provenance Repo Map

This repo is being consolidated around one end-to-end MVP:

```text
upload document -> OCR -> material classification -> human review -> filing aggregation -> dashboard/report
```

The current codebase has useful pieces, but several are still service-local or mocked. Treat this file as the canonical map while cleanup is in progress.

## Canonical Areas

| Path | Role | Current status |
| --- | --- | --- |
| `apps/web-app` | React/Vite frontend | Real screens exist, but some views still assume dummy or incomplete backend data. |
| `apps/backend-service` | Express orchestration API | Main API surface. Document uploads now call the real OCR service; RAG remains a local/mock adapter. |
| `apps/ocr-service` | OCR engine/service | FastAPI OCR API is containerized and accepts PDF/JPEG/PNG/TIFF uploads at `/v1/ocr`. |
| `apps/rag-classify` | Plastic material classification service | FastAPI service exists with Qdrant/Ollama pipeline. Not wired into backend adapter yet. |
| `apps/rag-regulatory` | Regulatory RAG chatbot/scrapers | Useful adjacent service, not part of the first EPR document pipeline spine. |
| `infra/postgres` | Local Postgres schema | Local schema derived from Supabase dump; backend still uses Supabase client semantics. |
| `infra/docker-compose.yaml` | Current local dependency compose | Canonical compose entry for now. It currently starts Postgres only. |
| `docs` | Cross-repo project docs | New home for repo-level architecture, setup, and cleanup notes. |

## Cleanup Rules

- Keep one root-level README for product/architecture orientation.
- Put cross-service setup instructions in `docs/`.
- Do not add service-local READMEs unless a service needs deep standalone documentation; prefer root README plus `docs/`.
- Keep ignore policy centralized in the root `.gitignore`.
- Prefer `infra/docker-compose.yaml` as the canonical compose entry until a root compose replaces it.
- Do not add generated data, local uploads, model caches, virtualenvs, or `node_modules` to git.
- Treat `apps/rag-regulatory` as optional/adjacent until the core upload-review-report pipeline is stable.

## Known Mismatches

- The root README describes a broader deterministic BRSR/carbon compliance engine, while the implemented app is currently closest to Plastic EPR document processing.
- Backend RAG classification is still local/mock; the OCR adapter now calls the containerized OCR service.
- Multiple compose files exist. They are not equivalent and should not all be considered canonical.

## Cleanup Decision Log

These items are intentionally not removed in the first hygiene pass, but should be decided soon:

| Item | Current state | Recommended decision |
| --- | --- | --- |
| `apps/ocr-service/poppler/` | Tracked vendored Windows Poppler payload, about 47 MB. | Remove from git and document install/download, unless Windows offline support is a hard requirement. |
| `apps/ocr-service/poppler.zip` | Tracked binary archive, about 14 MB. | Remove from git if `poppler/` is removed. Do not keep both extracted and zipped copies. |
| Service-local compose files | Present in `apps/rag-classify` and `apps/rag-regulatory`. | Fold required services into one canonical root/infra compose, then delete or mark legacy. |
| Service-local READMEs/notes | Consolidated into the root README in the first hygiene pass. | Keep deleted unless a service becomes independently deployable and needs standalone docs. |
| Service-local `.gitignore` files | Consolidated into the root `.gitignore`. | Keep deleted; add new ignore patterns at the root. |
| Sample invoices/images | Tracked under `apps/ocr-service`. | Move to `fixtures/ocr/` if they are needed for tests; otherwise remove. |

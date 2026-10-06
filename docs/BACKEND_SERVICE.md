# Backend Service

`apps/backend-service` is the orchestration API for the document workflow:

```text
frontend upload -> backend -> Supabase Storage -> OCR service -> RAG classifier -> review
```

## Local setup

```bash
cd apps/backend-service
npm ci
cp .env.example .env.development
# Fill in the Supabase and service connection values
npm run dev
```

The backend listens on `http://localhost:3000`. The document upload endpoint is:

```text
POST /api/documents/upload
```

It expects an authenticated multipart request with the field name `file`. Supported files currently match the OCR service: PDF, JPEG, PNG, and TIFF, up to 10 MB.

## OCR connection

Set these values in the active environment file:

```dotenv
OCR_SERVICE_URL=http://localhost:8000
OCR_TIMEOUT_MS=120000
USE_MOCK_SERVICES=false
```

When the upload is accepted, the backend stores the file, creates a `PENDING` document, and asynchronously sends the file bytes to `POST /v1/ocr`. The OCR response is persisted in `documents.raw_text` and `documents.extracted_data`. Material classification starts only after the OCR response is received.

For Docker networking, use the OCR container service name instead of `localhost`, for example `http://ocr-service:8000`.

## RAG classifier connection

The backend sends each extracted OCR line item to `POST /classify` on the RAG classifier. The backend owns persistence in Supabase and stores the classifier's material code, confidence, reasoning, matched synonym, vector similarity, and normalized quantity.

For local Node development with the classifier running through the shared infra compose:

```dotenv
RAG_SERVICE_URL=http://localhost:8001
RAG_TIMEOUT_MS=180000
```

For a backend container attached to the same Docker network as the classifier, use the Compose service hostname:

```dotenv
RAG_SERVICE_URL=http://rag-classify:8001
```

Each upload carries a `document_type`: `purchase_invoice`, `recycling_certificate`, `collection_receipt`, or `epr_record`. EPR records are stored as evidence and are not quantified. Re-uploading the same file is rejected with `409` so quantities are never counted twice.

The document status flow is:

```text
PENDING -> OCR_PROCESSING -> RAG_PROCESSING -> CLASSIFIED -> REVIEW_PENDING -> VERIFIED
                \-> OCR_FAILED (retry with POST /api/documents/:id/retry)
```

The classifier only suggests. Every line is confirmed by a person in Review, either individually or in bulk for high-confidence suggestions (`POST /api/feedback/approve-suggested`), so `verified_by_user` always means a human reviewed it. Lines can be approved, corrected, or excluded.

Filing is per Indian financial year (April-March). A document counts toward the year of its invoice date, falling back to its upload date. `GET /api/compliance/filing?fy=2026` returns totals split by document type, the open blockers, and the evidence list. `POST /api/compliance/filing/finalize` stores a snapshot in `fy_filings` (see `supabase/migrations`).

Each classified line also carries its CPCB category (I rigid, II flexible, III multilayered with a non-plastic layer, IV compostable) once `supabase/migrations/002_classification_category.sql` is applied; filing totals are then split by category. Until then the backend detects the missing column at startup and skips category storage.

A finalized financial year is read-only: review actions, date changes, retries, and deletes on its documents return `409` until the year is reopened.

`GET /api/system/status` reports whether the OCR, classifier, and regulatory services are reachable and which optional schema features are enabled.

Documents left mid-processing by a restart are marked `OCR_FAILED` on startup so they can be retried.

## Docker

Build and run the backend container from the service directory:

```bash
cd apps/backend-service
docker build -t provenance-backend .
docker run --rm --name provenance-backend -p 3000:3000 \
  --env-file .env.development \
  -e OCR_SERVICE_URL=http://host.docker.internal:8000 \
  -e RAG_SERVICE_URL=http://host.docker.internal:8001 \
  provenance-backend
```

The `host.docker.internal` value lets the backend container reach OCR and RAG services running on the host machine. In a shared Docker Compose network, use their service hostnames instead.

## Hygiene

Runtime uploads, local environment files, `node_modules`, and operating-system metadata are ignored by the root `.gitignore`. Do not commit `.env.development`, `.env.production`, `uploads/`, or `node_modules/`.

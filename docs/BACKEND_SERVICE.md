# Backend Service

`apps/backend-service` is the orchestration API for the document workflow:

```text
frontend upload -> backend -> Supabase Storage -> OCR service -> classification -> review
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

## Docker

Build and run the backend container from the service directory:

```bash
cd apps/backend-service
docker build -t provenance-backend .
docker run --rm --name provenance-backend -p 3000:3000 \
  --env-file .env.development \
  -e OCR_SERVICE_URL=http://host.docker.internal:8000 \
  provenance-backend
```

The `host.docker.internal` value lets the backend container reach an OCR container running on the host machine. In a shared Docker Compose network, use `http://ocr-service:8000` instead.

## Hygiene

Runtime uploads, local environment files, `node_modules`, and operating-system metadata are ignored by the root `.gitignore`. Do not commit `.env.development`, `.env.production`, `uploads/`, or `node_modules/`.

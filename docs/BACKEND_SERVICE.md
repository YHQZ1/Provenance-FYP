# Backend service

`apps/backend-service` is the Express API the web app talks to. It is the only component that writes application data. It authenticates requests, enforces the filing rules, stores files, and orchestrates OCR and classification.

## Layout

```text
src/
  app.js, server.js        Express app, startup (schema probe, interrupted-work recovery)
  config/                  env.js (validated settings), database.js (Supabase clients), schema.js (optional-schema probe)
  middleware/              auth (Bearer JWT), upload (multer, 10 MB), errors
  routes/, controllers/    HTTP layer: parse, validate, call a service, shape the response
  services/
    internal/              document, feedback (review), compliance (filing), company
                           filing.summary.js: pure ledger and blocker logic (unit-tested)
                           filing.lock.js: finalized-year rules
                           obligation.calc.js, trade-names.js: pure obligation and trade-name logic (unit-tested)
                           activity, obligation and materials services for the workspace tools
    external/              ocr, rag (classifier), regulatory clients; normalization.js (units, dates, FY)
    storage.service.js     Supabase Storage
  utils/errors.js          AppError and helpers (badRequest, notFound, conflict, …)
test/                      node --test suites; no network or credentials needed
```

## Running

The usual way is the whole stack: `make up`, `make logs s=backend`, `make rebuild s=backend`. To run it on its own with reload, see [LOCAL_DEV.md](LOCAL_DEV.md#running-one-service-outside-docker):

```bash
cd apps/backend-service
npm ci
npm run dev        # http://localhost:3000, reads .env.development
npm test
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | required | Database, storage and token verification |
| `PORT` | required | |
| `CORS_ORIGIN` | | The web app's origin |
| `OCR_SERVICE_URL`, `OCR_TIMEOUT_MS` | `300000` | OCR service; `http://ocr-service:8000` in Compose |
| `RAG_SERVICE_URL`, `RAG_TIMEOUT_MS` | `180000` | Material classifier |
| `RAG_CONCURRENCY` | `2` | Lines classified in parallel per document |
| `REGULATORY_RAG_URL`, `REGULATORY_RAG_TIMEOUT_MS` | `180000` | Regulatory research |
| `USE_MOCK_SERVICES` | `false` | Canned OCR and classification results, for UI work without the ML stack |
| `EPR_PORTAL_URL`, `EPR_GUIDANCE_MANUAL_URL` | empty | CPCB links shown as the filing's sources. Omitted when empty. |
| `OLLAMA_HOST`, `OLLAMA_MODEL` | empty | The model Trace uses; the same Ollama and model as the RAG services. Trace returns 503 while unset. |
| `TRACE_RATE_LIMIT` | `20` | Trace questions per user per 5 minutes |
| `REDIS_URL` | empty | Queue and cache; `redis://redis:6379` in Compose. Empty processes documents in the API process with no cache. |
| `PROCESSING_CONCURRENCY` | `2` | Documents processed at once |
| `PROCESSING_ATTEMPTS` | `3` | Attempts before a document is marked failed |
| `RUN_WORKER` | `true` | `false` makes the process API-only; run `npm run worker` alongside it |
| `ADMIN_USER`, `ADMIN_PASSWORD` | empty | Login for the queue dashboard at `/admin/queues`; it's off while either is empty |

The environment file is chosen by `NODE_ENV`: `.env.development` by default, `.env.production` with `npm start`.

## API

Every route except `GET /health` needs `Authorization: Bearer <Supabase access token>`. Responses are `{ success, data, … }`; errors are `{ success: false, message, code?, details? }` with a proper 4xx status.

### Account and company

| Method | Path | Does |
| --- | --- | --- |
| `POST` | `/api/auth/sync` | Called after sign-in; makes sure the company row exists |
| `GET` | `/api/auth/me` | Current user and company |
| `POST` | `/api/auth/logout` | |
| `GET` | `/api/company/me` | The caller's company |
| `POST`, `PATCH` | `/api/company` | Create or update the profile: name, GSTIN, PIBO categories, EPR registration number (validated) |

### Documents

| Method | Path | Does |
| --- | --- | --- |
| `POST` | `/api/documents/upload` | Multipart: `file`, plus `document_type` (`purchase_invoice`, `recycling_certificate`, `collection_receipt` or `epr_record`). Returns at once; processing continues in the background. |
| `GET` | `/api/documents` | List with stage, financial year, line counts and filing position |
| `GET` | `/api/documents/:id` | Detail with lines, OCR text and a 10-minute signed file URL |
| `PATCH` | `/api/documents/:id` | Set `document_date`, which moves the document to that date's financial year |
| `POST` | `/api/documents/:id/retry` | Re-run processing for a failed document |
| `DELETE` | `/api/documents/:id` | Delete the document, its lines and the stored file |

### Review

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/feedback/queue?document_id=` | Lines waiting for a decision, each with a `suggested` flag and lock state |
| `POST` | `/api/feedback/:id/approve` | Accept the suggestion as is |
| `POST` | `/api/feedback/:id/correct` | `{ material_code, quantity_kg, cpcb_category?, notes? }`, then approve |
| `POST` | `/api/feedback/:id/exclude` | `{ reason }`: kept on record, counts toward nothing |
| `POST` | `/api/feedback/approve-suggested` | Approve every complete, high-confidence line (optionally for one document) |

### Filing and research

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/compliance/filing?fy=2026` | Totals, blockers, warnings, documents, status, snapshot and late documents for the year (start year) |
| `POST` | `/api/compliance/filing/finalize` | `{ fy, notes? }`: store the snapshot. `409` if blockers remain. |
| `POST` | `/api/compliance/filing/reopen` | `{ fy }`: remove the snapshot |
| `POST` | `/api/compliance/filing/regulatory-review` | `{ fy }`: ask the regulatory service to review the year's position |
| `POST` | `/api/regulatory/query` | `{ query }`: an answer with source passages |
| `GET` | `/api/regulatory/sources` | The indexed source documents |
| `GET` | `/api/system/status` | Service reachability and which optional schema features are on |

### Trace

| Method | Path | Does |
| --- | --- | --- |
| `POST` | `/api/trace/chat` | `{ message, history?, context: { page, fy, documentId? } }`. Streams server-sent events: `token` (`{ text }`) as the answer is written, then `done` (`{ links, sources }`) or `error` (`{ message }`). Read-only. `429` past the rate limit. |

### Workspace tools

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/activity?fy=2026&group=review&before=…&limit=50` | Audit trail, newest first. `fy=all` for every year; `group` is `documents`, `review`, `filing` or `settings`; page with `before` = the previous page's `next_before`. |
| `GET` | `/api/obligations?fy=2026&basis=current` | Obligation per CPCB category. `basis=previous_two_years` averages A over the two years before. |
| `PUT` | `/api/obligations/:category` | `{ fy, pre_consumer_kg?, supplied_kg?, epr_target_pct?, recycling_min_pct?, ec_rate_per_kg? }`. `null` clears a value back to the default. `409` for finalized years. |
| `GET` | `/api/materials` | Polymers, the built-in catalogue, the company's trade names, and suggestions from its review corrections |
| `POST` | `/api/materials/trade-names` | `{ trade_name, material_code, cpcb_category?, notes? }`. `409` if the name exists (ignoring case). |
| `DELETE` | `/api/materials/trade-names/:id` | Remove one of the company's trade names |

## Business rules

Rules are enforced here, not in the UI, and the database lets clients read only (see [DATABASE.md](DATABASE.md#row-level-security)).

- **Duplicates.** The same file (by SHA-256) can't be uploaded twice per company. The `409` response names the existing file and its financial year. A unique index catches simultaneous uploads.
- **Review.** Only a person marks a line verified. Approving needs a material and a weight in kg. Every decision stores the reviewer's id, name and time. A correction that changes the suggestion is also logged to `classification_feedback`.
- **Financial year.** A document belongs to the FY of its invoice date, otherwise its upload date. See [ARCHITECTURE.md](ARCHITECTURE.md#filing-model) for the ledger, blockers and warnings.
- **Finalized years.** These are read-only. Review actions, date changes, retries, and deletes of documents in the snapshot return `409` until the year is reopened. A document can't be moved into a finalized year either.
- **Late documents.** A document dated in a finalized year but not in its snapshot is flagged. It can't be reviewed until the year is reopened, but it can be deleted.
- **Audit trail.** Uploads, deletes, retries, date changes, every review decision, bulk approvals, finalize and reopen, profile changes, obligation inputs and trade names each record an `activity_events` row. Recording never fails the action itself.
- **Trade names.** Before classification, each line is matched against the company's trade names (whole words, case and punctuation ignored, longest name wins). A match is suggested with confidence 0.95 and still needs approval; without a category it stays out of bulk approval.
- **Processing.** Uploads and retries queue a job (see [ARCHITECTURE.md](ARCHITECTURE.md#the-processing-queue)). A queued document can be deleted; one being read right now can't, and neither can be retried until it finishes.

## Adding an endpoint

1. **Route.** Add it in `routes/`, behind `authenticate`.
2. **Controller.** The controller reads `req.user.id` (the company id) and passes plain values to a service.
3. **Service.**
   - Scope every query with `.eq("company_id", userId)` or an inner join to `documents`.
   - Throw `AppError` helpers (`badRequest`, `notFound`, `conflict`, `unprocessable`) for expected failures.
   - Call `assertDocumentEditable` before changing anything tied to a financial year.
4. **Tests.** Put pure logic in its own module and test it in `test/` without importing the Supabase client; CI has no credentials.

# Architecture

## Components

| Component | Responsibility | Talks to |
| --- | --- | --- |
| `web-app` | The whole user interface. Signs users in with Supabase Auth and calls the backend with the user's access token. Never writes to the database directly. | Backend, Supabase Auth |
| `backend-service` | The single entry point for data. Authenticates every request, enforces business rules, stores files, orchestrates processing and builds filings. | Supabase (service role), OCR, classifier, regulatory RAG |
| `ocr-service` | Turns a PDF or image into text, fields (invoice number, GSTIN, date) and line items with quantities and units. Stateless. | Nothing |
| `rag-classify` | Suggests a material code and CPCB category for one line description, with a confidence and reasoning. Seeds its synonym index from the database on startup. | Qdrant, Ollama, Postgres (read) |
| `rag-regulatory` | Answers questions from indexed official documents and returns the passages it used. | Qdrant, Ollama |
| Qdrant | Vector search: trade-name synonyms (`material_synonyms`) and regulatory passages (`regulatory_docs`). | |
| Ollama | Local language model (`llama3.2:3b`) used by both RAG services. | |
| Redis | The processing queue (BullMQ) and the cache. Append-only persistence keeps queued jobs across restarts. | |
| Supabase | Postgres (application data), Storage (the private `documents` bucket), Auth (email, Google, Microsoft). | |

Everything except Supabase runs from `infra/docker-compose.yaml`.

## A document's life

```text
upload ──▶ PENDING ──▶ OCR_PROCESSING ──┬──▶ VERIFIED            evidence-only types (EPR record)
                                        ├──▶ REVIEW_PENDING      no line items found: enter them in review
                                        └──▶ RAG_PROCESSING ──▶ CLASSIFIED | RAG_FAILED
                                                                      │
                                       review decisions ──▶ REVIEW_PENDING ──▶ VERIFIED (every line decided)
          OCR_FAILED ◀── extraction error or restart mid-processing (retry from Documents)
```

1. **Upload.** `POST /api/documents/upload` hashes the file (SHA-256) and rejects it with `409` if the company already has that hash. A unique index makes this hold even for simultaneous uploads. The file goes to Supabase Storage under the company's folder and a `PENDING` row is created. The request returns immediately.
2. **OCR.** The backend sends the bytes to `POST /v1/ocr`.
   - Digital PDFs are read directly; only scanned pages go through PaddleOCR, up to 20 pages.
   - PaddleOCR isn't thread-safe, so the service serialises calls with a lock.
   - Line items are normalised to kilograms. Counts and lengths stay as non-weights for a person to convert.
   - One review line is created per item, or a single placeholder line if none were found.
3. **Classification.** Each line goes to `POST /classify`, at most `RAG_CONCURRENCY` (default 2) at a time.
   - First, the line is checked against the company's own trade names (Materials library). A match is suggested straight away with its material and category, and skips the classifier.
   - Otherwise the classifier embeds the description, finds the closest trade-name synonyms in Qdrant, and asks Ollama to pick a material.
   - A rule-based taxonomy assigns the CPCB category.
   - A failed line is kept with no material, for manual entry.
4. **Review.** Nothing counts until a person approves, corrects or excludes the line.
   - "Suggested" lines (material, weight and confidence all present) can be approved in bulk.
   - Each decision stores `reviewed_by`, `reviewed_by_name` and `reviewed_at`.
   - When every line is decided, the document becomes `VERIFIED`.
5. **Filing.** Reviewed lines are summed into the year their document belongs to.

### The processing queue

Processing runs as jobs on a BullMQ queue in Redis (`document-processing`), one job per document, keyed by the document id so it can't be queued twice.

- **Concurrency.** A worker processes `PROCESSING_CONCURRENCY` documents at a time (default 2). OCR handles one page set at a time and the local model a few requests at once, so this cap keeps a large batch from queueing up behind them and timing itself out.
- **Retries.** A failed run is retried up to `PROCESSING_ATTEMPTS` times (default 3), with exponential backoff (15 s, 30 s, …). Between attempts the document shows as queued, with the reason. Only after the last attempt does it become `OCR_FAILED`, with a message saying which service failed.
- **Restarts.** A job interrupted by a restart or crash is picked up again automatically, after BullMQ's stalled-job check (about a minute). On startup the backend also re-queues any document marked as processing whose job is missing, for example after Redis was wiped.
- **Idempotent runs.** Each run starts from the stored file. OCR output is cached by file hash for a day, so a retry after a classification failure doesn't read the document again.
- **Deleting.** A queued document can be deleted, which removes its job. One a worker is reading right now can't be deleted until it finishes.
- **Where it runs.** The worker runs inside the API process by default. Set `RUN_WORKER=false` on the API and run `npm run worker` to scale them separately.
- **Without Redis** (`REDIS_URL` empty), documents are processed inside the API process as before. Nothing is retried or resumed after a restart, but the app keeps working.
- **Dashboard.** With `ADMIN_USER` and `ADMIN_PASSWORD` set, Bull Board at `/admin/queues` shows every job, behind its own login. Settings → System status shows the queue's counts.

## Trace, the assistant

Trace answers questions in a chat panel on every page (`POST /api/trace/chat`, streamed as server-sent events). It uses the same local model as the classifier and regulatory RAG (`OLLAMA_MODEL`, `llama3.2:3b`), so it is designed to need exactly one model call per question:

1. **Actions are answered without the model.** Requests to change something ("approve all lines", "delete invoice_4.jpg") and "how do I…" questions about those actions get a fixed answer naming the page that does it, with a link. Trace is read-only.
2. **Rules decide what to read** (`trace/intent.js`): keywords, the current page and the open document choose between the filing summary, obligations, the review queue, recent activity, the open document and regulation passages (`/search` on the regulatory service).
3. **Facts are gathered read-only, as the user** (`trace/facts.js`), through the same services the pages use, so they are company-scoped and cached. A failed source is reported as unavailable instead of failing the answer.
4. **A plain-language brief** (`trace/brief.js`) states the facts as sentences ("Documents needing review: none"), which small models read far more reliably than raw counts.
5. **One streamed model call** answers from the brief and passages only, with rules against inventing facts, accepting false premises or naming pages that don't exist.
6. **Links and source chips are added by code** from the documents and passages actually used, never generated by the model.

Requests are rate-limited per user in Redis (`TRACE_RATE_LIMIT` per 5 minutes). Chat history lives in the browser session only. A test scans Trace's code for any call to a write method. Regulation answers share the search limitation noted in the roadmap.

## Caching

Redis also holds a cache for the slow paths. It only ever stores data that can be recomputed from the source. If Redis is slow or down, every read is a miss and the request goes to the source: slower, never wrong. Each cache operation gives up after 300 ms.

| What | Key | Kept for | Made stale by |
| --- | --- | --- | --- |
| Verified identity for a token | hash of the token | 60 s, never past the token's expiry | Logout deletes it |
| Company row | company id | 5 min | Profile save or creation deletes it |
| Filing summary, obligations | company, year (and basis), **data version** | 10 min | Any write bumps the company's data version |
| Classifier result for a line | normalised description + unit, **classifier tag** | 30 days | A new model, embedding model or synonym count changes the tag |
| Regulatory answer | normalised question, **sources tag** | 7 days | A new model or re-ingested sources change the tag |
| OCR output | file hash | 1 day | Never (same file, same text) |
| Signed file link | file path | 8 of its 10 minutes | Expiry |
| Materials catalogue, system status | fixed | 1 h, 15 s | Expiry |

- **Data version.** Every write that can change a company's filing bumps a per-company counter that is part of the cache key: uploads, deletes, date changes, retries, every processing status change, review decisions, finalize and reopen, profile saves and obligation inputs. A stale entry is never read again; it just expires. Finalizing always reads fresh data.
- **Tags.** The backend asks the classifier and regulatory services what produces their answers (`/health`, `/sources`) at most every 5 minutes. A changed model or source set gives a new tag, so earlier answers are never served for it.
- **Not cached:** failed classifications, answers without sources, document lists and the review queue (cheap, and they change constantly).
- **Trade-off:** after "sign out of all devices", an already-issued token can keep working with the API for up to 60 s.
- `make cache-clear` empties the cache without touching queued jobs.

## Filing model

- **Financial year.** Indian FY, April to March, identified by its start year (`2025` is FY 2025-26). A document's date is its invoice date if OCR found one or the user entered one, otherwise its upload date.
- **Ledger.** Each document type feeds one side of the ledger:

  | Document type | Ledger | Counts quantities? |
  | --- | --- | --- |
  | Purchase invoice | introduced | yes |
  | Recycling certificate | recycled | yes |
  | Collection receipt | collected | yes |
  | EPR record | evidence | no, stored as proof only |

- **Totals.** Built from reviewed lines only, using corrected values where a reviewer changed them, by material and by CPCB category. Excluded lines are kept on record but count toward nothing. The logic is a pure function, `summarizeFiling` in `backend-service/src/services/internal/filing.summary.js`, and is unit-tested.
- **Blockers** stop finalizing:
  - a missing GSTIN or PIBO category;
  - documents still processing or failed;
  - lines waiting for review;
  - no reviewed purchase quantities.
- **Warnings** don't block: lines without a CPCB category, or a missing EPR registration number.
- **Finalize** stores the summary as a snapshot in `fy_filings`. From then on:
  - the Filing page shows the snapshot, not live numbers;
  - review actions, date changes, retries and deletes on that year's documents return `409` until the year is reopened;
  - a document dated in the year that arrives after finalizing is a **late document**. It's flagged in Documents, Review and Filing, isn't in the snapshot, and can be deleted without reopening.
- **Reopen** deletes the snapshot, and the year goes back to live numbers.

## Obligations

`obligation.calc.js` is a pure function, unit-tested like the filing summary. Per CPCB category:

```text
Q            = A + B − C           A introduced (reviewed purchase invoices), B pre-consumer waste, C supplied to registered entities
obligation   = Q × EPR target %
recycling    = obligation × minimum recycling %
shortfall    = obligation − recycled (reviewed recycling certificates in that category)
compensation = shortfall × rate per kg, only when the company sets a rate
```

- **A** comes from the year's reviewed purchases, or optionally the average of the two previous years. Finalized years contribute their snapshot.
- **B, C, targets and rates** are stored per company, year and category in `epr_obligation_inputs`. Blank targets fall back to defaults from the 2022 EPR guidelines (100% EPR target from FY 2023-24; minimum recycling stepping up per category from FY 2024-25; no default for Category IV). The page labels each value as "default" or "yours".
- Inputs for a finalized year are locked, like everything else in it.

## Activity

Every write records one `activity_events` row: actor name, action, a readable summary, the document and financial year, and structured details (for example a correction's from → to). Recording is best-effort: if it fails, the action still succeeds and the error is logged. Bulk approval records a single event with the count. Company-wide events (profile, trade names) have no year and show under every year's filter.

## Security model

- **Authentication.** The frontend signs in with Supabase Auth (email and password, Google, Microsoft). Every backend request carries `Authorization: Bearer <access token>`, which the backend verifies with Supabase. No other header grants identity.
- **Authorization.** The backend uses the service-role key and scopes every query to the caller's company (`company_id = user id`).
- **Row-level security** is on for every table. Client policies are **read-only** and limited to the user's own rows; all writes go through the backend, so its rules can't be bypassed with the public anon key. Stored files are likewise read-only to clients. See [DATABASE.md](DATABASE.md#row-level-security).
- **Files** live in a private bucket. The UI views them through signed URLs that expire after 10 minutes.
- **Secrets** stay in `.env` files that git ignores. The frontend only ever holds the public anon key.

## Degrading gracefully

- **Optional schema.** At startup the backend probes for tables and columns added by later migrations (`fy_filings`, CPCB category columns, reviewer columns) and switches the matching features off if they're missing, logging which migration to apply. `GET /api/system/status` reports this along with service health, and Settings shows it.
- **Mock mode.** `USE_MOCK_SERVICES=true` replaces OCR and classification with canned results, for UI work without the ML stack.
- **Service outages.** If the classifier or regulatory service is down, documents fail with a readable reason and can be retried. The research page says the service is unavailable.

## Known limits

- The 3B model sometimes misses specific regulatory facts that are in the indexed documents. A larger model is planned.
- Each user account is one company; there are no teams or roles yet.
- Obligations count recycling certificates as the only fulfilment. Other routes, such as end-of-life disposal or EPR certificates bought on the portal, aren't tracked yet.
- Uploads made before migration 007 show the account's email as the uploader, because the uploader wasn't recorded then.

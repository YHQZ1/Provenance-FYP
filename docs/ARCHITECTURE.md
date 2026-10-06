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

Processing currently runs inside the backend process, not in a queue. On startup the backend marks anything left mid-processing as `OCR_FAILED` with a "retry" message. A document still processing can't be deleted, unless it has been stuck past the OCR and classifier timeouts plus a margin (about 10 minutes by default). Moving processing onto a job queue is the next architectural change.

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

- In-process processing, as above. A queue is planned.
- The 3B model sometimes misses specific regulatory facts that are in the indexed documents. A larger model is planned.
- Each user account is one company; there are no teams or roles yet.
- Obligations count recycling certificates as the only fulfilment. Other routes, such as end-of-life disposal or EPR certificates bought on the portal, aren't tracked yet.
- Uploads made before migration 007 show the account's email as the uploader, because the uploader wasn't recorded then.

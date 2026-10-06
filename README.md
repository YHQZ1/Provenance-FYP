# Provenance

Provenance turns a company's plastic packaging paperwork into a Plastic EPR filing it can defend.

Indian producers, importers and brand owners (PIBOs) must report how much plastic packaging they put on the market each financial year, and prove how much was collected and recycled. The numbers come from hundreds of invoices and certificates, usually typed into spreadsheets by hand. Provenance reads those documents, suggests what each line is, has a person confirm it, and adds up the reviewed numbers per financial year. Every figure traces back to the document, the line and the person who approved it.

```text
upload documents → read them (OCR) → suggest materials (RAG) → a person reviews each line → yearly totals → finalize and export
```

## What it does today

- **Upload** purchase invoices, recycling certificates, collection receipts and EPR records (PDF, JPEG, PNG, TIFF). Duplicate files are rejected, so nothing is counted twice.
- **Read** each document: invoice number, GSTIN, date and line items. Quantities are normalised to kilograms, including Indian number formats and units such as tonnes and quintals.
- **Suggest** a polymer (PET, HDPE, LDPE, PP, PVC, PS, MLP) and a CPCB category (I–IV) for each line, using a synonym index of trade names and a local language model.
- **Review** every line before it counts. Approve, correct or exclude it, with the source document beside it and keyboard shortcuts. High-confidence suggestions can be approved in bulk. Each decision records who made it and when.
- **File per financial year** (April to March), using each document's invoice date. The Filing page shows plastic introduced, recycled and collected by material and by category, with a list of what still blocks finalizing.
- **Finalize** a year to freeze a signed-off snapshot. Later changes and late-arriving documents are flagged instead of silently changing filed numbers. Export to CSV, JSON or PDF.
- **Work out obligations** per CPCB category: Q = A + B − C, the EPR target and the minimum recycling share, recycled so far, the shortfall and an optional compensation estimate. Default targets come from the 2022 EPR guidelines and can be overridden.
- **Keep an audit trail.** Activity lists every upload, review decision, deletion, finalization and settings change, with who made it and when, and exports to CSV.
- **Teach it your suppliers' names.** The Materials library holds your own trade names (for example `POLYPET 3020 → PET`), which are matched before the classifier runs. Lines you corrected in review are suggested as new entries.
- **Research** the regulations. Ask questions about the CPCB guidance and get answers that cite the source document and page.

Provenance prepares the numbers and evidence. Filing on the CPCB portal is still done by the company.

## How it's built

```text
                    ┌────────────────────────┐
  Browser ─────────▶│ web-app  React + Vite  │  :5173
                    └───────────┬────────────┘
                                │  REST, Supabase JWT
                    ┌───────────▼────────────┐       ┌──────────────────────────┐
                    │ backend  Express       │──────▶│ Supabase                 │
                    │ the only writer        │       │ Postgres · Storage · Auth│
                    └──┬──────────┬───────┬──┘       └──────────────────────────┘
                       │          │       │
             ┌─────────▼──┐ ┌─────▼────┐ ┌▼──────────────┐
             │ ocr-service│ │rag-      │ │rag-regulatory │
             │ PaddleOCR  │ │classify  │ │CPCB/SEBI Q&A  │
             └────────────┘ └──┬───────┘ └──┬────────────┘
                               └─────┬──────┘
                          Qdrant (vectors) · Ollama (llama3.2:3b)
```

| Service | Path | Port | Stack |
| --- | --- | --- | --- |
| Web app | `apps/web-app` | 5173 | React 19, Vite, Tailwind v4 |
| Backend API | `apps/backend-service` | 3000 | Node 20, Express, Supabase JS |
| OCR | `apps/ocr-service` | 8000 | FastAPI, PyMuPDF, PaddleOCR |
| Material classifier | `apps/rag-classify` | 8001 | FastAPI, sentence-transformers, Qdrant, Ollama |
| Regulatory research | `apps/rag-regulatory` | 8002 | FastAPI, Qdrant, Ollama |
| Vector store, LLM | `infra/docker-compose.yaml` | 6333, 11434 | Qdrant, Ollama |
| Database, files, auth | Supabase (hosted) | | Postgres with row-level security, Storage, Auth |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how a document moves through the system and how filings are locked.

## Quick start

You need Docker, Node 20+, Python 3.11 (for the service tests) and a Supabase project.

```bash
git clone https://github.com/YHQZ1/Provenance-FYP.git && cd Provenance-FYP

# 1. Environment files. Fill in your Supabase URL, keys and database URL.
cp apps/backend-service/.env.example apps/backend-service/.env.development
cp apps/web-app/.env.example apps/web-app/.env.development
cp apps/rag-classify/.env.example apps/rag-classify/.env

# 2. Database: apply supabase/migrations in order, then supabase/seed.sql
make db-migrate f=supabase/migrations/000_baseline.sql   # repeat for 001 … 007, then the seed

# 3. Run everything
make up        # builds and starts all services
make models    # first run only: pulls the Ollama model
make ingest    # first run only: indexes the regulatory sources
make status    # all green? open http://localhost:5173
```

`make` on its own lists every command. [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) has the full setup, including the Supabase settings (OAuth providers and redirect URLs) and troubleshooting.

## Repository layout

```text
apps/
  web-app/            React frontend
  backend-service/    Express API: auth, documents, review, filing, research
  ocr-service/        Document text and line-item extraction
  rag-classify/       Material and CPCB category suggestions
  rag-regulatory/     Question answering over official regulatory documents
infra/
  docker-compose.yaml The whole local stack
supabase/
  migrations/         Schema, numbered and applied in order
  seed.sql            Polymer list and trade-name synonyms
docs/                 Product, architecture, database, setup and service notes
.github/workflows/    CI: lint, tests and builds for every service
Makefile              Everyday commands
```

## Documentation

| Doc | Read it for |
| --- | --- |
| [PRODUCT.md](docs/PRODUCT.md) | The problem, how Plastic EPR works, product principles, roadmap |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Services, document lifecycle, filing model, security model |
| [DATABASE.md](docs/DATABASE.md) | Tables, migrations, row-level security, reference data |
| [LOCAL_DEV.md](docs/LOCAL_DEV.md) | Setting up, running, testing and troubleshooting locally |
| [BACKEND_SERVICE.md](docs/BACKEND_SERVICE.md) | API endpoints, configuration and business rules |
| [OCR_SERVICE.md](docs/OCR_SERVICE.md) | The OCR service on its own |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Workflow, conventions, UI design rules, tests and CI |
| [REPO_MAP.md](docs/REPO_MAP.md) | What lives where, and the cleanup decisions behind it |

## Status and roadmap

The Plastic EPR workflow works end to end. Next up:

1. **Job queue for processing.** Documents are processed in the backend process today, so a restart marks in-flight documents as failed and they need a retry. A queue will resume them instead.
2. **Trace, the in-app assistant.** A preview is in the app now. It will answer questions on any page using the regulatory sources and the company's own filing.
3. **A larger language model** for regulatory answers. The current 3B model misses some specific answers, such as filing deadlines.

Further out: EPR certificate tracking against obligations, BRSR Core reporting, and product-level carbon estimates. See [PRODUCT.md](docs/PRODUCT.md#roadmap).

## What Provenance doesn't claim

- It doesn't file on the CPCB portal.
- It doesn't guarantee that a regulator accepts a filing; a person reviews every number.
- It isn't a lifecycle assessment tool, and it doesn't replace an auditor.

The aim is to automate the repetitive part of compliance and make the rest visible, reviewable and traceable. Every number should answer: which document did this come from, which line, who approved it, and can it be reproduced later?

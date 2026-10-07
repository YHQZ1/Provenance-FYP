# Repo map

Where things live and where to start reading.

## Apps

| Path | Role | Start reading at |
| --- | --- | --- |
| `apps/web-app` | React frontend | `src/App.jsx` (routes); `src/components/Layout.jsx` (shell, year switcher); `src/lib/workspace.jsx` (shared filing state); `src/lib/api.js`; `src/components/ui.jsx` (design system) |
| `apps/backend-service` | Express API, the only writer | `src/app.js`; `src/services/internal/filing.summary.js` (filing logic); `obligation.calc.js`; `document.service.js`; `feedback.service.js`; `activity.service.js` |
| `apps/ocr-service` | Text, fields and line items from files | `src/ocr_service/pipeline/service.py`; `pipeline/parsing.py` |
| `apps/rag-classify` | Material and CPCB category suggestions | `src/services/rag_pipeline.py`; `src/services/taxonomy.py` |
| `apps/rag-regulatory` | Question answering over official documents | `src/main.py`; `src/rag/text.py`; `scripts/ingest.py`; `src/config/sources.yaml` |

## Frontend pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | `Provenance.jsx` | Landing page |
| `/auth` | `Auth.jsx` | Sign in, sign up, forgot password, Google and Microsoft |
| `/reset-password` | `ResetPassword.jsx` | Set a new password from the email link |
| `/dashboard` | `Home.jsx` | The year at a glance: next step, readiness, monthly coverage, materials |
| `/documents` | `Documents.jsx` | Upload queue, document list and detail panel |
| `/review` | `Review.jsx` | One line at a time beside its source, with keyboard shortcuts |
| `/filing` | `Filing.jsx` | Totals, blockers, finalize or reopen, exports |
| `/obligations` | `Obligations.jsx` | Q = A + B − C per CPCB category, targets, shortfall, compensation estimate |
| `/activity` | `Activity.jsx` | Audit trail by day, filterable, with CSV export |
| `/materials` | `Materials.jsx` | The company's trade names, suggestions from corrections, the built-in catalogue |
| `/regulatory` | `RegulatoryResearch.jsx` | Questions over CPCB and SEBI sources |
| `/settings` | `Settings.jsx` | Company profile, account, system status, data export |
| `*` | `NotFound.jsx` | 404 |

Old routes (`/upload`, `/validation`, `/mapping`, `/reports`, `/insights`) redirect to their replacements.

## Shared

| Path | Role |
| --- | --- |
| `infra/docker-compose.yaml` | The compose file for the whole local stack |
| `infra/helm/provenance/` | The Helm chart that runs the same stack on Kubernetes |
| `infra/k8s/` | Scripts behind the `k8s-*` make targets: ingress install, secrets, build and deploy |
| `supabase/` | Migrations and seed data; see [DATABASE.md](DATABASE.md) |
| `.github/workflows/ci.yml` | Lint, tests and builds for all five apps on every push and pull request |
| `Makefile` | Everyday commands; run `make` |
| `docs/` | All cross-service documentation; apps don't keep their own READMEs |

## Conventions

- One README at the root; everything else in `docs/`.
- One `.gitignore`, at the root.
- One compose file, `infra/docker-compose.yaml`, and one Helm chart, `infra/helm/provenance`, both describing the same stack.
- No generated data, uploads, model caches, virtualenvs or `node_modules` in git.
- Test fixtures live next to the tests that use them (for example `apps/ocr-service/tests/fixtures/`).

## Cleanup log

| Item | Outcome |
| --- | --- |
| Vendored Windows Poppler (`poppler/`, `poppler.zip`) | Removed; Poppler is installed in the OCR image, or with `brew install poppler` |
| Service-local compose files | Removed in favour of `infra/docker-compose.yaml` |
| Service-local READMEs and `.gitignore` files | Folded into the root README, `docs/` and the root `.gitignore` |
| Sample invoices | Moved to `apps/ocr-service/tests/fixtures/invoices/` |
| Regulatory scrapers and ad-hoc scripts | Removed; sources are listed in `sources.yaml` and indexed by `scripts/ingest.py` |
| Old frontend pages (Dashboard, Upload, Validation, Insights, Reports, ComplianceMapping) | Replaced by Home, Documents, Review and Filing |
| Database schema not in the repo | Added `000_baseline.sql` and `seed.sql` |

## Open decisions

| Item | Options |
| --- | --- |
| Legacy database objects (`filing_periods`, `company_materials`, `dashboard_summary`, `aggregate_filing_period()`, unused `documents` columns) | Drop in a migration once nothing external depends on them |
| Frontend container | Runs the Vite dev server. A production deployment should serve the built `dist/` instead (the app is on Vercel today). |
| Backend hosting | Not decided; it needs to reach the OCR and RAG services and Supabase |

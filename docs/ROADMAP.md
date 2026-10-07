# Roadmap

What's built is described in [PRODUCT.md](PRODUCT.md) and [ARCHITECTURE.md](ARCHITECTURE.md). This page lists what is left, in rough priority order, and why each item matters. Size is a rough guide: S is under a day, M is a few days, L is a week or more.

## 1. Accuracy and trust

| Item | Why | Size |
| --- | --- | --- |
| **Better regulatory search** | Regulatory research and Trace answered 8 of 13 test questions correctly. In four of the five misses the passage holding the answer ranked 10th to 15th, below the 5 the model sees, so no model change helped (3B, Llama 3.1 8B and Qwen 2.5 7B all scored the same). Fix: combine keyword and vector search, re-rank the top candidates, and give the model more passages. A graded question set already exists from the model test and should be kept in the repo to measure the fix. | M |
| **Test on real invoices** | Extraction has been validated on about five sample invoices. Real invoices vary in layout, scan quality, handwriting, page count and language. Collect 30 to 50 varied ones, measure OCR and classification accuracy, and fix what the numbers show. | M |
| **Classifier accuracy report** | Corrections already accumulate in `classification_feedback` and feed trade-name suggestions. Report accuracy over time and use the corrections to grow the synonym library. | S |

## 2. Protecting the service

| Item | Why | Size |
| --- | --- | --- |
| **Rate limiting** | Only Trace is limited today (`TRACE_RATE_LIMIT`). Everything else is open: the regulatory query (a 5 to 15 second model call), uploads (each queues OCR and classification), the auth sync call and the rest of the API. One client could saturate the model or fill the queue. See the plan below. | S |
| **Security review** | The large holes were closed early (header-based auth bypass, open database policies). A proper pass would still cover dependency vulnerabilities, request validation, the classifier and regulatory images running as root, network policies between pods, and image scanning. | M |
| **Backups and a restore test** | The data lives in Supabase. Confirm backups are on, and prove a restore works. | S |

### Rate limiting plan

Limits apply at two layers, and both answer `429` with a `Retry-After` header and a plain-language message.

- **At the ingress:** NGINX annotations for requests per second and connections per client IP. This stops floods before they reach Node, and covers unauthenticated routes.
- **In the API, per signed-in user:** counters in Redis, using the same helper Trace already uses (`cache.count`). Suggested starting limits, all configurable in env:

  | Route | Limit |
  | --- | --- |
  | `POST /api/regulatory/query` | 20 per 5 minutes |
  | `POST /api/documents/upload` | 30 per hour, plus a cap on documents waiting in the queue |
  | `POST /api/trace/chat` | 20 per 5 minutes (exists) |
  | Everything else | 300 per minute |

Counters fail open: if Redis is unavailable, requests are allowed rather than blocked. Tests cover the limit, the reset, and the fail-open behaviour.

## 3. Confidence that it keeps working

| Item | Why | Size |
| --- | --- | --- |
| **End-to-end test in CI** | About 130 unit tests exist, but nothing automatically exercises the whole flow (sign in, upload, review, finalize, export) in a browser against a real database. A Playwright test would catch most regressions. | M |
| **Backend integration tests** | The API against a disposable Postgres built from the migrations in `supabase/`. | M |
| **Image builds and scans in CI** | CI tests the code and lints the chart, but doesn't build the images or scan them for vulnerabilities. | S |

## 4. Running it for real

| Item | Why | Size |
| --- | --- | --- |
| **Metrics, dashboards and alerts** | Prometheus, Grafana and Alertmanager, with a `/metrics` endpoint on each service. Queue depth, processing time, answer latency, cache hit rate, restarts. | M |
| **Logs** | Loki for storage and Alloy for collection, plus structured JSON logging with a request or document ID so logs are searchable. | M |
| **Error tracking** | Sentry for frontend crashes and backend errors. A blank page for a user is invisible today. | S |
| **Tracing (optional)** | OpenTelemetry into Tempo, only if latency questions need it. | M |
| **Email provider** | Password reset and confirmation emails use Supabase's built-in sender, which is rate-limited and meant for testing. Connect a real SMTP provider. | S |
| **Infrastructure as code** | When deploying: Terraform (or OpenTofu) for the cloud cluster, registry, DNS, secrets and managed services, with the existing chart deployed on top. Not needed for local work. | L |
| **Deployment** | Target undecided. The Helm chart is ready for a cloud cluster; see [KUBERNETES.md](KUBERNETES.md#moving-to-a-cloud-cluster). | L |

Where monitoring would live in the repo: stack settings and dashboards under `infra/monitoring/`, scrape and alert rules as optional templates in the app chart, and an install script in `infra/k8s/`.

## 5. Product gaps

| Item | Why | Size |
| --- | --- | --- |
| **Teams and roles** | One account is one company with one user. Real compliance work usually has a preparer and a reviewer, so this needs invites, roles and a review-by-someone-else step. | L |
| **Other ways to fulfil obligations** | Obligations count recycling certificates only. EPR certificates bought on the portal and other routes aren't tracked. | M |
| **BRSR Core and carbon** | Separate modules described in [PRODUCT.md](PRODUCT.md#roadmap). | L |

## 6. Cleanup

- Drop the unused legacy tables and view (`filing_periods`, `company_materials`, `dashboard_summary`, `aggregate_filing_period()`) and the unused `documents` columns.
- Decide whether Docker Compose stays. The Compose frontend still runs the development server; Kubernetes uses the production image.
- Demo seed data, screenshots in the README and a short demo script, if the project is going to be presented.

## Suggested order

1. Better regulatory search, then rate limiting (both are contained and high impact).
2. An end-to-end test in CI.
3. Metrics, logs and error tracking.
4. Test on real invoices, in parallel with the above, since it needs collecting documents.
5. The rest as needed.

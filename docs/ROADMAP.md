# Roadmap

What's built is described in [PRODUCT.md](PRODUCT.md) and [ARCHITECTURE.md](ARCHITECTURE.md). This page lists what is left, in rough priority order, and why each item matters. Size is a rough guide: S is under a day, M is a few days, L is a week or more.

## Built since the last plan

Rate limiting, metrics, logs and error tracking (see [MONITORING.md](MONITORING.md)), GitOps with Argo CD and images in GHCR (see [ARGOCD.md](ARGOCD.md)), and an end-to-end test in CI that signs up, uploads, reviews, finalizes and exports against a real local Supabase (see [LOCAL_DEV.md](LOCAL_DEV.md#tests)).

Nothing is scheduled. The sections below are the backlog, with the order to take it in at the end.

**Memory budget.** The local cluster has 12 GB and the app already uses about 8 GB. Prometheus, Grafana, Alertmanager and Loki add roughly 2 GB, and Argo CD another 0.5 to 1 GB. Treat monitoring and Argo CD as opt-in stacks started on demand and stopped afterwards, not always on. If memory gets tight, scale the Ollama and classifier pods down while working on them.

## Decisions

| Question | Decision | Reason |
| --- | --- | --- |
| Log stack | **Loki, Alloy and Grafana**, not ELK | Far lighter (a few hundred MB against several GB for Elasticsearch), and logs sit next to metrics in one Grafana. Alloy can ship to OpenSearch later if ever needed. |
| Metrics and alerts | Prometheus, Grafana, Alertmanager (`kube-prometheus-stack`) | Standard, free, adds the metrics server Docker Desktop lacks, and carries over to EKS. |
| GitOps | **Argo CD**, with images built by CI and pushed to GHCR | The cluster follows Git, with drift correction, rollback by revert and a UI. Built; see [ARGOCD.md](ARGOCD.md). |
| Commercial monitoring (Datadog) | Not now | Paid, and costs grow with hosts and log volume. OpenTelemetry keeps the door open to it. |
| Tracing | Optional: OpenTelemetry into Tempo | Useful for latency questions; metrics and structured logs answer most others first. |
| Infrastructure as code | Terraform (or OpenTofu) when deploying; not Ansible | Terraform creates the cloud cluster and services. Ansible configures servers, and containers and Helm already do that here. |
| Error tracking | Sentry | Frontend crashes are invisible today. |
| Model | `llama3.2:3b` for the classifier, the regulatory service and Trace; no paid APIs | Tested larger models (Llama 3.1 8B, Qwen 2.5 7B): same accuracy on the regulatory set, so the cause is retrieval, not model size. |

**Images:** decided. CI builds each service on every green push to `main` and pushes it to GitHub Container Registry, tagged with a hash of that service's directory, so only changed services roll out. See [ARGOCD.md](ARGOCD.md).

## 1. Accuracy and trust

| Item | Why | Size |
| --- | --- | --- |
| **Test on real invoices** | Extraction has been validated on about five sample invoices. Real invoices vary in layout, scan quality, handwriting, page count and language. Collect 30 to 50 varied ones, measure OCR and classification accuracy, and fix what the numbers show. | M |
| **Classifier accuracy report** | Corrections already accumulate in `classification_feedback` and feed trade-name suggestions. Report accuracy over time and use the corrections to grow the synonym library. | S |

## 2. Protecting the service

| Item | Why | Size |
| --- | --- | --- |
| **Security review** | The large holes were closed early (header-based auth bypass, open database policies). A proper pass would still cover dependency vulnerabilities, request validation, the classifier and regulatory images running as root, network policies between pods, and image scanning. | M |
| **Backups and a restore test** | The data lives in Supabase. Confirm backups are on, and prove a restore works. | S |

Rate limiting is built: per-address and per-user limits across the API, a cap on documents in processing, a lockout on the queue dashboard, and ingress limits. The table of limits is in [BACKEND_SERVICE.md](BACKEND_SERVICE.md#rate-limits). Still to do on top of it: a per-company limit once teams exist, and limit hits as a metric once Prometheus is in.

## 3. Confidence that it keeps working

| Item | Why | Size |
| --- | --- | --- |
| **More end-to-end coverage** | One Playwright test covers the happy path. Worth adding: a failed document and retry, correcting a suggested line, reopening a finalized year, and the obligations page. | S |
| **Backend integration tests** | The API against a disposable Postgres built from the migrations in `supabase/`. | M |
| **Image builds and scans in CI** | CI tests the code and lints the chart, but doesn't build the images or scan them for vulnerabilities. | S |

## 4. Running it for real

| Item | Why | Size |
| --- | --- | --- |
| **Observability follow-ups** | Metrics, dashboards, alerts, logs and Sentry are built. Left: deploy and tune the thresholds against real traffic, Qdrant and Ollama specific alerts, and Sentry on the Python services if wanted. | S |
| **Tracing (optional)** | OpenTelemetry into Tempo, only if latency questions need it. | M |
| **Email provider** | Password reset and confirmation emails use Supabase's built-in sender, which is rate-limited and meant for testing. Connect a real SMTP provider. | S |
| **Infrastructure as code** | When deploying: Terraform (or OpenTofu) for the cloud cluster, registry, DNS, secrets and managed services, with the existing chart deployed on top. Not needed for local work. | L |
| **Deployment** | Target undecided. The Helm chart is ready for a cloud cluster; see [KUBERNETES.md](KUBERNETES.md#moving-to-a-cloud-cluster). | L |

Where these live in the repo: monitoring settings, scrape and alert rules and dashboards under `infra/monitoring/`, Argo CD under `infra/argocd/`, image builds under `.github/`, Terraform under `infra/terraform/` (modules plus one folder per environment), and install scripts in `infra/k8s/`.

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

## Known limitations

- **Regulatory answers can miss.** On a graded set of 13 regulatory questions, Regulatory research and Trace answered 8 correctly. In four of the five misses the passage holding the answer ranked 10th to 15th in the search, below the 5 the model sees. Trying larger models (Llama 3.1 8B, Qwen 2.5 7B) scored the same, so it is a ranking limit, not a model one. Every answer lists its sources, so the passage can be checked. Combining keyword and vector search with re-ranking would address it; this is a deliberate decision not to do that work.
- **Extraction is validated on about five sample invoices.** See "Test on real invoices" above.

## Suggested order

1. Test on real invoices, since it needs collecting documents and is the biggest unknown for accuracy.
2. Tune the new alerts against real traffic, and add the Gmail app password and Sentry DSNs.
3. A security review and a backup restore test, before real data goes in.
4. More end-to-end coverage as features change.
5. The rest as needed.

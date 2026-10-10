# Monitoring

Metrics, dashboards, alerts, logs and error tracking for the Provenance stack. Everything is free and open source apart from Sentry's free tier, and runs next to the app in the same cluster.

## What runs

| Part | Tool | Does |
| --- | --- | --- |
| Metrics | Prometheus | Scrapes `/metrics` from the backend, worker, OCR, classifier and regulatory services, plus Redis and Qdrant, every 30 seconds. Keeps 7 days. |
| Dashboards | Grafana | Five dashboards kept in the repo, and metrics and logs side by side. |
| Alerts | Alertmanager | Groups alerts and emails them. Rules are in the repo. |
| Logs | Loki, with Alloy collecting | Every app pod's logs, searchable by service, level, request ID and document ID. Keeps 7 days. |
| Errors | Sentry (free tier) | Frontend crashes and backend exceptions, with the request and document ID attached. Off until a DSN is set. |

It is an opt-in stack, about 2 GB on top of the app. Start it when you want it and remove it afterwards.

## Using it

```
make k8s-monitoring-up      # installs everything, a few minutes the first time
make k8s-grafana            # opens Grafana, prints the admin password
make k8s-prometheus         # targets, queries and rule state
make k8s-alertmanager       # firing alerts and silences
make k8s-monitoring-status  # pods in the monitoring namespace
make k8s-monitoring-down    # frees the memory; the data volumes are kept
```

The app must have been deployed with `make k8s-up` after this change so the services expose `/metrics`.

## Dashboards

| Dashboard | Answers |
| --- | --- |
| Overview | Is anything down, how much traffic, how many errors, how slow, what is being rate limited |
| Document processing | Queue depth and age, outcomes, time per document, OCR engine wait, calls to other services, cache hit ratio |
| Models and search | Classifier and regulatory model time, retrieval time, regulatory and Trace answer time as users see them, model memory |
| Cluster | Memory against limits, CPU, restarts, Redis and Qdrant |
| Logs | Search and filter by service, level, free text, request ID or document ID, with volume by level |

The JSON lives in `infra/monitoring/chart/dashboards/` and is loaded into Grafana automatically. Edit in the Grafana UI, export the JSON, and replace the file to keep a change.

## Alerts

Defined in `infra/monitoring/chart/templates/prometheusrule.yaml`, with thresholds in `values.yaml`. `make k8s-lint` checks them with `promtool`.

| Alert | Fires when | Severity |
| --- | --- | --- |
| ProvenanceTargetDown | A service can't be scraped for 3 minutes | critical |
| RedisDown | Redis is down for 2 minutes | critical |
| BackendHighErrorRate | More than 5 percent of API requests fail for 5 minutes | critical |
| DocumentQueueStuck | The oldest waiting document is older than 15 minutes | critical |
| ProvenancePodOOMKilled | A container was killed for exceeding its memory limit | critical |
| BackendSlowRequests | p95 of ordinary routes above 3 seconds for 10 minutes | warning |
| RateLimitRejectionsHigh | More than 50 requests refused with 429 in 10 minutes | warning |
| DocumentQueueBacklog | More than 20 documents waiting for 10 minutes | warning |
| DocumentProcessingFailing | 3 or more processing attempts failed in 30 minutes | warning |
| DownstreamErrors | More than 20 percent of calls to a service fail for 10 minutes | warning |
| LanguageModelSlow | p95 of Trace answers above 60 seconds for 10 minutes | warning |
| ProvenancePodRestarting | A container restarted more than twice in 30 minutes | warning |
| ProvenanceMemoryNearLimit | A container is above 90 percent of its memory limit for 10 minutes | warning |

The stack's own Kubernetes alerts (crash loops, failed jobs, volume filling) are on too. A few that can't mean anything on a single local node, like cluster CPU and memory overcommit, are switched off.

Pausing the app with `make k8s-stop` doesn't fire anything: scaled-down targets disappear instead of reporting down.

### Email

Alertmanager sends warning and critical alerts by email, grouped, repeating every 12 hours until resolved. It needs an SMTP account. With Gmail:

1. Turn on 2-step verification for the account, then create an **app password** (Google Account, Security, App passwords).
2. Put these in `infra/.env`:

   ```
   ALERT_EMAIL_TO=you@example.com
   SMTP_SMARTHOST=smtp.gmail.com:587
   SMTP_USER=you@example.com
   SMTP_PASSWORD=the-16-character-app-password
   ```

3. Run `make k8s-monitoring-up` again.

Without those four, alerts still show in Alertmanager and Grafana. The password is stored in a Secret in the `monitoring` namespace and mounted as a file, never written into a values file or the repo.

## Logs

Every service writes one JSON object per line:

```json
{"time":"2026-10-10T18:03:11.402Z","level":"info","service":"backend","msg":"request","request_id":"6f1c…","user_id":"…","method":"POST","route":"/api/documents/upload","status":201,"duration_ms":412}
```

- `request_id` is created at the edge (or by the ingress) and returned in the `X-Request-ID` response header. The backend passes it to OCR, the classifier and regulatory research, so one ID follows a request across services.
- `document_id` is added whenever a document is being processed, in the worker and in every service it calls.
- Level is `debug`, `info`, `warn` or `error`. Set `LOG_LEVEL` to change it.
- Locally (`NODE_ENV` not `production`) the backend prints a readable single line instead. `LOG_FORMAT=json` forces JSON.

In Grafana, open **Provenance / Logs** and filter by Request ID or Document ID. In Explore, the same in LogQL:

```
{namespace="provenance", app="worker"} | json | document_id="…"
{namespace="provenance", level="error"}
```

Only `namespace`, `app`, `pod`, `container` and `level` are indexed labels. IDs stay in the line, so they don't blow up the index.

## Error tracking

Sentry is wired into the web app and the backend (API and worker) and does nothing until a DSN is set. Create two projects in a free Sentry account (a React one and a Node one), then:

- `apps/backend-service/.env.development`: `SENTRY_DSN=…`
- `apps/web-app/.env.development`: `VITE_SENTRY_DSN=…`
- `make k8s-secrets`, then `make k8s-up` (or `make k8s-restart s=backend`, `s=worker`, `s=frontend`).

The backend reports unhandled 5xx errors, failed final processing attempts and Trace failures, tagged with the service, request ID and document ID. The web app reports uncaught React errors, unhandled promise rejections and API responses of 500 or more. No performance tracing, no session replay and no personal data are sent.

## What each service exposes

| Service | Metrics (besides process and runtime defaults) |
| --- | --- |
| Backend | `http_request_duration_seconds` by method, route and status; `rate_limit_rejections_total` by limit; `cache_requests_total` by result; `downstream_request_duration_seconds` by service and outcome; `document_queue_jobs` by state; `document_queue_oldest_waiting_seconds` |
| Worker (port 9464) | `documents_processed_total` and `document_processing_duration_seconds` by outcome, plus the downstream and cache metrics |
| OCR | `http_request_duration_seconds`, `ocr_engine_wait_seconds`, `ocr_processing_seconds` |
| Classifier | `http_request_duration_seconds`, `llm_call_duration_seconds` by outcome |
| Regulatory | `http_request_duration_seconds`, `llm_call_duration_seconds` by outcome, `retrieval_duration_seconds` |
| Redis | `redis_*` from a small exporter sidecar |
| Qdrant | Its built-in metrics |

`/metrics` is on each service's own port and is not routed through the ingress, so it is reachable only inside the cluster. Route labels use the route template (`/api/documents/:id`), never the raw path, so cardinality stays flat.

## Where things live

```
apps/*/                              metrics and logging in each service
infra/monitoring/
  kube-prometheus-stack-values.yaml  Prometheus, Grafana, Alertmanager settings
  loki-values.yaml, alloy-values.yaml
  chart/                             scrape config, alert rules, dashboards
  check-rules.sh                     promtool check, run by make k8s-lint and CI
infra/k8s/monitoring.sh              install, remove, port-forward
```

Chart versions are pinned in `infra/.env.example` (`PROMETHEUS_STACK_VERSION`, `LOKI_VERSION`, `ALLOY_VERSION`).

## Moving to a cloud cluster

The same charts apply. Differences to expect: storage classes for the Prometheus and Loki volumes, a real SMTP provider or another Alertmanager receiver, and Grafana behind an ingress with proper login instead of a port-forward.

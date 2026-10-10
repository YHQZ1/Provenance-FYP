# Running on Kubernetes

The whole stack runs on a local Kubernetes cluster from one Helm chart, `infra/helm/provenance`. The same chart is what a cloud cluster such as EKS would use later: only the values file changes. Docker Compose still works and is quicker for day-to-day coding.

```text
http://provenance.localhost  (NGINX ingress, in its own namespace)
  /api, /admin/queues  ->  backend
  everything else      ->  frontend (nginx serving the built app)

namespace provenance
  Deployments   frontend  backend  worker  ocr-service  rag-classify  rag-regulatory
  StatefulSets  redis  qdrant  ollama                (each with its own volume)
  Jobs          ollama-pull  regulatory-ingest       (run by Helm after install)
  ConfigMap     provenance-config                    (service addresses, model, ports)
  Secrets       provenance-backend-secrets  provenance-classifier-secrets  provenance-web-config
Supabase stays hosted.
```

## Prerequisites

- **Docker Desktop with Kubernetes.** Settings, Kubernetes, Create cluster (single node). The context is named `docker-desktop`.
- **About 12 GB of memory for Docker** (Settings, Resources). Kubernetes adds roughly 1 GB, and Ollama, the classifier and OCR are heavy. With 8 GB, pods are killed under load.
- `kubectl` and `helm` (v3 or later), and the env files from [LOCAL_DEV.md](LOCAL_DEV.md).

## First run

```bash
make env          # creates infra/.env from the example, if you haven't already
make k8s-up       # installs the ingress controller, creates the secrets, builds the images and deploys
```

The first run takes 15 to 20 minutes, mostly downloading the 2 GB language model and indexing the regulatory sources. Later runs take under a minute. When it finishes, open `http://provenance.localhost` (browsers resolve `*.localhost` to your machine).

## Starting and stopping

Docker Desktop has to be running: the cluster is a node inside its virtual machine, so quitting Docker Desktop stops it. You don't need Docker Compose or `make up` any more.

| You want to | Do this |
| --- | --- |
| Start your day | Open Docker Desktop and wait for Kubernetes to show as running. The app comes back by itself: Kubernetes recreates every pod and the volumes still hold the data. Then open the app, or check with `make k8s-status`. |
| Pause the app and free memory, keeping Docker open | `make k8s-stop`, then `make k8s-start` (about 12 seconds) |
| Deploy code changes | `make k8s-up` |
| Remove the app, keeping its data | `make k8s-down`, then `make k8s-up` |
| Finish for the day | Quit Docker Desktop, or just `make k8s-stop` first |

The first Trace question, classification or search after a start is slow (20 to 30 seconds) while the models load into memory, then fast again. `make k8s-start` only restores one replica of each service, so if you raise replicas in `values.yaml`, use `make k8s-up` to resume.

## Everyday commands

Run `make` for the full list.

| Command | Does |
| --- | --- |
| `make k8s-up` | Builds the images and deploys or updates everything. `s=backend` rebuilds just that one. Only pods whose image changed restart. |
| `make k8s-status` | Pods, volumes, ingress and release status |
| `make k8s-logs` | Follows every app pod, prefixed by name. `s=backend` for one. |
| `make k8s-stop` | Pauses everything (pods go to zero, data stays). `make k8s-start` resumes it. |
| `make k8s-restart s=worker` | Restarts a service without rebuilding |
| `make k8s-shell s=backend` | A shell inside a pod |
| `make k8s-models` | Pulls the Ollama model again |
| `make k8s-ingest` | Re-indexes the regulatory sources (forced, a few minutes) |
| `make k8s-secrets` | Re-creates the Secrets after you change an `.env` file |
| `make k8s-cache-clear` | Empties the cache (for example after editing data directly in Supabase). Queued jobs are kept. |
| `make k8s-lint` | Lints and renders the charts and checks the alert rules, without a cluster |
| `make k8s-monitoring-up` | Installs Prometheus, Grafana, Alertmanager, Loki and Alloy (about 2 GB). See [MONITORING.md](MONITORING.md). |
| `make k8s-grafana` | Opens Grafana and prints the admin password |
| `make k8s-monitoring-down` | Removes the monitoring stack to free memory |
| `make k8s-down` | Removes the app. Volumes, the model and the index are kept. |
| `make k8s-purge CONFIRM=yes` | Removes the app and all its data, then the namespace |

Every command runs against the context named by `K8S_CONTEXT` in `infra/.env`, never whichever cluster `kubectl` happens to point at, so a later cloud context can't be hit by accident.

## Configuration

| What | Where |
| --- | --- |
| Service addresses, model name, public links | `config:` in `values.yaml`, rendered into the `provenance-config` ConfigMap. Every pod reads it. |
| Per-service image, port, health path, resources, volumes | `apps:` in `values.yaml`. Adding a service means adding an entry. |
| Local overrides (smaller volumes) | `values-local.yaml` |
| Hostname, upload size limit, timeouts, per-client request and connection limits | `ingress:` |
| Cluster name, namespace, ingress chart version | `infra/.env` |
| Supabase keys and `DATABASE_URL` | Kubernetes Secrets, created from your existing `.env` files by `make k8s-secrets`. They never go in the chart or an image. |

To change the model for all three AI components, edit `config.OLLAMA_MODEL` in `values.yaml`, run `make k8s-up`, then `make k8s-models`.

## How updates work

`make k8s-up` rebuilds images with provenance records turned off, so an unchanged image keeps the same ID. It passes each image's ID to the chart as a pod annotation, so a pod restarts only when its image really changed. Running it twice in a row restarts nothing.

## Data safety

Redis (the queue), Qdrant (the indexes), Ollama (the models), the two embedding caches and the OCR model files each have a volume, and the volumes survive `make k8s-down`. A fresh `make k8s-up` afterwards reattaches them, takes about half a minute, and skips the ingest because the index is still there. Only `make k8s-purge` deletes data.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `no kubectl context named docker-desktop` | Kubernetes isn't enabled. In Docker Desktop, Kubernetes, Create cluster. |
| A pod shows `OOMKilled` | It hit its memory limit. Raise Docker's memory, or the limit under `apps.<name>.resources` in `values.yaml`. |
| The ingest Job fails | `kubectl -n provenance logs job/regulatory-ingest`. The large regulatory PDF needs about 3 GB; the limit is `jobs.ingest.resources`. |
| `image provenance/... doesn't exist yet` | Run `make k8s-up` with no `s=` once, so every image is built. |
| The browser can't reach `provenance.localhost` | Something else holds port 80, or the ingress pod isn't ready. `make k8s-status` and `kubectl -n ingress-nginx get pods`. |
| First answer from Trace, a classification or a search is slow | Models load into memory on first use (20 to 30 seconds). Later calls are fast. |
| A document stays queued | The worker can't reach Redis or the API. `make k8s-logs s=worker`. |
| The worker or API pod was killed mid-job | Nothing to do. An interrupted document is picked up again within about a minute (tested with a forced kill). |
| Everything is slow | Ollama runs on CPU here, as it does in Docker Compose. Answers take 5 to 15 seconds. |

## Moving to a cloud cluster

The chart needs a `values-<env>.yaml` with the registry's image names, the cloud ingress class and host, the cloud storage class, and secrets supplied by the cluster (for example External Secrets) instead of `make k8s-secrets`. Everything else carries over. The monitoring stack carries over unchanged apart from storage classes and the alert email provider; see [MONITORING.md](MONITORING.md#moving-to-a-cloud-cluster).

# GitOps with Argo CD

Argo CD makes Git the source of truth for the cluster. Merge to `main`, and the cluster follows. Reverting a commit rolls the cluster back. If someone changes something by hand in the cluster, Argo CD puts it back.

## How a change reaches the cluster

```
git push main
   |
   v
CI workflow            tests, lint, chart checks
   |  (green)
   v
Images workflow        builds only the services whose directory changed,
   |                   pushes ghcr.io/<owner>/provenance-<service>:<tag>
   v
bot commit             infra/helm/provenance/values-images.yaml gets the new tags
   |
   v
Argo CD (every 3 min)  sees the commit, renders the chart, applies the difference
   |
   v
cluster                only pods whose image changed restart
```

- **Tags are content hashes.** A service's tag is the first 12 characters of the Git tree hash of its directory (`apps/backend-service`, and so on). Change a file there and the tag changes. Change something else and it doesn't, so unrelated services don't restart and don't reload their models.
- **Builds are skipped when the tag already exists** in the registry, and use the GitHub Actions layer cache otherwise.
- **Images are multi-architecture** (`linux/amd64` and `linux/arm64`, built natively on matching runners), so the same tags run on an Apple Silicon laptop and on an x86 cloud cluster.
- **The worker uses the backend image**, so they always run the same build.

## What Argo CD manages

| Application | Source | Namespace |
| --- | --- | --- |
| `provenance` | `infra/helm/provenance` with `values.yaml`, `values-local.yaml`, `values-images.yaml` and `values-gitops.yaml` | `provenance` |
| `monitoring-stack` | `kube-prometheus-stack` with `infra/monitoring/kube-prometheus-stack-values.yaml` | `monitoring` |
| `monitoring-loki` | `loki` with `infra/monitoring/loki-values.yaml` | `monitoring` |
| `monitoring-alloy` | `alloy` with `infra/monitoring/alloy-values.yaml` | `monitoring` |
| `monitoring-rules` | `infra/monitoring/chart` (scrape config, alert rules, dashboards) | `monitoring` |

A `root` application watches `infra/argocd/applications/`, so adding a file there adds an application. All of them sync automatically, prune what was removed from Git and self-heal manual changes.

Not managed, on purpose: the NGINX ingress controller (a cluster prerequisite, installed by `make k8s-bootstrap`), and Secrets (created from your local `.env` files by `make k8s-secrets`, since secrets never go in Git).

## First time

1. **Push to `main`.** The CI workflow runs, then the Images workflow builds everything and commits `values-images.yaml`. The first run is long (the classifier and regulatory images are about 2 GB each); later runs only build what changed.
2. **Check the packages are public.** Packages published from a public repository are public too, and the first run confirmed all five can be pulled without logging in. If you fork this into a private repository, set each package (`provenance-backend`, `provenance-web`, `provenance-ocr`, `provenance-rag-classify`, `provenance-rag-regulatory`) to Public under Package settings, Change visibility, or add an `imagePullSecrets` entry.
3. **Run `make k8s-argocd-up`.** It checks that every image in `values-images.yaml` can be pulled, installs Argo CD, prepares the monitoring secrets, and registers the project and the root application.
4. **Watch it settle** with `make k8s-argocd-status` or `make k8s-argocd` (UI).

The cut-over rolls every service onto its registry image once, which is a restart. A one-off preview of exactly what changes, before you run it: render the chart with the four value files and `kubectl diff` it.

## Day to day

| You want to | Do |
| --- | --- |
| Ship a code change | Merge to `main`. Nothing else. |
| Change config or the chart | Edit the files and merge. Argo CD applies it within about 3 minutes. |
| Apply right now | `make k8s-argocd-sync` |
| See what is deployed and whether it is in sync | `make k8s-argocd-status`, or the UI |
| Roll back | `git revert` the commit and push. Argo CD rolls the cluster back. |
| Open the UI | `make k8s-argocd` (prints the admin password, opens http://localhost:8081) |

## What changes for the other make targets

- **`make k8s-up`** refuses to run while Argo CD manages the app. It would be undone within minutes anyway. Push instead.
- **`make k8s-monitoring-up` and `-down`** refuse in the same way.
- **`make k8s-stop` and `make k8s-start`** still work: they pause Argo CD's auto-sync for the app first, and resume it after starting, so the scale-down isn't reverted.
- **`make k8s-down` and `make k8s-purge`** refuse, because the app isn't a Helm release any more.
- **`make k8s-ingest`** still re-indexes the regulatory sources, with a separate one-off job.
- **`make k8s-argocd-down`** removes Argo CD and leaves the app and monitoring running. After that `make k8s-up` and `make k8s-monitoring-up` work again; if Helm reports that a resource already exists and isn't part of its release, delete that resource and re-run.

## Jobs

Under Helm the chart's two one-off jobs are Helm hooks (`helm.sh/hook`). Argo CD would run those on every sync, so in GitOps mode (`gitops: true` in `values-gitops.yaml`) they are ordinary jobs marked `Replace=true`: they run once, and again only when their definition changes (a new regulatory image re-checks the index, which is a no-op when it is already built).

## Alerts

The Alertmanager configuration, including the SMTP login, comes from a Secret that `make k8s-argocd-up` creates from `infra/.env`, because the email address and password must not be in Git. Edit `infra/.env`, then `make k8s-argocd-up` again to refresh it.

## Memory

Argo CD adds about 150 MB idle (the application controller and repo server rise while rendering the monitoring chart). It is small enough to leave on.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `make k8s-argocd-up` says images can't be pulled anonymously | The Images workflow hasn't finished, or the packages are private (step 2 above). |
| A pod sits in `ImagePullBackOff` | The same: the package is private. Make it public, or add an `imagePullSecrets` entry in `values-gitops.yaml` and create the secret. |
| The Images workflow fails on a push | Read the failing build in the Actions tab. The tags are only committed when every build succeeded, so the cluster keeps the previous images. |
| Application stuck `OutOfSync` on a job | Jobs are immutable; `Replace=true` should recreate them. Delete the job and sync. |
| `monitoring-rules` shows a missing CRD at first | It waits for `monitoring-stack` to install the Prometheus CRDs and retries. |
| Changes in Git don't show up | Argo CD polls every 3 minutes. `make k8s-argocd-sync` checks now. |

## Moving to a cloud cluster

The same Applications work against another cluster. Create `values-<env>.yaml` with the cloud ingress class, host and storage class, point the `provenance` Application's `valueFiles` at it, and keep `values-images.yaml` and `values-gitops.yaml`. The images already run on `amd64`. Add an `imagePullSecrets` entry if the packages are private there.

## Where things live

```
.github/workflows/images.yml            builds, pushes, records tags
.github/scripts/images.py               service table, tag calculation, manifest and values steps
infra/helm/provenance/values-images.yaml   written by CI, never by hand
infra/helm/provenance/values-gitops.yaml   switches the jobs to Argo CD style
infra/argocd/                           Argo CD values, project, root and applications
infra/k8s/argocd.sh                     install, remove, UI, pause and resume
```

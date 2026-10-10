#!/bin/sh
set -eu
. "$(dirname "$0")/env.sh"

job=regulatory-ingest-forced

kube delete job "$job" -n "$K8S_NAMESPACE" --ignore-not-found >/dev/null
images_values=""
if [ -f "$chart/values-images.yaml" ] && kube -n "${ARGOCD_NAMESPACE:-argocd}" get application provenance >/dev/null 2>&1; then
  images_values="--values $chart/values-images.yaml"
fi
helm --kube-context "$K8S_CONTEXT" template "$K8S_RELEASE" "$chart" \
  --namespace "$K8S_NAMESPACE" \
  --values "$chart/values-local.yaml" $images_values \
  --set jobs.ollamaPull.enabled=false \
  --set jobs.ingest.force=true \
  --set gitops=true \
  --show-only templates/jobs.yaml |
  sed "s/^  name: regulatory-ingest$/  name: $job/" |
  kube apply -n "$K8S_NAMESPACE" -f - >/dev/null

echo "waiting for the ingest to finish (a few minutes)"
kube wait --for=condition=complete "job/$job" -n "$K8S_NAMESPACE" --timeout=30m
kube logs "job/$job" -n "$K8S_NAMESPACE" | grep Ingested

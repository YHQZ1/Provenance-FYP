#!/bin/sh
set -eu
. "$(dirname "$0")/env.sh"

kube delete job regulatory-ingest -n "$K8S_NAMESPACE" --ignore-not-found >/dev/null
helm --kube-context "$K8S_CONTEXT" template "$K8S_RELEASE" "$chart" \
  --namespace "$K8S_NAMESPACE" \
  --values "$chart/values-local.yaml" \
  --set jobs.ollamaPull.enabled=false \
  --set jobs.ingest.force=true \
  --show-only templates/jobs.yaml | kube apply -n "$K8S_NAMESPACE" -f - >/dev/null

echo "waiting for the ingest to finish (a few minutes)"
kube wait --for=condition=complete job/regulatory-ingest -n "$K8S_NAMESPACE" --timeout=30m
kube logs job/regulatory-ingest -n "$K8S_NAMESPACE" | grep Ingested

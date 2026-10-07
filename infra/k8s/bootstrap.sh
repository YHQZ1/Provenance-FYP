#!/bin/sh
set -eu
. "$(dirname "$0")/env.sh"

for name in INGRESS_NGINX_REPO INGRESS_NGINX_VERSION; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "bootstrap: $name is missing from infra/.env" >&2
    exit 1
  fi
done

helm --kube-context "$K8S_CONTEXT" upgrade --install ingress-nginx ingress-nginx \
  --repo "$INGRESS_NGINX_REPO" \
  --version "$INGRESS_NGINX_VERSION" \
  --namespace ingress-nginx --create-namespace \
  --values "$root/infra/k8s/ingress-nginx-values.yaml" \
  --wait --timeout 5m

#!/bin/sh
set -eu
. "$(dirname "$0")/env.sh"

apps="backend worker frontend ocr-service rag-classify rag-regulatory"

image_of() {
  case "$1" in
    backend|worker) echo provenance/backend:local ;;
    frontend) echo provenance/web:local ;;
    ocr-service) echo provenance/ocr:local ;;
    rag-classify) echo provenance/rag-classify:local ;;
    rag-regulatory) echo provenance/rag-regulatory:local ;;
  esac
}

build_one() {
  case "$1" in
    backend) docker build -q --provenance=false --sbom=false -t "$(image_of backend)" "$root/apps/backend-service" >/dev/null ;;
    frontend) docker build -q --provenance=false --sbom=false -f "$root/apps/web-app/Dockerfile.prod" -t "$(image_of frontend)" "$root/apps/web-app" >/dev/null ;;
    ocr-service) docker build -q --provenance=false --sbom=false -t "$(image_of ocr-service)" "$root/apps/ocr-service" >/dev/null ;;
    rag-classify) docker build -q --provenance=false --sbom=false -t "$(image_of rag-classify)" "$root/apps/rag-classify" >/dev/null ;;
    rag-regulatory) docker build -q --provenance=false --sbom=false -t "$(image_of rag-regulatory)" "$root/apps/rag-regulatory" >/dev/null ;;
    worker) ;;
    *)
      echo "up: unknown service $1. Choose from: $apps" >&2
      exit 1
      ;;
  esac
}

if [ "$#" -gt 0 ]; then
  selected="$*"
else
  selected="$apps"
fi

for name in $selected; do
  echo "building $name"
  build_one "$name"
done

sets=""
for name in $apps; do
  id=$(docker image inspect "$(image_of "$name")" --format '{{.Id}}' 2>/dev/null || true)
  if [ -z "$id" ]; then
    echo "up: image $(image_of "$name") doesn't exist yet. Run make k8s-up with no service to build everything." >&2
    exit 1
  fi
  sets="$sets --set-string apps.$name.imageId=$id"
done

"$root/infra/k8s/bootstrap.sh" >/dev/null
"$root/infra/k8s/secrets.sh" >/dev/null

echo "deploying to $K8S_CONTEXT/$K8S_NAMESPACE"
helm --kube-context "$K8S_CONTEXT" upgrade --install "$K8S_RELEASE" "$chart" \
  --namespace "$K8S_NAMESPACE" --create-namespace \
  --values "$chart/values-local.yaml" \
  $sets \
  --wait --timeout 30m
echo "ready at http://$INGRESS_HOST"

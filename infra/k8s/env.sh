root=$(cd "$(dirname "$0")/../.." && pwd)
env_file="$root/infra/.env"

if [ ! -f "$env_file" ]; then
  echo "$(basename "$0"): $env_file not found. Run: make env" >&2
  exit 1
fi

set -a
. "$env_file"
set +a

for name in K8S_CONTEXT K8S_NAMESPACE K8S_RELEASE; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "$(basename "$0"): $name is missing from infra/.env" >&2
    exit 1
  fi
done

if ! kubectl config get-contexts -o name | grep -qx "$K8S_CONTEXT"; then
  echo "$(basename "$0"): no kubectl context named $K8S_CONTEXT. Is Kubernetes enabled in Docker Desktop?" >&2
  exit 1
fi

kube() {
  kubectl --context "$K8S_CONTEXT" "$@"
}

chart="$root/infra/helm/provenance"

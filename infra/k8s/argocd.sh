#!/bin/sh
set -eu
. "$(dirname "$0")/env.sh"
. "$(dirname "$0")/monitoring-lib.sh"

: "${ARGOCD_NAMESPACE:=argocd}"
: "${ARGOCD_REPO:=https://argoproj.github.io/argo-helm}"
: "${ARGOCD_VERSION:=10.9.2}"
: "${ARGOCD_PORT:=8081}"

argocd_dir="$root/infra/argocd"
images_file="$chart/values-images.yaml"
applications="provenance monitoring-stack monitoring-loki monitoring-alloy monitoring-rules"
automated='{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
manual='{"spec":{"syncPolicy":{"automated":null}}}'

akube() {
  kube -n "$ARGOCD_NAMESPACE" "$@"
}

ahelm() {
  helm --kube-context "$K8S_CONTEXT" --namespace "$ARGOCD_NAMESPACE" "$@"
}

has_application() {
  akube get application "$1" >/dev/null 2>&1
}

check_images() {
  if [ ! -f "$images_file" ]; then
    echo "argocd: $images_file is missing. Run the Images workflow on GitHub first." >&2
    exit 1
  fi
  missing=""
  for reference in $(sed -n 's/^ *image: //p' "$images_file" | sort -u); do
    if ! docker manifest inspect "$reference" >/dev/null 2>&1; then
      missing="$missing $reference"
    fi
  done
  if [ -n "$missing" ]; then
    echo "argocd: these images can't be pulled anonymously yet:" >&2
    for reference in $missing; do
      echo "  $reference" >&2
    done
    echo "Wait for the Images workflow to finish, and make each package public in GitHub (Packages, Package settings, Change visibility)." >&2
    exit 1
  fi
  echo "all images are published"
}

up() {
  if [ -z "${ARGOCD_SKIP_IMAGE_CHECK:-}" ]; then
    check_images
  fi

  ensure_monitoring_namespace
  ensure_grafana_secret
  ensure_smtp_secret
  ensure_alertmanager_secret

  echo "installing Argo CD"
  ahelm upgrade --install argocd argo-cd \
    --repo "$ARGOCD_REPO" --version "$ARGOCD_VERSION" \
    --create-namespace \
    --values "$argocd_dir/argocd-values.yaml" \
    --wait --timeout 10m

  echo "registering the project and the root application"
  akube apply -f "$argocd_dir/project.yaml" >/dev/null
  akube apply -f "$argocd_dir/root.yaml" >/dev/null

  echo
  echo "Argo CD now follows Git. Watch it with: make k8s-argocd-status"
  echo "Open the UI with: make k8s-argocd"
}

down() {
  for application in root $applications; do
    akube delete application "$application" --ignore-not-found >/dev/null 2>&1 || true
  done
  akube delete appproject provenance --ignore-not-found >/dev/null 2>&1 || true
  ahelm uninstall argocd >/dev/null 2>&1 && echo "removed argocd" || true
  echo "The app and monitoring keep running. Manage them again with: make k8s-up and make k8s-monitoring-up"
}

ui() {
  password=$(akube get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)
  echo "Argo CD user: admin"
  echo "Argo CD password: $password"
  echo "forwarding http://localhost:$ARGOCD_PORT (Ctrl-C to stop)"
  if command -v open >/dev/null 2>&1; then
    (sleep 2 && open "http://localhost:$ARGOCD_PORT") &
  fi
  exec kubectl --context "$K8S_CONTEXT" -n "$ARGOCD_NAMESPACE" port-forward svc/argocd-server "$ARGOCD_PORT:80"
}

status() {
  akube get applications
}

sync() {
  for application in root $applications; do
    akube annotate application "$application" argocd.argoproj.io/refresh=hard --overwrite >/dev/null 2>&1 || true
  done
  echo "refresh requested. Watch with: make k8s-argocd-status"
}

pause() {
  has_application provenance || exit 0
  akube patch application root --type merge -p "$manual" >/dev/null
  akube patch application provenance --type merge -p "$manual" >/dev/null
  echo "paused Argo CD sync for the app"
}

resume() {
  has_application provenance || exit 0
  akube patch application provenance --type merge -p "$automated" >/dev/null
  akube patch application root --type merge -p "$automated" >/dev/null
  echo "resumed Argo CD sync for the app"
}

guard() {
  if has_application "$1"; then
    echo "Argo CD manages $1. Change Git and let it sync, or remove Argo CD first with: make k8s-argocd-down" >&2
    exit 1
  fi
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  ui) ui ;;
  status) status ;;
  sync) sync ;;
  pause) pause ;;
  resume) resume ;;
  guard) guard "${2:?usage: argocd.sh guard APPLICATION}" ;;
  check-images) check_images ;;
  *)
    echo "usage: argocd.sh up|down|ui|status|sync|pause|resume|guard|check-images" >&2
    exit 1
    ;;
esac

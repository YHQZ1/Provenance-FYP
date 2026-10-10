#!/bin/sh
set -eu
. "$(dirname "$0")/env.sh"
. "$(dirname "$0")/monitoring-lib.sh"

: "${PROMETHEUS_REPO:=https://prometheus-community.github.io/helm-charts}"
: "${PROMETHEUS_STACK_VERSION:=91.4.1}"
: "${GRAFANA_REPO:=https://grafana.github.io/helm-charts}"
: "${LOKI_VERSION:=7.3.0}"
: "${ALLOY_VERSION:=1.12.1}"
: "${GRAFANA_PORT:=3001}"
: "${PROMETHEUS_PORT:=9090}"
: "${ALERTMANAGER_PORT:=9093}"

monitoring="$root/infra/monitoring"

guard_argocd() {
  if kube -n "${ARGOCD_NAMESPACE:-argocd}" get application monitoring-stack >/dev/null 2>&1; then
    echo "monitoring: Argo CD manages the monitoring stack. Change Git and let it sync, or remove Argo CD first with: make k8s-argocd-down" >&2
    exit 1
  fi
}

up() {
  guard_argocd
  ensure_monitoring_namespace
  ensure_grafana_secret
  ensure_smtp_secret

  values=$(mktemp)
  trap 'rm -f "$values"' EXIT
  render_alertmanager "$values"

  echo "installing Prometheus, Grafana and Alertmanager"
  mhelm upgrade --install monitoring kube-prometheus-stack \
    --repo "$PROMETHEUS_REPO" --version "$PROMETHEUS_STACK_VERSION" \
    --values "$monitoring/kube-prometheus-stack-values.yaml" --values "$values" \
    --wait --timeout 10m

  echo "installing Loki"
  mhelm upgrade --install loki loki \
    --repo "$GRAFANA_REPO" --version "$LOKI_VERSION" \
    --values "$monitoring/loki-values.yaml" --wait --timeout 10m

  echo "installing Alloy"
  mhelm upgrade --install alloy alloy \
    --repo "$GRAFANA_REPO" --version "$ALLOY_VERSION" \
    --values "$monitoring/alloy-values.yaml" --wait --timeout 5m

  echo "installing the Provenance scrape config, alert rules and dashboards"
  mhelm upgrade --install provenance-monitoring "$monitoring/chart" \
    --set-string appNamespace="$K8S_NAMESPACE" --wait --timeout 2m

  echo
  if smtp_ready; then
    echo "alerts: email to $ALERT_EMAIL_TO"
  else
    echo "alerts: visible in Alertmanager only. Set ALERT_EMAIL_TO, SMTP_SMARTHOST, SMTP_USER and SMTP_PASSWORD in infra/.env and run this again to get email."
  fi
  echo "open Grafana with: make k8s-grafana"
}

down() {
  guard_argocd
  for release in provenance-monitoring alloy loki monitoring; do
    mhelm uninstall "$release" >/dev/null 2>&1 && echo "removed $release" || true
  done
  echo "Metrics and logs are kept in the volumes. To delete them too: kubectl --context $K8S_CONTEXT delete namespace $MONITORING_NAMESPACE"
}

forward() {
  service=$1
  local_port=$2
  remote_port=$3
  echo "forwarding http://localhost:$local_port (Ctrl-C to stop)"
  if command -v open >/dev/null 2>&1; then
    (sleep 2 && open "http://localhost:$local_port") &
  fi
  exec kubectl --context "$K8S_CONTEXT" -n "$MONITORING_NAMESPACE" port-forward "svc/$service" "$local_port:$remote_port"
}

grafana() {
  password=$(mkube get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d)
  echo "Grafana user: admin"
  echo "Grafana password: $password"
  forward monitoring-grafana "$GRAFANA_PORT" 80
}

status() {
  mkube get pods
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  grafana) grafana ;;
  prometheus) forward monitoring-kube-prometheus-prometheus "$PROMETHEUS_PORT" 9090 ;;
  alertmanager) forward monitoring-kube-prometheus-alertmanager "$ALERTMANAGER_PORT" 9093 ;;
  status) status ;;
  *)
    echo "usage: monitoring.sh up|down|grafana|prometheus|alertmanager|status" >&2
    exit 1
    ;;
esac

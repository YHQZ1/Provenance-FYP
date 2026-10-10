#!/bin/sh
set -eu
. "$(dirname "$0")/env.sh"

: "${MONITORING_NAMESPACE:=monitoring}"
: "${PROMETHEUS_REPO:=https://prometheus-community.github.io/helm-charts}"
: "${PROMETHEUS_STACK_VERSION:=91.4.1}"
: "${GRAFANA_REPO:=https://grafana.github.io/helm-charts}"
: "${LOKI_VERSION:=7.3.0}"
: "${ALLOY_VERSION:=1.12.1}"
: "${GRAFANA_PORT:=3001}"
: "${PROMETHEUS_PORT:=9090}"
: "${ALERTMANAGER_PORT:=9093}"

monitoring="$root/infra/monitoring"

mkube() {
  kube -n "$MONITORING_NAMESPACE" "$@"
}

mhelm() {
  helm --kube-context "$K8S_CONTEXT" --namespace "$MONITORING_NAMESPACE" "$@"
}

smtp_ready() {
  [ -n "${ALERT_EMAIL_TO:-}" ] && [ -n "${SMTP_SMARTHOST:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASSWORD:-}" ]
}

ensure_namespace() {
  kube get namespace "$MONITORING_NAMESPACE" >/dev/null 2>&1 || kube create namespace "$MONITORING_NAMESPACE" >/dev/null
}

ensure_grafana_secret() {
  if ! mkube get secret grafana-admin >/dev/null 2>&1; then
    password=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 20)
    mkube create secret generic grafana-admin \
      --from-literal=admin-user=admin --from-literal=admin-password="$password" >/dev/null
  fi
}

ensure_smtp_secret() {
  printf '%s' "${SMTP_PASSWORD:-unused}" |
    mkube create secret generic alertmanager-smtp --from-file=password=/dev/stdin \
      --dry-run=client -o yaml | mkube apply -f - >/dev/null
}

render_alertmanager() {
  if smtp_ready; then
    cat >"$1" <<YAML
alertmanager:
  config:
    global:
      resolve_timeout: 5m
      smtp_smarthost: "$SMTP_SMARTHOST"
      smtp_from: "${ALERT_EMAIL_FROM:-$SMTP_USER}"
      smtp_auth_username: "$SMTP_USER"
      smtp_auth_password_file: /etc/alertmanager/secrets/alertmanager-smtp/password
      smtp_require_tls: true
    route:
      receiver: email
      group_by: [alertname, namespace, pod, job]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
      routes:
        - receiver: "null"
          matchers:
            - alertname = "Watchdog"
    receivers:
      - name: "null"
      - name: email
        email_configs:
          - to: "$ALERT_EMAIL_TO"
            send_resolved: true
YAML
  else
    cat >"$1" <<'YAML'
alertmanager:
  config:
    route:
      receiver: "null"
      group_by: [alertname, namespace, pod, job]
      routes: []
    receivers:
      - name: "null"
YAML
  fi
}

up() {
  ensure_namespace
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

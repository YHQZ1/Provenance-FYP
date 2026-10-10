: "${MONITORING_NAMESPACE:=monitoring}"
: "${ALERTMANAGER_SECRET:=alertmanager-monitoring-kube-prometheus-alertmanager}"

mkube() {
  kube -n "$MONITORING_NAMESPACE" "$@"
}

mhelm() {
  helm --kube-context "$K8S_CONTEXT" --namespace "$MONITORING_NAMESPACE" "$@"
}

smtp_ready() {
  [ -n "${ALERT_EMAIL_TO:-}" ] && [ -n "${SMTP_SMARTHOST:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASSWORD:-}" ]
}

ensure_monitoring_namespace() {
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

alertmanager_config() {
  if smtp_ready; then
    cat <<YAML
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
    cat <<'YAML'
route:
  receiver: "null"
  group_by: [alertname, namespace, pod, job]
  routes: []
receivers:
  - name: "null"
YAML
  fi
}

render_alertmanager() {
  {
    printf 'alertmanager:\n  config:\n'
    alertmanager_config | sed 's/^/    /'
  } >"$1"
}

ensure_alertmanager_secret() {
  alertmanager_config |
    mkube create secret generic "$ALERTMANAGER_SECRET" --from-file=alertmanager.yaml=/dev/stdin \
      --dry-run=client -o yaml | mkube apply -f - >/dev/null
}

#!/bin/sh
set -eu
. "$(dirname "$0")/env.sh"

kube get namespace "$K8S_NAMESPACE" >/dev/null 2>&1 || kube create namespace "$K8S_NAMESPACE" >/dev/null

create_secret() {
  name=$1
  file=$2
  shift 2
  if [ ! -f "$file" ]; then
    echo "secrets: $file not found" >&2
    exit 1
  fi
  staged=$(mktemp)
  chmod 600 "$staged"
  python3 - "$file" "$staged" "$@" <<'PY'
import sys

source, target, *wanted = sys.argv[1:]
values = {}
for line in open(source, encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    values[key.strip()] = value

missing = [key for key in wanted if not values.get(key)]
if missing:
    sys.exit("secrets: " + ", ".join(missing) + " missing from " + source)
with open(target, "w", encoding="utf-8") as out:
    for key in wanted:
        out.write(f"{key}={values[key]}\n")
PY
  status=0
  kube create secret generic "$name" -n "$K8S_NAMESPACE" --from-env-file="$staged" \
    --dry-run=client -o yaml | kube apply -f - >/dev/null || status=$?
  rm -f "$staged"
  [ "$status" -eq 0 ] || exit "$status"
  echo "secret/$name"
}

create_secret provenance-backend-secrets "$root/apps/backend-service/.env.development" \
  SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
create_secret provenance-classifier-secrets "$root/apps/rag-classify/.env" DATABASE_URL
create_secret provenance-web-config "$root/apps/web-app/.env.development" \
  VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY

#!/bin/sh
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

helm template monitoring "$root/infra/monitoring/chart" > "$work/rendered.yaml"

python3 - "$work" <<'PY'
import sys

import yaml

work = sys.argv[1]
for document in yaml.safe_load_all(open(f"{work}/rendered.yaml", encoding="utf-8")):
    if document and document.get("kind") == "PrometheusRule":
        with open(f"{work}/rules.yaml", "w", encoding="utf-8") as out:
            yaml.safe_dump({"groups": document["spec"]["groups"]}, out, sort_keys=False)
PY

docker run --rm --user "$(id -u):$(id -g)" -v "$work":/work --entrypoint promtool prom/prometheus:v3.5.0 check rules /work/rules.yaml

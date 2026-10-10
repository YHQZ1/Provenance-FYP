#!/bin/sh
set -eu

html_dir=/usr/share/nginx/html

for name in VITE_API_URL VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "runtime-config: $name is required" >&2
    exit 1
  fi
done

escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

{
  printf 'window.__ENV__ = {\n'
  for name in VITE_API_URL VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_SITE_URL VITE_EPR_PORTAL_URL VITE_SENTRY_DSN VITE_SENTRY_ENVIRONMENT; do
    eval "value=\${$name:-}"
    printf '  "%s": "%s",\n' "$name" "$(escape "$value")"
  done
  printf '};\n'
} > "$html_dir/config.js"

if [ -n "${VITE_SITE_URL:-}" ]; then
  site=$(printf '%s' "$VITE_SITE_URL" | sed -e 's/[&|\\]/\\&/g')
  sed -i "s|%VITE_SITE_URL%|$site|g" "$html_dir/index.html"
fi

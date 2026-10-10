#!/bin/sh
set -eu

supabase=${SUPABASE:-supabase}

$supabase status -o env |
  sed -n \
    -e 's/^API_URL="\(.*\)"$/E2E_SUPABASE_URL=\1/p' \
    -e 's/^ANON_KEY="\(.*\)"$/E2E_SUPABASE_ANON_KEY=\1/p' \
    -e 's/^SERVICE_ROLE_KEY="\(.*\)"$/E2E_SUPABASE_SERVICE_ROLE_KEY=\1/p'

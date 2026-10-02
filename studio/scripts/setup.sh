#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  umask 077
  token=$(openssl rand -hex 24)
  password=$(openssl rand -hex 24)
  printf 'POSTGRES_PASSWORD=%s\nAPP_ORIGIN=http://localhost:5178\nBOOTSTRAP_TOKEN=%s\nOPENROUTER_API_KEY=\nTYPESAFE_API_KEY=\nAI_ENABLED=false\n' "$password" "$token" > .env
fi
printf 'Local configuration ready. Start with: docker compose up --build -d\n'
printf 'Find your one-time setup token in .env (BOOTSTRAP_TOKEN).\n'

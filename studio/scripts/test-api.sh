#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
set -a
. ./.env
set +a
export DATABASE_URL="postgres://studio:${POSTGRES_PASSWORD}@127.0.0.1:5448/studio_e2e?sslmode=disable"
export APP_ORIGIN=http://localhost:15178
export LISTEN_ADDR=127.0.0.1:18088
export STORAGE_PATH="$PWD/.data/test-files"
export BOOTSTRAP_TOKEN=test-browser-bootstrap
export AI_ENABLED=false
cd api
exec go run ./cmd/server

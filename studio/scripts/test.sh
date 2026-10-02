#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
set -a
. ./.env
set +a
export TEST_DATABASE_URL="postgres://studio:${POSTGRES_PASSWORD}@127.0.0.1:5448/studio_test?sslmode=disable"
cd api
go test -race ./...
cd ../web
npm run check
npm run build

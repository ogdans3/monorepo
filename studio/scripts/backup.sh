#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
umask 077
studio_backup_db=studio
studio_backup_api=api
if [ "${1:-}" = '--test' ]; then
  studio_backup_db=studio_media_test
  studio_backup_api=api-test
elif [ "$#" -ne 0 ]; then
  printf 'Bruk: backup.sh [--test]\n' >&2
  exit 1
fi
studio_backup_dir=".data/backups/${studio_backup_db}-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$studio_backup_dir"
docker compose -f compose.yml -f compose.test.yml pause "$studio_backup_api"
trap 'docker compose -f compose.yml -f compose.test.yml unpause "$studio_backup_api" >/dev/null' EXIT HUP INT TERM
docker compose exec -T db pg_dump -U studio -d "$studio_backup_db" -Fc > "$studio_backup_dir/database.dump"
docker compose -f compose.yml -f compose.test.yml run --rm -T --no-deps --entrypoint tar "$studio_backup_api" -C /data/files -czf - . > "$studio_backup_dir/files.tar.gz"
(cd "$studio_backup_dir" && sha256sum database.dump files.tar.gz > SHA256SUMS)
printf 'Sikkerhetskopi: %s\n' "$studio_backup_dir"

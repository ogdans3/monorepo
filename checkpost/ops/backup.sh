#!/usr/bin/env bash
#
# Nightly dump of the Checkpost database.
#
# This exists because the lists no longer live in a hosted database somebody
# else backs up. They live in a container on one machine, and a volume is not a
# backup: it survives the container being recreated, and nothing else.
#
#   ops/backup.sh [destination]
#
# Destination defaults to $CHECKPOST_BACKUP_DIR, else ~/backups/checkpost.
# Install with cron:
#   17 3 * * * /home/ai_user/git/monorepo/checkpost/ops/backup.sh >> ~/backups/checkpost/log 2>&1
#
# Restore one with:
#   docker exec -i aicentral-checkpost-db-1 pg_restore -U checkpost -d checkpost \
#     --clean --if-exists --no-owner --no-acl < checkpost-<stamp>.dump

set -euo pipefail

CONTAINER="${CHECKPOST_DB_CONTAINER:-aicentral-checkpost-db-1}"
DEST="${1:-${CHECKPOST_BACKUP_DIR:-$HOME/backups/checkpost}}"
KEEP_DAYS="${CHECKPOST_BACKUP_KEEP_DAYS:-30}"
DB_USER="${POSTGRES_USER:-checkpost}"
DB_NAME="${POSTGRES_DB:-checkpost}"

say() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') backup: $*"; }

mkdir -p "$DEST"

if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != true ]; then
  say "FAILED: container $CONTAINER is not running. No backup taken."
  exit 1
fi

FILE="$DEST/checkpost-$(date -u '+%Y%m%dT%H%M%SZ').dump"
TMP="$FILE.partial"
INSIDE="/tmp/checkpost-backup.dump"

# The dump is written inside the container and copied out afterwards, rather
# than piped through stdout. A custom-format archive has to be seekable to be
# read back, and `pg_restore --list /dev/stdin` under `docker exec` is not:
# it fails with "did not find magic string in file header" on a perfectly good
# dump, which is a bad way to learn your backups are fine.
docker exec "$CONTAINER" rm -f "$INSIDE"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl --format=custom --file="$INSIDE"

# A dump that restores to an empty database is worse than no dump, because it
# looks like one. Refuse anything missing the tables the app cannot work without.
TOC="$(docker exec "$CONTAINER" pg_restore --list "$INSIDE")"
MISSING=""
for t in lists items share_links; do
  grep -q "TABLE DATA public $t " <<<"$TOC" || MISSING="$MISSING $t"
done

docker cp "$CONTAINER:$INSIDE" "$TMP" >/dev/null
docker exec "$CONTAINER" rm -f "$INSIDE"

if [ -n "$MISSING" ]; then
  mv "$TMP" "$FILE.suspect"
  say "FAILED: dump carries no table data for:$MISSING. Kept as $FILE.suspect"
  exit 1
fi

mv "$TMP" "$FILE"
say "wrote $FILE ($(du -h "$FILE" | cut -f1))"

# Prune, but never down to nothing: the newest dump stays whatever its age.
NEWEST="$(ls -1t "$DEST"/checkpost-*.dump 2>/dev/null | head -1 || true)"
if [ -n "$NEWEST" ]; then
  find "$DEST" -maxdepth 1 -name 'checkpost-*.dump' -mtime "+$KEEP_DAYS" \
    ! -samefile "$NEWEST" -print -delete | while read -r f; do say "pruned $f"; done
fi

say "done, $(ls -1 "$DEST"/checkpost-*.dump 2>/dev/null | wc -l) dumps in $DEST"

#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
# Never restores over a user's database or file volume.
studio_backup_dir=${1:?Oppgi mappen fra backup.sh}
(cd "$studio_backup_dir" && sha256sum -c SHA256SUMS)
docker compose exec -T db dropdb -U studio --if-exists studio_restore_test
docker compose exec -T db createdb -U studio studio_restore_test
docker compose exec -T db pg_restore -U studio -d studio_restore_test --exit-on-error < "$studio_backup_dir/database.dump"
python3 - "$studio_backup_dir/files.tar.gz" <<'PY'
import hashlib, json, pathlib, subprocess, sys, tarfile, tempfile
query="SELECT coalesce(json_agg(row_to_json(f)),'[]') FROM (SELECT DISTINCT file_key,checksum FROM versions WHERE file_key<>'' UNION SELECT DISTINCT file_key,'' FROM media_artifacts) f"
raw=subprocess.check_output(['docker','compose','exec','-T','db','psql','-U','studio','-d','studio_restore_test','-At','-c',query],text=True)
files=json.loads(raw)
with tempfile.TemporaryDirectory(prefix='studio-restore-') as directory:
    root=pathlib.Path(directory)
    with tarfile.open(sys.argv[1]) as archive:
        archive.extractall(root,filter='data')
    for item in files:
        path=root/item['file_key']
        if not path.resolve().is_relative_to(root.resolve()) or not path.is_file():
            raise SystemExit('Gjenopprettingen mangler en referert fil')
        if item['checksum']:
            with path.open('rb') as stream:
                digest=hashlib.file_digest(stream,'sha256').hexdigest()
            if digest!=item['checksum']:raise SystemExit('Filens sjekksum stemmer ikke')
    print(f'Gjenopprettet og verifisert {len(files)} filreferanser mot databasen.')
PY
docker compose exec -T db psql -U studio -d studio_restore_test -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS items FROM items; SELECT count(*) AS migrations FROM schema_migrations;'
docker compose exec -T db dropdb -U studio studio_restore_test

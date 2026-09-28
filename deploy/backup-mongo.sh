#!/usr/bin/env bash
# Backup harian MongoDB Usahaku/Situska. Retensi 7 hari. Tanpa kredensial di file.
set -euo pipefail
DIR="${BACKUP_DIR:-/root/backups}"
KEEP="${BACKUP_KEEP_DAYS:-7}"
CONT="${MONGO_CONTAINER:-usahaku-mongo-1}"
DB="${MONGO_DB:-usahaku}"
mkdir -p "$DIR"
OUT="$DIR/$DB-$(date +%F-%H%M).archive.gz"
docker exec "$CONT" mongodump --db "$DB" --archive --gzip > "$OUT"
SIZE=$(stat -c%s "$OUT")
if [ "$SIZE" -lt 1000 ]; then echo "GAGAL: backup terlalu kecil ($SIZE byte)"; rm -f "$OUT"; exit 1; fi
find "$DIR" -name "*.archive.gz" -mtime +"$KEEP" -delete
echo "OK $OUT ($SIZE byte) | tersimpan: $(ls -1 "$DIR"/*.archive.gz | wc -l) file"
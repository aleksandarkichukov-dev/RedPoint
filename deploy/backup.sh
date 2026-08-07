#!/bin/sh
# One backup: the database and the photography.
#
#   ./deploy/backup.sh              writes into ./backups
#   BACKUP_DIR=/mnt/x ./deploy/backup.sh
#
# Run nightly from cron on the VPS:
#   0 3 * * * cd /srv/redpoint && ./deploy/backup.sh >> /var/log/redpoint-backup.log 2>&1
#
# Both halves, because either alone is useless. The database holds the orders,
# the customers and the catalogue text; the photography lives on a volume and
# is not in the database at all. Restoring only the database gives a shop where
# every product has an empty frame — which is exactly the failure that turned
# up on this project once already, from the same fact.
#
# Written for /bin/sh so it runs on the VPS without assuming bash.

set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"

# Fail early and loudly. A backup script that carries on past a missing
# container writes an empty file and reports success, and nobody looks at a
# backup until the day it is the only thing left.
command -v docker >/dev/null || { echo "docker not found"; exit 1; }

mkdir -p "$BACKUP_DIR"

DB_FILE="$BACKUP_DIR/redpoint-db-$STAMP.sql.gz"
PHOTOS_FILE="$BACKUP_DIR/redpoint-photos-$STAMP.tar.gz"

echo "[$(date +%H:%M:%S)] dumping the database"
# --clean --if-exists so the dump can be restored over an existing database
# rather than only into an empty one. The restore is the part nobody rehearses,
# so it should need as few flags as possible when it finally happens.
docker exec redpoint-postgres pg_dump \
    --username "${POSTGRES_USER:-redpoint}" \
    --dbname "${POSTGRES_DB:-redpoint}" \
    --clean --if-exists \
  | gzip > "$DB_FILE"

echo "[$(date +%H:%M:%S)] archiving the photography"
# From inside the container, because the volume belongs to Docker and its path
# on the host is an implementation detail that changes between versions.
docker exec redpoint-backend tar -czf - -C /app/apps/backend/.medusa/server static \
  > "$PHOTOS_FILE"

# A dump that is suspiciously small is a dump that did not work. pg_dump can
# exit 0 having written nothing useful if the database is empty or the
# connection dropped mid-stream.
DB_SIZE=$(wc -c < "$DB_FILE")
if [ "$DB_SIZE" -lt 10000 ]; then
    echo "FAILED: the dump is only ${DB_SIZE} bytes. Not deleting anything."
    exit 1
fi

echo "[$(date +%H:%M:%S)] wrote:"
ls -lh "$DB_FILE" "$PHOTOS_FILE"

# Old ones go only after a good one has been written, never before. Deleting
# first frees disk space and then fails to fill it.
find "$BACKUP_DIR" -name 'redpoint-*' -type f -mtime "+$KEEP_DAYS" -print -delete

echo "[$(date +%H:%M:%S)] done"
echo
echo "To restore the database:"
echo "  gunzip -c $DB_FILE | docker exec -i redpoint-postgres psql -U ${POSTGRES_USER:-redpoint} -d ${POSTGRES_DB:-redpoint}"
echo "To restore the photography:"
echo "  docker exec -i redpoint-backend tar -xzf - -C /app/apps/backend/.medusa/server < $PHOTOS_FILE"

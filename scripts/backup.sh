#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="openclaw-backup-${TIMESTAMP}.tar.gz"

echo "openclaw-docker backup"
echo "======================"
echo

# check if there's anything to backup
if [ ! -d "data" ] && [ ! -d "workspaces" ]; then
    echo "error: nothing to backup (no data/ or workspaces/ directories)"
    exit 1
fi

# create backups directory
mkdir -p backups

# create tarball
echo "creating backup: backups/${BACKUP_FILE}"

DIRS_TO_BACKUP=""
[ -d "data" ] && DIRS_TO_BACKUP="$DIRS_TO_BACKUP data"
[ -d "workspaces" ] && DIRS_TO_BACKUP="$DIRS_TO_BACKUP workspaces"

tar -czf "backups/${BACKUP_FILE}" $DIRS_TO_BACKUP

# show backup info
SIZE=$(du -h "backups/${BACKUP_FILE}" | cut -f1)
echo
echo "backup complete: backups/${BACKUP_FILE} (${SIZE})"
echo
echo "contents:"
tar -tzf "backups/${BACKUP_FILE}" | head -20
TOTAL=$(tar -tzf "backups/${BACKUP_FILE}" | wc -l | tr -d ' ')
if [ "$TOTAL" -gt 20 ]; then
    echo "... and $((TOTAL - 20)) more files"
fi
echo
echo "to restore: make restore FILE=backups/${BACKUP_FILE}"

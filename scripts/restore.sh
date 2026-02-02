#!/bin/bash
set -euo pipefail

if [ $# -eq 0 ]; then
    echo "usage: ./scripts/restore.sh <backup-file.tar.gz>"
    exit 1
fi

BACKUP_FILE="$1"

echo "openclaw-docker restore"
echo "======================="
echo

# check backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "error: backup file not found: $BACKUP_FILE"
    exit 1
fi

# show what will be restored
echo "backup contents:"
tar -tzf "$BACKUP_FILE" | head -10
TOTAL=$(tar -tzf "$BACKUP_FILE" | wc -l | tr -d ' ')
if [ "$TOTAL" -gt 10 ]; then
    echo "... and $((TOTAL - 10)) more files"
fi
echo

# check for existing data
if [ -d "data" ] || [ -d "workspaces" ]; then
    echo "warning: existing data/ and/or workspaces/ will be overwritten"
    read -p "continue? [y/N] " confirm
    if [ "$confirm" != "y" ]; then
        echo "restore cancelled"
        exit 0
    fi
fi

# stop container if running
if docker compose ps --quiet 2>/dev/null | grep -q .; then
    echo "stopping container..."
    docker compose down
fi

# restore
echo "restoring from backup..."
tar -xzf "$BACKUP_FILE"

# set permissions
[ -d "data" ] && chmod 700 data
[ -d "workspaces" ] && chmod 700 workspaces

echo
echo "restore complete"
echo
echo "next steps:"
echo "  make up    # start the gateway"
echo "  make chat  # connect"

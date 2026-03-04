#!/bin/bash
set -euo pipefail

SERVER="${SERVER:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/openclaw-docker}"
DRY_RUN="${DRY_RUN:-0}"
DELETE="${DELETE:-0}"
INCLUDE_ENV="${INCLUDE_ENV:-0}"

if [ -z "$SERVER" ]; then
    echo "error: SERVER is required (example: SERVER=root@159.69.x.x)"
    exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
    echo "error: rsync is not installed"
    exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
    echo "error: ssh is not installed"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

RSYNC_ARGS=(
    -az
    --progress
    --partial
    --human-readable
    --exclude=.git/
    --exclude=.terraform/
    --exclude=.terraform.lock.hcl
    --exclude=terraform.tfstate
    --exclude=terraform.tfstate.*
    --exclude=node_modules/
    --exclude=.DS_Store
    --exclude=.idea/
    --exclude=.vscode/
    --exclude=*.swp
    --exclude=*.swo
    --exclude=*.sw?
    --exclude=backups/
    --exclude=*.tar.gz
    --exclude=.tldr/
    --exclude=.tasks/
)

if [ "$INCLUDE_ENV" != "1" ]; then
    RSYNC_ARGS+=(--exclude=.env)
fi

if [ "$DRY_RUN" = "1" ]; then
    RSYNC_ARGS+=(--dry-run --itemize-changes)
fi

if [ "$DELETE" = "1" ]; then
    RSYNC_ARGS+=(--delete)
fi

echo "local sync configuration"
echo "========================"
echo "server:        $SERVER"
echo "remote dir:    $REMOTE_DIR"
echo "dry run:       $DRY_RUN"
echo "delete remote: $DELETE"
echo "include .env:  $INCLUDE_ENV"
echo

ssh "$SERVER" "mkdir -p '$REMOTE_DIR'"

rsync "${RSYNC_ARGS[@]}" ./ "$SERVER:$REMOTE_DIR/"

if [ "$DRY_RUN" = "1" ]; then
    echo
    echo "dry-run complete (no remote files changed)"
else
    echo
    echo "sync complete"
fi

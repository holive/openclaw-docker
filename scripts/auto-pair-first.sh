#!/bin/bash
# auto-pair-first.sh - auto-approve first device connection
set -euo pipefail

MAX_WAIT=30
POLL_INTERVAL=2

echo "waiting for first device connection..."

elapsed=0
while [ $elapsed -lt $MAX_WAIT ]; do
    devices_json=$(docker compose exec -T openclaw-gateway \
        node dist/index.js devices list --json 2>/dev/null || echo '{}')

    # if already have paired devices, exit
    paired_count=$(echo "$devices_json" | \
        node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); \
        console.log((d.paired||[]).length)" 2>/dev/null || echo "0")

    if [ "$paired_count" -gt 0 ]; then
        echo "devices already paired - skipping auto-pair"
        exit 0
    fi

    # check for pending requests
    pending_count=$(echo "$devices_json" | \
        node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); \
        console.log((d.pending||[]).length)" 2>/dev/null || echo "0")

    if [ "$pending_count" -gt 0 ]; then
        echo "found pending device - auto-approving..."
        first_request_id=$(echo "$devices_json" | \
            node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); \
            console.log((d.pending||[])[0]?.requestId || '')")

        if [ -n "$first_request_id" ]; then
            docker compose exec -T openclaw-gateway \
                node dist/index.js devices approve "$first_request_id"
            echo "first device auto-paired"
            echo "future devices require: make pair"
            exit 0
        fi
    fi

    sleep $POLL_INTERVAL
    elapsed=$((elapsed + POLL_INTERVAL))
done

echo "no device connection within ${MAX_WAIT}s - run 'make pair' when needed"

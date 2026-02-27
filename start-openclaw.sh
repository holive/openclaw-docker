#!/bin/bash
# entrypoint: merge environment variables into openclaw.json and start gateway
set -e

CONFIG_DIR="/home/node/.openclaw"
CONFIG_FILE="${CONFIG_DIR}/openclaw.json"

# ensure config directory exists
mkdir -p "$CONFIG_DIR"

# create base config if doesn't exist
if [ ! -f "$CONFIG_FILE" ]; then
    echo '{}' > "$CONFIG_FILE"
fi

# merge environment variables into config
/env-to-config.sh "$CONFIG_FILE"

# start openclaw gateway
exec node openclaw.mjs gateway \
    --bind "${OPENCLAW_GATEWAY_BIND:-lan}" \
    --port "${OPENCLAW_GATEWAY_PORT:-18789}" \
    --allow-unconfigured

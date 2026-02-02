#!/bin/bash
# env-to-config.sh - merge environment variables into openclaw.json
# this script is called by start-openclaw.sh
# it can also be run standalone for testing
set -e

CONFIG_FILE="${1:-/home/node/.openclaw/openclaw.json}"

# ensure config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo '{}' > "$CONFIG_FILE"
fi

# create temp file
TMP_FILE="${CONFIG_FILE}.tmp"
cp "$CONFIG_FILE" "$TMP_FILE"

# helper function to merge a value into json
merge_value() {
    local path="$1"
    local value="$2"
    if [ -n "$value" ]; then
        jq --arg val "$value" "$path = \$val" "$TMP_FILE" > "${TMP_FILE}.new" && mv "${TMP_FILE}.new" "$TMP_FILE"
    fi
}

# gateway settings
merge_value '.gateway.auth.token' "${OPENCLAW_GATEWAY_TOKEN:-}"

# provider api keys (stored in env namespace per openclaw config schema)
merge_value '.env.ANTHROPIC_API_KEY' "${ANTHROPIC_API_KEY:-}"
merge_value '.env.OPENAI_API_KEY' "${OPENAI_API_KEY:-}"
merge_value '.env.OPENAI_BASE_URL' "${OPENAI_BASE_URL:-}"

# channel tokens
merge_value '.channels.telegram.botToken' "${TELEGRAM_BOT_TOKEN:-}"
merge_value '.channels.discord.botToken' "${DISCORD_BOT_TOKEN:-}"
merge_value '.channels.slack.botToken' "${SLACK_BOT_TOKEN:-}"
merge_value '.channels.slack.appToken' "${SLACK_APP_TOKEN:-}"

# write final config
mv "$TMP_FILE" "$CONFIG_FILE"

echo "config merged: $CONFIG_FILE"

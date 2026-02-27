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

# new provider keys
merge_value '.env.XAI_API_KEY'            "${XAI_API_KEY:-}"
merge_value '.env.MINIMAX_API_KEY'        "${MINIMAX_API_KEY:-}"
merge_value '.env.MOONSHOT_API_KEY'       "${MOONSHOT_API_KEY:-}"
merge_value '.env.KIMI_API_KEY'           "${KIMI_API_KEY:-}"
merge_value '.env.VOLCANO_ENGINE_API_KEY' "${VOLCANO_ENGINE_API_KEY:-}"
merge_value '.env.GROQ_API_KEY'           "${GROQ_API_KEY:-}"
merge_value '.env.MISTRAL_API_KEY'        "${MISTRAL_API_KEY:-}"

# search/tool api keys
merge_value '.env.BRAVE_API_KEY'          "${BRAVE_API_KEY:-}"
merge_value '.env.PERPLEXITY_API_KEY'     "${PERPLEXITY_API_KEY:-}"

# channel tokens
merge_value '.channels.telegram.botToken' "${TELEGRAM_BOT_TOKEN:-}"
merge_value '.channels.discord.botToken' "${DISCORD_BOT_TOKEN:-}"
merge_value '.channels.slack.botToken' "${SLACK_BOT_TOKEN:-}"
merge_value '.channels.slack.appToken' "${SLACK_APP_TOKEN:-}"
merge_value '.channels.mattermost.botToken' "${MATTERMOST_BOT_TOKEN:-}"
merge_value '.channels.mattermost.url'      "${MATTERMOST_URL:-}"

# auto-configure control ui origins
# gateway binds to lan (0.0.0.0) inside the container, which upstream treats
# as non-loopback, so allowedOrigins is always required
PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
if [ -n "${OPENCLAW_BIND_IP:-}" ]; then
    # remote deployment: allow both loopback and the remote ip
    jq --arg local "http://127.0.0.1:${PORT}" \
       --arg remote "http://${OPENCLAW_BIND_IP}:${PORT}" \
       '.gateway.controlUi.allowedOrigins = [$local, $remote]' \
       "$TMP_FILE" > "${TMP_FILE}.new" && mv "${TMP_FILE}.new" "$TMP_FILE"
else
    # local deployment: allow loopback only
    jq --arg local "http://127.0.0.1:${PORT}" \
       '.gateway.controlUi.allowedOrigins = [$local]' \
       "$TMP_FILE" > "${TMP_FILE}.new" && mv "${TMP_FILE}.new" "$TMP_FILE"
fi

# write final config
mv "$TMP_FILE" "$CONFIG_FILE"

echo "config merged: $CONFIG_FILE"

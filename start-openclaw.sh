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

# merge environment variables into config using jq
# this allows config-as-environment without manual json editing
merge_config() {
    local tmp_file="${CONFIG_FILE}.tmp"

    # start with existing config
    cp "$CONFIG_FILE" "$tmp_file"

    # merge gateway settings
    if [ -n "$OPENCLAW_GATEWAY_TOKEN" ]; then
        jq --arg token "$OPENCLAW_GATEWAY_TOKEN" \
           '.gateway.auth.token = $token' "$tmp_file" > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"
    fi

    # merge anthropic api key
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        jq --arg key "$ANTHROPIC_API_KEY" \
           '.env.ANTHROPIC_API_KEY = $key' "$tmp_file" > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"
    fi

    # merge openai api key
    if [ -n "$OPENAI_API_KEY" ]; then
        jq --arg key "$OPENAI_API_KEY" \
           '.env.OPENAI_API_KEY = $key' "$tmp_file" > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"
    fi

    # merge openai base url
    if [ -n "$OPENAI_BASE_URL" ]; then
        jq --arg url "$OPENAI_BASE_URL" \
           '.env.OPENAI_BASE_URL = $url' "$tmp_file" > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"
    fi

    # merge telegram bot token
    if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        jq --arg token "$TELEGRAM_BOT_TOKEN" \
           '.channels.telegram.botToken = $token' "$tmp_file" > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"
    fi

    # merge discord bot token
    if [ -n "$DISCORD_BOT_TOKEN" ]; then
        jq --arg token "$DISCORD_BOT_TOKEN" \
           '.channels.discord.botToken = $token' "$tmp_file" > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"
    fi

    # merge slack tokens
    if [ -n "$SLACK_BOT_TOKEN" ]; then
        jq --arg token "$SLACK_BOT_TOKEN" \
           '.channels.slack.botToken = $token' "$tmp_file" > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"
    fi
    if [ -n "$SLACK_APP_TOKEN" ]; then
        jq --arg token "$SLACK_APP_TOKEN" \
           '.channels.slack.appToken = $token' "$tmp_file" > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"
    fi

    # write final config
    mv "$tmp_file" "$CONFIG_FILE"
}

merge_config

# start openclaw gateway
exec node openclaw.mjs gateway \
    --bind "${OPENCLAW_GATEWAY_BIND:-lan}" \
    --port "${OPENCLAW_GATEWAY_PORT:-18789}" \
    --allow-unconfigured

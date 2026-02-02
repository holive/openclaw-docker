#!/bin/bash
# check if any ai provider is configured in .env
# returns 0 if configured, 1 if not

set -euo pipefail

ENV_FILE=".env"

# check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    exit 1
fi

# helper: get value from .env, stripping quotes
get_value() {
    local key="$1"
    grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"'"'" | tr -d ' '
}

# check for anthropic api key (non-empty, unquoted value)
ANTHROPIC_KEY=$(get_value "ANTHROPIC_API_KEY")
if [ -n "$ANTHROPIC_KEY" ]; then
    exit 0
fi

# check for openai api key (non-empty, unquoted value)
OPENAI_KEY=$(get_value "OPENAI_API_KEY")
if [ -n "$OPENAI_KEY" ]; then
    exit 0
fi

# no provider configured
exit 1

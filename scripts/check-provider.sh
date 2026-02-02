#!/bin/bash
# check if any ai provider is configured in .env
# returns 0 if configured, 1 if not

set -euo pipefail

ENV_FILE=".env"

# check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    exit 1
fi

# check for anthropic api key (non-empty value after =)
if grep -qE "^ANTHROPIC_API_KEY=.+" "$ENV_FILE"; then
    exit 0
fi

# check for openai api key (non-empty value after =)
if grep -qE "^OPENAI_API_KEY=.+" "$ENV_FILE"; then
    exit 0
fi

# no provider configured
exit 1

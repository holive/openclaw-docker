#!/bin/bash
# validate-env.sh - validate .env configuration
set -euo pipefail

ENV_FILE="${1:-.env}"
ERRORS=0
WARNINGS=0

# colors (disabled if not tty)
if [ -t 1 ]; then
    RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; NC='\033[0m'
else
    RED=''; YELLOW=''; GREEN=''; NC=''
fi

error() { echo -e "${RED}error:${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}warning:${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
ok() { echo -e "${GREEN}ok:${NC} $1"; }

echo "validating $ENV_FILE"
echo

if [ ! -f "$ENV_FILE" ]; then
    error ".env file not found - run 'make setup' first"
    exit 1
fi

get_value() {
    grep "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"'"'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true
}

# gateway token (required, 64 hex chars)
GATEWAY_TOKEN=$(get_value "OPENCLAW_GATEWAY_TOKEN")
if [ -z "$GATEWAY_TOKEN" ]; then
    error "OPENCLAW_GATEWAY_TOKEN is empty"
elif ! echo "$GATEWAY_TOKEN" | grep -qE '^[a-fA-F0-9]{64}$'; then
    error "OPENCLAW_GATEWAY_TOKEN must be 64 hex characters (got ${#GATEWAY_TOKEN})"
else
    ok "OPENCLAW_GATEWAY_TOKEN"
fi

# gateway port (optional, 1-65535)
GATEWAY_PORT=$(get_value "OPENCLAW_GATEWAY_PORT")
if [ -n "$GATEWAY_PORT" ]; then
    if ! echo "$GATEWAY_PORT" | grep -qE '^[0-9]+$'; then
        error "OPENCLAW_GATEWAY_PORT must be a number"
    elif [ "$GATEWAY_PORT" -lt 1 ] || [ "$GATEWAY_PORT" -gt 65535 ]; then
        error "OPENCLAW_GATEWAY_PORT must be 1-65535"
    else
        ok "OPENCLAW_GATEWAY_PORT ($GATEWAY_PORT)"
    fi
fi

# anthropic api key (optional, sk-ant-* pattern)
ANTHROPIC_KEY=$(get_value "ANTHROPIC_API_KEY")
if [ -n "$ANTHROPIC_KEY" ]; then
    if echo "$ANTHROPIC_KEY" | grep -qE '^sk-ant-'; then
        ok "ANTHROPIC_API_KEY"
    else
        warn "ANTHROPIC_API_KEY does not match expected pattern (sk-ant-*)"
    fi
fi

# openai api key (optional, sk-* pattern)
OPENAI_KEY=$(get_value "OPENAI_API_KEY")
if [ -n "$OPENAI_KEY" ]; then
    if echo "$OPENAI_KEY" | grep -qE '^sk-'; then
        ok "OPENAI_API_KEY"
    else
        warn "OPENAI_API_KEY does not match expected pattern (sk-*)"
    fi
fi

# openai base url (optional, must be url)
OPENAI_URL=$(get_value "OPENAI_BASE_URL")
if [ -n "$OPENAI_URL" ]; then
    if echo "$OPENAI_URL" | grep -qE '^https?://'; then
        ok "OPENAI_BASE_URL"
    else
        error "OPENAI_BASE_URL must start with http:// or https://"
    fi
fi

echo
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}validation failed:${NC} $ERRORS error(s), $WARNINGS warning(s)"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}validation passed with warnings${NC}"
    exit 0
else
    echo -e "${GREEN}validation passed${NC}"
    exit 0
fi

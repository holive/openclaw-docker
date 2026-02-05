#!/bin/bash
# setup-wizard.sh - interactive api key configuration
set -euo pipefail

ENV_FILE=".env"

echo
echo "ai provider setup"
echo "=================="
echo

get_value() {
    grep "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"'"'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true
}

set_value() {
    local key="$1" value="$2"
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        else
            sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        fi
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

# check if already configured
ANTHROPIC_KEY=$(get_value "ANTHROPIC_API_KEY")
OPENAI_KEY=$(get_value "OPENAI_API_KEY")

if [ -n "$ANTHROPIC_KEY" ] || [ -n "$OPENAI_KEY" ]; then
    echo "api key already configured"
    read -p "reconfigure? [y/N] " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
fi

echo "do you have an ai provider api key?"
echo
echo "  [1] yes, anthropic (claude)"
echo "  [2] yes, openai (gpt)"
echo "  [3] no, use free provider"
echo "  [4] skip"
echo
read -p "choice [1-4]: " -n 1 -r CHOICE
echo

case "$CHOICE" in
    1)
        echo
        read -p "ANTHROPIC_API_KEY=" -r API_KEY
        if [ -z "$API_KEY" ]; then
            echo "error: empty key"; exit 1
        fi
        if ! echo "$API_KEY" | grep -qE '^sk-ant-'; then
            echo "warning: key does not start with sk-ant-"
            read -p "save anyway? [y/N] " -n 1 -r
            echo
            [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
        fi
        set_value "ANTHROPIC_API_KEY" "$API_KEY"
        echo "saved. restart with: make restart"
        ;;
    2)
        echo
        read -p "OPENAI_API_KEY=" -r API_KEY
        if [ -z "$API_KEY" ]; then
            echo "error: empty key"; exit 1
        fi
        if ! echo "$API_KEY" | grep -qE '^sk-'; then
            echo "warning: key does not start with sk-"
            read -p "save anyway? [y/N] " -n 1 -r
            echo
            [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
        fi
        set_value "OPENAI_API_KEY" "$API_KEY"
        echo "saved. restart with: make restart"
        ;;
    3)
        echo
        echo "free providers: kimi, minimax, qwen"
        echo "run 'make configure' after setup to select one"
        ;;
    *)
        echo "skipped. configure later with: make configure"
        ;;
esac

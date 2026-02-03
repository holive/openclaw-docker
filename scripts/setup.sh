#!/bin/bash
set -euo pipefail

echo "openclaw setup"
echo "=============="
echo

# check for docker
if ! command -v docker &> /dev/null; then
    echo "error: docker is not installed"
    exit 1
fi

# check for openssl
if ! command -v openssl &> /dev/null; then
    echo "error: openssl is not installed (needed for token generation)"
    exit 1
fi

# create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "creating .env from .env.example..."
    cp .env.example .env
fi

# generate gateway token if empty (handle whitespace)
if grep -qE "^\s*OPENCLAW_GATEWAY_TOKEN=\s*$" .env; then
    echo "generating gateway token..."
    TOKEN=$(openssl rand -hex 32)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^OPENCLAW_GATEWAY_TOKEN=$/OPENCLAW_GATEWAY_TOKEN=$TOKEN/" .env
    else
        sed -i "s/^OPENCLAW_GATEWAY_TOKEN=$/OPENCLAW_GATEWAY_TOKEN=$TOKEN/" .env
    fi
    echo "token generated and saved to .env"
else
    echo "gateway token already configured (skipping)"
fi

# create directories with secure permissions
echo "creating directories..."
mkdir -p data
mkdir -p data/logs
mkdir -p data/extensions
mkdir -p workspaces/default
chmod 700 data
chmod 700 data/logs
chmod 700 data/extensions
chmod 700 workspaces

# initialize git submodules (for openclaw-telemetry)
if [ -f ".gitmodules" ]; then
    echo "initializing submodules..."
    git submodule update --init --recursive 2>/dev/null || true
fi

# copy workspace templates if default workspace is empty
if [ -d "templates/workspace" ] && [ -z "$(ls -A workspaces/default 2>/dev/null)" ]; then
    echo "copying workspace templates..."
    cp -r templates/workspace/* workspaces/default/
    echo "workspace templates copied - customize these files for your agent"
fi

# install telemetry plugin (opt-out with OPENCLAW_TELEMETRY=false)
if [ "${OPENCLAW_TELEMETRY:-true}" != "false" ]; then
    if [ -d "openclaw-telemetry" ] && [ ! -f "data/extensions/telemetry/openclaw.plugin.json" ]; then
        echo "installing telemetry plugin..."
        rm -rf data/extensions/telemetry 2>/dev/null || true
        cp -r openclaw-telemetry data/extensions/telemetry
        rm -rf data/extensions/telemetry/.git 2>/dev/null || true

        # apply config path fix (upstream bug: plugin looks for config in wrong location)
        if [ -f "patches/telemetry-config.patch" ]; then
            echo "applying telemetry config patch..."
            if patch -d data/extensions/telemetry -p1 < patches/telemetry-config.patch; then
                echo "telemetry plugin patched"
            else
                echo "warning: patch failed - telemetry may not work correctly"
                echo "         check if upstream plugin has changed"
            fi
        fi
        echo "telemetry plugin installed"
    fi
else
    echo "telemetry plugin skipped (OPENCLAW_TELEMETRY=false)"
fi

# configure telemetry in openclaw.json (the actual config file openclaw uses)
if [ "${OPENCLAW_TELEMETRY:-true}" != "false" ] && [ -d "data/extensions/telemetry" ]; then
    if [ ! -f "data/openclaw.json" ]; then
        # create new config with telemetry enabled
        echo "creating openclaw.json with telemetry enabled..."
        cat > data/openclaw.json << 'CONFIGEOF'
{
  "plugins": {
    "entries": {
      "telemetry": {
        "enabled": true,
        "config": {
          "enabled": true,
          "redact": {
            "enabled": true
          }
        }
      }
    }
  }
}
CONFIGEOF
        chmod 600 data/openclaw.json
        echo "telemetry writes to data/logs/telemetry.jsonl"
    elif ! grep -q '"telemetry"' data/openclaw.json 2>/dev/null; then
        # openclaw.json exists but no telemetry - notify user
        echo "note: openclaw.json exists but telemetry not configured"
        echo "      add telemetry config manually or delete data/openclaw.json and re-run setup"
    fi
fi

# set secure permissions on env file
chmod 600 .env 2>/dev/null || true

# pull the image
echo "pulling openclaw image..."
docker pull ghcr.io/openclaw/openclaw:latest

echo
echo "setup complete"
echo
echo "your gateway token:"
grep "^OPENCLAW_GATEWAY_TOKEN=" .env | cut -d'=' -f2
echo
echo "next steps:"
echo "  1. run: make up"
echo "  2. run: make configure    (choose your AI provider)"
echo "  3. open: http://127.0.0.1:18789"
echo
echo "provider options:"
echo "  - free: Kimi, MiniMax OAuth, or Qwen OAuth (via 'make configure')"
echo "  - paid: set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env"
echo
echo "see docs/PROVIDERS.md for details"

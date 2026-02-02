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

# create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "creating .env from .env.example..."
    cp .env.example .env
fi

# generate gateway token if empty
if grep -q "^OPENCLAW_GATEWAY_TOKEN=$" .env; then
    echo "generating gateway token..."
    TOKEN=$(openssl rand -hex 32)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^OPENCLAW_GATEWAY_TOKEN=$/OPENCLAW_GATEWAY_TOKEN=$TOKEN/" .env
    else
        sed -i "s/^OPENCLAW_GATEWAY_TOKEN=$/OPENCLAW_GATEWAY_TOKEN=$TOKEN/" .env
    fi
    echo "token generated and saved to .env"
else
    echo "gateway token already set"
fi

# create directories with secure permissions
echo "creating directories..."
for dir in data workspace; do
    mkdir -p "$dir"
    chmod 700 "$dir"
done

# copy workspace templates if workspace is empty
if [ -d "templates/workspace" ] && [ -z "$(ls -A workspace 2>/dev/null)" ]; then
    echo "copying workspace templates..."
    cp -r templates/workspace/* workspace/
    echo "workspace templates copied - customize these files for your agent"
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
echo "  2. run: make onboard    (choose your AI provider)"
echo "  3. open: http://127.0.0.1:18789"
echo
echo "provider options:"
echo "  - free: Kimi, MiniMax OAuth, or Qwen OAuth (via 'make onboard')"
echo "  - paid: set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env"
echo
echo "see docs/PROVIDERS.md for details"

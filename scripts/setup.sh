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

# if setup is run as root (common in cloud-init), ensure mounted dirs are
# writable by the container's node user (uid/gid 1000)
if [ "$(id -u)" -eq 0 ]; then
    echo "normalizing ownership for container user (uid/gid 1000)..."
    chown -R 1000:1000 data workspaces
fi

# copy workspace templates if default workspace is empty
if [ -d "templates/workspace" ] && [ -z "$(ls -A workspaces/default 2>/dev/null)" ]; then
    echo "copying workspace templates..."
    cp -r templates/workspace/* workspaces/default/
    echo "workspace templates copied - customize these files for your agent"
fi

# set secure permissions on env file
chmod 600 .env 2>/dev/null || true

# pull the image (skip if already present)
if docker image inspect ghcr.io/openclaw/openclaw:latest &>/dev/null; then
    echo "openclaw image already present (skipping pull)"
else
    echo "pulling openclaw image..."
    docker pull ghcr.io/openclaw/openclaw:latest
fi

echo
echo "setup complete"
echo
echo "your gateway token:"
grep "^OPENCLAW_GATEWAY_TOKEN=" .env | cut -d'=' -f2
echo
echo "next step:"
echo "  make quickstart"
echo
echo "this will start the gateway and help you configure an ai provider."
echo "free providers available - no api key required."

# run wizard for interactive terminals
if [ -t 0 ] && [ "${SKIP_WIZARD:-}" != "1" ]; then
    chmod +x scripts/setup-wizard.sh
    ./scripts/setup-wizard.sh || true
fi

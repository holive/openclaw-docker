#!/bin/bash
set -euo pipefail

echo "openclaw-docker setup"
echo "====================="
echo

# check for docker
if ! command -v docker &> /dev/null; then
    echo "error: docker is not installed"
    echo "install docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# check docker is running
if ! docker info &> /dev/null; then
    echo "error: docker is not running"
    echo "start docker and try again"
    exit 1
fi

# create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "creating .env from .env.example..."
    cp .env.example .env
else
    echo ".env already exists"
fi

# generate gateway token if empty
if grep -q "^OPENCLAW_GATEWAY_TOKEN=$" .env 2>/dev/null; then
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
for dir in data workspaces/default; do
    mkdir -p "$dir"
    chmod 700 "$dir"
done

# copy workspace templates if default workspace is empty
if [ -d "templates/workspace" ] && [ -z "$(ls -A workspaces/default 2>/dev/null)" ]; then
    echo "copying workspace templates to default workspace..."
    cp -r templates/workspace/* workspaces/default/
    echo "templates copied - customize files in workspaces/default/"
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
echo "  1. edit .env and add your ANTHROPIC_API_KEY"
echo "  2. run: make up"
echo "  3. run: make chat"
echo
echo "or if you have your api key ready:"
echo "  make up && make chat"

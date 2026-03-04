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

get_env_value() {
    local key="$1"
    grep "^${key}=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"'"'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true
}

set_env_value() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*$|${key}=${value}|" .env
        else
            sed -i "s|^${key}=.*$|${key}=${value}|" .env
        fi
    else
        echo "${key}=${value}" >> .env
    fi
}

detect_total_memory_mb() {
    if [ -r /proc/meminfo ]; then
        awk '/MemTotal/ { printf "%d", $2 / 1024 }' /proc/meminfo
        return 0
    fi
    if command -v sysctl >/dev/null 2>&1; then
        local bytes
        bytes="$(sysctl -n hw.memsize 2>/dev/null || true)"
        if [ -n "$bytes" ]; then
            echo $((bytes / 1024 / 1024))
            return 0
        fi
    fi
    echo 2048
}

configure_dynamic_memory_limit() {
    local total_mb mem_mb current_mem

    total_mb="$(detect_total_memory_mb)"
    mem_mb=$((total_mb * 75 / 100))
    if [ "$mem_mb" -lt 768 ]; then
        mem_mb=768
    fi

    current_mem="$(get_env_value "OPENCLAW_MEMORY_LIMIT")"

    if [ -z "$current_mem" ]; then
        set_env_value "OPENCLAW_MEMORY_LIMIT" "${mem_mb}m"
        echo "auto-set OPENCLAW_MEMORY_LIMIT=${mem_mb}m (75% of ${total_mb}MB host RAM, root/bootstrap only)"
    else
        echo "OPENCLAW_MEMORY_LIMIT already set (${current_mem})"
    fi
}

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

# auto-configure memory limit for server/bootstrap runs only (root context).
# keep local/dev behavior unchanged unless user sets OPENCLAW_MEMORY_LIMIT manually.
if [ "$(id -u)" -eq 0 ]; then
    configure_dynamic_memory_limit
else
    echo "skipping automatic OPENCLAW_MEMORY_LIMIT on non-root setup"
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

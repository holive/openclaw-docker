#!/bin/bash
# scripts/test.sh - run ci checks locally
# mirrors the github actions workflow for local validation
set -euo pipefail

echo "openclaw-docker local test suite"
echo "================================="
echo ""

FAILED=0

# helper functions
pass() { echo "[pass] $1"; }
fail() { echo "[fail] $1"; FAILED=1; }
skip() { echo "[skip] $1"; }

# ============================================================
# layer 1: infrastructure tests
# ============================================================

echo "--- layer 1: infrastructure ---"
echo ""

# 1. shellcheck
if command -v shellcheck &> /dev/null; then
    echo "running shellcheck..."
    if shellcheck scripts/*.sh start-openclaw.sh user-setup.sh 2>/dev/null; then
        pass "shellcheck"
    else
        fail "shellcheck found issues"
    fi
else
    skip "shellcheck (not installed)"
fi

# 2. env-to-config.sh origins auto-config
if command -v jq &> /dev/null; then
    echo "testing origins auto-config..."
    test_dir=$(mktemp -d)
    test_config="${test_dir}/openclaw.json"
    echo '{}' > "$test_config"

    # test: OPENCLAW_BIND_IP set -> allowedOrigins populated
    OPENCLAW_BIND_IP=10.0.0.1 OPENCLAW_GATEWAY_PORT=18789 \
        ./scripts/env-to-config.sh "$test_config" > /dev/null 2>&1

    origins=$(jq -r '.gateway.controlUi.allowedOrigins | length' "$test_config" 2>/dev/null)
    local_origin=$(jq -r '.gateway.controlUi.allowedOrigins[0]' "$test_config" 2>/dev/null)
    remote_origin=$(jq -r '.gateway.controlUi.allowedOrigins[1]' "$test_config" 2>/dev/null)

    if [ "$origins" = "2" ] && \
       [ "$local_origin" = "http://127.0.0.1:18789" ] && \
       [ "$remote_origin" = "http://10.0.0.1:18789" ]; then
        pass "origins auto-config (OPENCLAW_BIND_IP set)"
    else
        fail "origins auto-config: expected 2 origins, got ${origins}"
    fi

    # test: OPENCLAW_BIND_IP unset -> loopback-only origin
    echo '{}' > "$test_config"
    OPENCLAW_BIND_IP='' OPENCLAW_GATEWAY_PORT=18789 \
        ./scripts/env-to-config.sh "$test_config" > /dev/null 2>&1

    origins_local=$(jq -r '.gateway.controlUi.allowedOrigins | length' "$test_config" 2>/dev/null)
    local_only=$(jq -r '.gateway.controlUi.allowedOrigins[0]' "$test_config" 2>/dev/null)

    if [ "$origins_local" = "1" ] && [ "$local_only" = "http://127.0.0.1:18789" ]; then
        pass "origins auto-config (OPENCLAW_BIND_IP unset, loopback only)"
    else
        fail "origins auto-config: expected 1 loopback origin, got ${origins_local}"
    fi

    rm -rf "$test_dir"
else
    skip "origins auto-config (jq not installed)"
fi

# 3. docker-compose validation
echo "validating docker-compose.yml..."
if make validate 2>/dev/null; then
    pass "docker-compose validation"
else
    fail "docker-compose validation"
fi

# 4. env-to-config.sh exists in scripts/
echo "checking env-to-config.sh..."
if [ -f scripts/env-to-config.sh ] && [ -x scripts/env-to-config.sh ]; then
    pass "env-to-config.sh exists and is executable"
else
    fail "env-to-config.sh missing or not executable"
fi

echo ""
echo "--- layer 2: container tests ---"
echo ""

# check if we should skip container tests
if [ "${SKIP_CONTAINER_TESTS:-}" = "1" ]; then
    skip "container tests (SKIP_CONTAINER_TESTS=1)"
    echo ""
    if [ $FAILED -eq 0 ]; then
        echo "layer 1 passed"
        exit 0
    else
        echo "layer 1 failed"
        exit 1
    fi
fi

# ensure cleanup on exit (invoked via trap)
# shellcheck disable=SC2317,SC2329
cleanup() {
    echo "cleaning up..."
    docker compose down -v 2>/dev/null || true
}
trap cleanup EXIT

# 5. setup test environment
echo "setting up test environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)" >> .env
fi
mkdir -p workspaces/default data
if [ -d templates/workspace ] && [ -z "$(ls -A workspaces/default 2>/dev/null)" ]; then
    cp -r templates/workspace/* workspaces/default/
fi
pass "environment setup"

# 6. build
echo "building container..."
if docker compose build --quiet; then
    pass "container build"
else
    fail "container build"
    echo "stopping tests (build failed)"
    exit 1
fi

# 7. start container
echo "starting container..."
docker compose down --remove-orphans 2>/dev/null || true
if docker compose up -d; then
    pass "container start"
else
    fail "container start"
    docker compose logs
    exit 1
fi

# 8. wait for healthy
echo "waiting for healthy status..."
if make wait-ready; then
    pass "health check"
else
    fail "health check"
    docker compose logs
    exit 1
fi

# 9. verify files
echo "verifying container files..."
if docker compose exec -T openclaw-gateway test -f /start-openclaw.sh && \
   docker compose exec -T openclaw-gateway test -f /env-to-config.sh && \
   docker compose exec -T openclaw-gateway test -d /home/node/.openclaw && \
   docker compose exec -T openclaw-gateway test -f /home/node/.openclaw/openclaw.json; then
    pass "required files exist"
else
    fail "required files missing"
fi

echo ""
echo "================================="
if [ $FAILED -eq 0 ]; then
    echo "all tests passed"
    exit 0
else
    echo "some tests failed"
    exit 1
fi

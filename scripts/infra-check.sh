#!/bin/bash
set -euo pipefail

STATUS_FILE="/var/log/openclaw-bootstrap.status"
SETUP_LOG="/var/log/openclaw-setup.log"

FAILS=0
WARNS=0

pass() { echo "PASS  $1"; }
warn() { echo "WARN  $1"; WARNS=$((WARNS + 1)); }
fail() { echo "FAIL  $1"; FAILS=$((FAILS + 1)); }

echo "openclaw infrastructure readiness"
echo "================================"
echo

# 1. cloud-init/bootstrap status
if [ -f "$STATUS_FILE" ]; then
    if grep -q "FINAL=success" "$STATUS_FILE"; then
        pass "bootstrap status file reports success"
    else
        ERR_LINE="$(grep -E 'ERROR=' "$STATUS_FILE" | tail -n1 || true)"
        if [ -n "$ERR_LINE" ]; then
            fail "bootstrap failed ($ERR_LINE)"
        else
            fail "bootstrap status file present but not successful"
        fi
    fi
else
    fail "missing bootstrap status file ($STATUS_FILE)"
fi

if command -v cloud-init >/dev/null 2>&1; then
    CI_STATUS="$(cloud-init status 2>/dev/null || true)"
    if echo "$CI_STATUS" | grep -q "status: done"; then
        pass "cloud-init status is done"
    elif [ -n "$CI_STATUS" ]; then
        fail "cloud-init status is not done ($CI_STATUS)"
    else
        warn "cloud-init status unavailable"
    fi
else
    warn "cloud-init command not found"
fi

# 2. tailscale connectivity
if command -v tailscale >/dev/null 2>&1; then
    if TS_IP="$(tailscale ip -4 2>/dev/null | head -n1)" && [ -n "$TS_IP" ]; then
        pass "tailscale connected ($TS_IP)"
    else
        fail "tailscale is not connected (auth key expired or login failed)"
    fi
else
    fail "tailscale command not found"
fi

# 3. openclaw repo and container checks
if [ ! -d "/opt/openclaw-docker" ]; then
    fail "missing /opt/openclaw-docker"
else
    cd /opt/openclaw-docker

    if docker compose ps --quiet openclaw-gateway 2>/dev/null | grep -q .; then
        pass "openclaw-gateway container exists"
    else
        fail "openclaw-gateway container is not running"
    fi

    if docker compose exec -T openclaw-gateway node openclaw.mjs health >/dev/null 2>&1; then
        pass "gateway health check passed"
    else
        fail "gateway health check failed"
    fi

    if [ -x "./scripts/check-provider.sh" ]; then
        if ./scripts/check-provider.sh; then
            pass "api-key provider configured in .env"
        else
            warn "no api-key provider configured in .env (run 'make configure')"
        fi
    else
        warn "provider check script missing"
    fi
fi

echo
if [ "$FAILS" -gt 0 ]; then
    echo "result: FAIL ($FAILS failure(s), $WARNS warning(s))"
    echo "inspect logs:"
    echo "  tail -n 120 $SETUP_LOG"
    echo "  tail -n 120 $STATUS_FILE"
    echo "  cd /opt/openclaw-docker && docker compose logs --tail=120"
    exit 1
fi

if [ "$WARNS" -gt 0 ]; then
    echo "result: PASS with warnings ($WARNS)"
    exit 0
fi

echo "result: PASS"
exit 0


#!/bin/bash
# test-validate-env.sh - unit tests for validate-env.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATE_SCRIPT="$SCRIPT_DIR/validate-env.sh"
TEST_DIR=$(mktemp -d)
PASSED=0
FAILED=0

# colors
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
else
    RED=''; GREEN=''; NC=''
fi

cleanup() {
    rm -rf "$TEST_DIR"
}
trap cleanup EXIT

pass() {
    echo -e "${GREEN}pass:${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}fail:${NC} $1"
    FAILED=$((FAILED + 1))
}

# run validate-env.sh and capture exit code
run_validate() {
    local env_file="$1"
    "$VALIDATE_SCRIPT" "$env_file" > /dev/null 2>&1
    echo $?
}

# run validate-env.sh and capture output
run_validate_output() {
    local env_file="$1"
    "$VALIDATE_SCRIPT" "$env_file" 2>&1 || true
}

echo "testing validate-env.sh"
echo "========================"
echo

# test 1: valid token (64 hex chars)
echo "OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)" > "$TEST_DIR/test1.env"
if [ "$(run_validate "$TEST_DIR/test1.env")" -eq 0 ]; then
    pass "valid token (64 hex chars)"
else
    fail "valid token (64 hex chars) - expected exit 0"
fi

# test 2: invalid token (wrong length)
echo "OPENCLAW_GATEWAY_TOKEN=abc123" > "$TEST_DIR/test2.env"
if [ "$(run_validate "$TEST_DIR/test2.env")" -eq 1 ]; then
    pass "invalid token (wrong length)"
else
    fail "invalid token (wrong length) - expected exit 1"
fi

# test 3: invalid token (non-hex chars)
echo "OPENCLAW_GATEWAY_TOKEN=gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg" > "$TEST_DIR/test3.env"
if [ "$(run_validate "$TEST_DIR/test3.env")" -eq 1 ]; then
    pass "invalid token (non-hex chars)"
else
    fail "invalid token (non-hex chars) - expected exit 1"
fi

# test 4: empty token
echo "OPENCLAW_GATEWAY_TOKEN=" > "$TEST_DIR/test4.env"
if [ "$(run_validate "$TEST_DIR/test4.env")" -eq 1 ]; then
    pass "empty token"
else
    fail "empty token - expected exit 1"
fi

# test 5: valid port
cat > "$TEST_DIR/test5.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
OPENCLAW_GATEWAY_PORT=8080
EOF
if [ "$(run_validate "$TEST_DIR/test5.env")" -eq 0 ]; then
    pass "valid port (8080)"
else
    fail "valid port (8080) - expected exit 0"
fi

# test 6: invalid port (>65535)
cat > "$TEST_DIR/test6.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
OPENCLAW_GATEWAY_PORT=99999
EOF
if [ "$(run_validate "$TEST_DIR/test6.env")" -eq 1 ]; then
    pass "invalid port (>65535)"
else
    fail "invalid port (>65535) - expected exit 1"
fi

# test 7: invalid port (non-numeric)
cat > "$TEST_DIR/test7.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
OPENCLAW_GATEWAY_PORT=abc
EOF
if [ "$(run_validate "$TEST_DIR/test7.env")" -eq 1 ]; then
    pass "invalid port (non-numeric)"
else
    fail "invalid port (non-numeric) - expected exit 1"
fi

# test 8: valid anthropic key
cat > "$TEST_DIR/test8.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
ANTHROPIC_API_KEY=sk-ant-api03-test123
EOF
if [ "$(run_validate "$TEST_DIR/test8.env")" -eq 0 ]; then
    pass "valid anthropic key (sk-ant-*)"
else
    fail "valid anthropic key (sk-ant-*) - expected exit 0"
fi

# test 9: invalid anthropic key format (warning, not error)
cat > "$TEST_DIR/test9.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
ANTHROPIC_API_KEY=wrong-format
EOF
output=$(run_validate_output "$TEST_DIR/test9.env")
exit_code=$(run_validate "$TEST_DIR/test9.env")
if [ "$exit_code" -eq 0 ] && echo "$output" | grep -q "warning"; then
    pass "invalid anthropic key format (warning)"
else
    fail "invalid anthropic key format - expected exit 0 with warning"
fi

# test 10: valid openai key
cat > "$TEST_DIR/test10.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
OPENAI_API_KEY=sk-proj-test123
EOF
if [ "$(run_validate "$TEST_DIR/test10.env")" -eq 0 ]; then
    pass "valid openai key (sk-*)"
else
    fail "valid openai key (sk-*) - expected exit 0"
fi

# test 11: invalid openai key format (warning, not error)
cat > "$TEST_DIR/test11.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
OPENAI_API_KEY=wrong-format
EOF
output=$(run_validate_output "$TEST_DIR/test11.env")
exit_code=$(run_validate "$TEST_DIR/test11.env")
if [ "$exit_code" -eq 0 ] && echo "$output" | grep -q "warning"; then
    pass "invalid openai key format (warning)"
else
    fail "invalid openai key format - expected exit 0 with warning"
fi

# test 12: valid url
cat > "$TEST_DIR/test12.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
OPENAI_BASE_URL=https://api.openai.com/v1
EOF
if [ "$(run_validate "$TEST_DIR/test12.env")" -eq 0 ]; then
    pass "valid url (https://)"
else
    fail "valid url (https://) - expected exit 0"
fi

# test 13: invalid url
cat > "$TEST_DIR/test13.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
OPENAI_BASE_URL=not-a-url
EOF
if [ "$(run_validate "$TEST_DIR/test13.env")" -eq 1 ]; then
    pass "invalid url"
else
    fail "invalid url - expected exit 1"
fi

# test 14: multiple errors (should report all, not exit early)
cat > "$TEST_DIR/test14.env" <<EOF
OPENCLAW_GATEWAY_TOKEN=invalid
OPENCLAW_GATEWAY_PORT=99999
OPENAI_BASE_URL=not-a-url
EOF
output=$(run_validate_output "$TEST_DIR/test14.env")
error_count=$(echo "$output" | grep -c "error:" || true)
if [ "$error_count" -ge 3 ]; then
    pass "multiple errors reported (found $error_count)"
else
    fail "multiple errors - expected 3+ errors, got $error_count"
fi

# summary
echo
echo "========================"
echo -e "results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi

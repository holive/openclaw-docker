#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/holive/openclaw-docker.git"
INSTALL_DIR="/opt/openclaw-docker"
TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-}"
HOSTNAME_OVERRIDE=""
WAIT_TIMEOUT=120

log() {
    echo "[deploy-hostinger] $*"
}

fail() {
    echo "[deploy-hostinger] error: $*" >&2
    exit 1
}

usage() {
    cat <<'USAGE'
usage: deploy-hostinger.sh --tailscale-authkey <key> [options]

required:
  --tailscale-authkey <key>   tailscale auth key (or set TAILSCALE_AUTHKEY env var)

options:
  --repo <url>                git repo url (default: https://github.com/holive/openclaw-docker.git)
  --dir <path>                install directory (default: /opt/openclaw-docker)
  --hostname <name>           tailscale hostname (default: current hostname)
  --wait-timeout <seconds>    health wait timeout (default: 120)
  -h, --help                  show this help
USAGE
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --tailscale-authkey)
                [ $# -ge 2 ] || fail "missing value for $1"
                TAILSCALE_AUTHKEY="$2"
                shift 2
                ;;
            --repo)
                [ $# -ge 2 ] || fail "missing value for $1"
                REPO_URL="$2"
                shift 2
                ;;
            --dir)
                [ $# -ge 2 ] || fail "missing value for $1"
                INSTALL_DIR="$2"
                shift 2
                ;;
            --hostname)
                [ $# -ge 2 ] || fail "missing value for $1"
                HOSTNAME_OVERRIDE="$2"
                shift 2
                ;;
            --wait-timeout)
                [ $# -ge 2 ] || fail "missing value for $1"
                WAIT_TIMEOUT="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                fail "unknown argument: $1"
                ;;
        esac
    done
}

install_packages_if_needed() {
    if ! command -v apt-get >/dev/null 2>&1; then
        fail "only apt-based systems are supported by this script"
    fi

    log "installing base packages..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg git make openssl
}

install_docker_if_needed() {
    if command -v docker >/dev/null 2>&1; then
        log "docker already installed"
    else
        log "installing docker..."
        curl -fsSL https://get.docker.com | sh
    fi

    systemctl enable docker >/dev/null 2>&1 || true
    systemctl start docker
}

install_tailscale_if_needed() {
    if command -v tailscale >/dev/null 2>&1; then
        log "tailscale already installed"
    else
        log "installing tailscale..."
        curl -fsSL https://tailscale.com/install.sh | sh
    fi
}

tailscale_connected() {
    tailscale ip -4 >/dev/null 2>&1
}

connect_tailscale() {
    if tailscale_connected; then
        log "tailscale already connected"
        return
    fi

    [ -n "$TAILSCALE_AUTHKEY" ] || fail "tailscale auth key is required (use --tailscale-authkey or TAILSCALE_AUTHKEY env var)"

    local host_arg=()
    if [ -n "$HOSTNAME_OVERRIDE" ]; then
        host_arg=(--hostname "$HOSTNAME_OVERRIDE")
    fi

    log "connecting to tailscale..."
    tailscale up --authkey "$TAILSCALE_AUTHKEY" "${host_arg[@]}"
}

prepare_repo() {
    if [ -d "$INSTALL_DIR/.git" ]; then
        log "using existing repo at $INSTALL_DIR"
    elif [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
        fail "install dir exists and is not empty: $INSTALL_DIR"
    else
        log "cloning repo into $INSTALL_DIR..."
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi

    cd "$INSTALL_DIR"
}

upsert_env() {
    local key="$1"
    local value="$2"
    local env_file=".env"

    if grep -q "^${key}=" "$env_file"; then
        sed -i "s|^${key}=.*$|${key}=${value}|" "$env_file"
    else
        echo "${key}=${value}" >> "$env_file"
    fi
}

wait_healthy() {
    local elapsed=0
    while [ "$elapsed" -lt "$WAIT_TIMEOUT" ]; do
        local health
        health="$(docker compose ps openclaw-gateway --format '{{.Health}}' 2>/dev/null || true)"
        if [ "$health" = "healthy" ]; then
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done
    return 1
}

main() {
    parse_args "$@"

    [ "${EUID:-$(id -u)}" -eq 0 ] || fail "run as root (or use sudo)"

    require_cmd bash
    require_cmd sed
    require_cmd grep
    require_cmd cut

    install_packages_if_needed
    install_docker_if_needed
    install_tailscale_if_needed
    connect_tailscale

    local tailscale_ip
    tailscale_ip="$(tailscale ip -4 | head -n1)"
    [ -n "$tailscale_ip" ] || fail "could not detect tailscale ipv4"

    prepare_repo

    if [ ! -f .env ]; then
        cp .env.example .env
    fi

    log "running setup..."
    SKIP_WIZARD=1 make setup

    upsert_env "OPENCLAW_BIND_IP" "$tailscale_ip"
    upsert_env "OPENCLAW_GATEWAY_BIND" "lan"
    chmod 600 .env 2>/dev/null || true

    log "starting gateway..."
    make up

    log "waiting for healthy status..."
    if ! wait_healthy; then
        log "gateway did not become healthy within ${WAIT_TIMEOUT}s"
        docker compose logs --tail=100 || true
        fail "deployment failed health check"
    fi

    local token
    token="$(grep '^OPENCLAW_GATEWAY_TOKEN=' .env | cut -d'=' -f2-)"
    local port
    port="$(grep '^OPENCLAW_GATEWAY_PORT=' .env | cut -d'=' -f2-)"
    port="${port:-18789}"

    cat <<EOF

deployment complete
-------------------
repo dir:        $INSTALL_DIR
tailscale ip:    $tailscale_ip
gateway url:     http://$tailscale_ip:$port
token prefix:    ${token:0:8}...

next steps:
  1) on this server, confirm:
     cd $INSTALL_DIR && make status
  2) get gateway token (on server):
     grep '^OPENCLAW_GATEWAY_TOKEN=' $INSTALL_DIR/.env
  3) from your local machine (connected to tailscale):
     OPENCLAW_GATEWAY_URL=http://$tailscale_ip:$port OPENCLAW_GATEWAY_TOKEN=<token> make chat
  4) browser control ui:
     http://$tailscale_ip:$port/?token=<token>

EOF
}

main "$@"

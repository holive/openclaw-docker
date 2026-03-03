# Hostinger VPS Deployment (Tailscale-First)

This guide is for users deploying `openclaw-docker` on a Hostinger VPS with private access over Tailscale.

## What Hostinger Handles vs What This Repo Handles

Hostinger handles:
- VPS lifecycle (create, reboot, destroy)
- Platform-level backup/monitoring features exposed in hPanel

This repo handles:
- OpenClaw container setup
- Secure `.env` generation and gateway token
- Docker compose lifecycle (`make up`, `make status`, `make logs`, etc.)

## Prerequisites

- Hostinger VPS (Ubuntu/Debian recommended)
- SSH access as `root` or passwordless `sudo`
- A Tailscale auth key from your admin console
- Local machine also connected to Tailscale

## Option A: One Command From Your VPS

SSH to your VPS and run:

```bash
curl -fsSL https://raw.githubusercontent.com/holive/openclaw-docker/main/scripts/deploy-hostinger.sh | \
bash -s -- --tailscale-authkey "tskey-xxxxx"
```

Optional flags:

- `--hostname openclaw-vps` (default: current hostname)
- `--dir /opt/openclaw-docker` (default: `/opt/openclaw-docker`)
- `--repo https://github.com/holive/openclaw-docker.git`
- `--wait-timeout 180`

## Option B: Run the Script From a Local Clone

```bash
git clone https://github.com/holive/openclaw-docker
cd openclaw-docker
scp scripts/deploy-hostinger.sh root@your-vps:/root/
ssh root@your-vps "bash /root/deploy-hostinger.sh --tailscale-authkey 'tskey-xxxxx'"
```

## What the Script Does

1. Installs Docker (if missing)
2. Installs Tailscale (if missing)
3. Connects the VPS to your tailnet
4. Clones this repo to `/opt/openclaw-docker` (if needed)
5. Runs `make setup`
6. Sets `OPENCLAW_BIND_IP` to the VPS Tailscale IPv4
7. Runs `make up` and waits for healthy status

## Connect to Your Gateway

On your local machine:

```bash
# on the VPS, get token:
ssh root@your-vps "grep OPENCLAW_GATEWAY_TOKEN /opt/openclaw-docker/.env"

# locally, connect with Tailscale IP + token:
OPENCLAW_GATEWAY_URL=http://<tailscale-ip>:18789 \
OPENCLAW_GATEWAY_TOKEN=<token> \
make chat
```

You can also open Control UI in browser:

```text
http://<tailscale-ip>:18789/?token=<token>
```

## Operations

On the VPS:

```bash
cd /opt/openclaw-docker
make status
make logs
make update
make backup
```

## Troubleshooting

Tailscale not connected:

```bash
tailscale status
journalctl -u tailscaled --no-pager | tail -n 80
```

Gateway not healthy:

```bash
cd /opt/openclaw-docker
docker compose ps
docker compose logs --tail=100
```

Validation:

```bash
cd /opt/openclaw-docker
make validate-env
```

## Notes

- Baseline setup is private-only via Tailscale (no public `18789` exposure).
- If you need public HTTPS later, follow [REMOTE.md](REMOTE.md).


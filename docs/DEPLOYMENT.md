# Deployment Guide

This repo supports two VPS deployment paths:

- **Hostinger VPS**: manual VPS provisioning, then run a bootstrap script from this repo
- **Hetzner Cloud**: full infrastructure provisioning with OpenTofu

If you cloned this repo to build your own personal agent setup (memory/workspaces/custom files), both paths keep your runtime data in:

- `data/`
- `workspaces/`

## Choose Your Path

| Path | Best for | Provisioning model | Network default | Automation level |
|------|----------|--------------------|-----------------|------------------|
| [Hostinger VPS](DEPLOY_HOSTINGER.md) | Simple VPS flow with minimal IaC overhead | Create VPS in Hostinger panel, bootstrap over SSH | Tailscale private network | Near one-command after VPS creation |
| [Hetzner + OpenTofu](../infra/hetzner/README.md) | Fully reproducible infra-as-code | `tofu init/plan/apply` | Tailscale private network | End-to-end infra + app automation |

## At a Glance

1. **Hostinger path**
   - You create the VPS
   - Repo script installs Docker + Tailscale + OpenClaw stack
   - Best when you want provider flexibility and direct control

2. **Hetzner path**
   - OpenTofu provisions server, firewall, and cloud-init bootstrap
   - Best when you want infrastructure managed as code

## Security Defaults

Both paths keep the same app-level defaults from this repo:

- Token-authenticated gateway
- Docker hardening (`cap_drop: ALL`, `no-new-privileges`, PID limit)
- Private access recommended via Tailscale

Read:
- [SECURITY.md](SECURITY.md)
- [REMOTE.md](REMOTE.md)


# Deployment Guide

This repo uses a single VPS deployment path:

- **Hetzner Cloud**: full infrastructure provisioning with OpenTofu

If you cloned this repo to build your own personal agent setup (memory/workspaces/custom files), runtime data is kept in:

- `data/`
- `workspaces/`

## Deployment Path

| Path | Best for | Provisioning model | Network default | Automation level |
|------|----------|--------------------|-----------------|------------------|
| [Hetzner + OpenTofu](../infra/hetzner/README.md) | Fully reproducible infra-as-code | `tofu init/plan/apply` | Tailscale private network | End-to-end infra + app automation |

## At a Glance

1. **Hetzner path**
   - OpenTofu provisions server, firewall, SSH key, and cloud-init bootstrap
   - Cloud-init installs Docker + Tailscale and starts `openclaw-docker`
   - Best when you want infrastructure managed as code with repeatable deploys

## Security Defaults

The Hetzner path keeps the same app-level defaults from this repo:

- Token-authenticated gateway
- Docker hardening (`cap_drop: ALL`, `no-new-privileges`, PID limit)
- Private access recommended via Tailscale

Read:
- [SECURITY.md](SECURITY.md)
- [REMOTE.md](REMOTE.md)

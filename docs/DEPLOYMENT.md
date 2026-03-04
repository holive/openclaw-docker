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

## Local Files vs Bootstrap Repo

`tofu apply` bootstraps the server from the default repo URL in cloud-init. It does not read
your local project directory automatically. If your local clone has personal/uncommitted files,
sync them explicitly after provisioning.

### Local-First Sync Workflow

Run from repo root on your local machine:

```bash
# after tofu apply and readiness checks
make sync-dry-run SERVER=root@<server-ip>
make sync SERVER=root@<server-ip>
make deploy-local SERVER=root@<server-ip>
```

Behavior:
- sync uses `rsync` to `/opt/openclaw-docker` by default
- `.env` is excluded by default (`INCLUDE_ENV=1` to include)
- `data/` and `workspaces/` are included
- optional pruning: `DELETE=1 make sync SERVER=root@<server-ip>`

## Security Defaults

The Hetzner path keeps the same app-level defaults from this repo:

- Token-authenticated gateway
- Docker hardening (`cap_drop: ALL`, `no-new-privileges`, PID limit)
- Private access recommended via Tailscale

Read:
- [SECURITY.md](SECURITY.md)
- [REMOTE.md](REMOTE.md)

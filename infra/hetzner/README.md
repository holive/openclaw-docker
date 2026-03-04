# Hetzner Deployment

Deploy OpenClaw to Hetzner Cloud using OpenTofu (Terraform-compatible).

This is the **IaC deployment path**.

- For a deployment path comparison, see [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)

## Prerequisites

- [OpenTofu](https://opentofu.org/docs/intro/install/) or Terraform installed
- Hetzner Cloud account with API token
- Tailscale account with auth key
- SSH key pair

### Prerequisites Checklist

Before running `tofu apply`, verify:

1. You can run `tofu version` locally
2. You have a Hetzner API token (`hcloud_token`)
3. You have a reusable or ephemeral Tailscale auth key (`tailscale_authkey`)
4. You have your SSH public key content ready (`ssh_public_key`, e.g. `ssh-ed25519 ...`)
5. You are deploying an IPv4-enabled server (not IPv6-only)

### Tailscale Key Type (Important)

Generate an auth key in Tailscale admin at:
- `https://login.tailscale.com/admin/settings/keys`

Recommended for this flow:
- **Reusable key + expiry** for long-lived server reprovisioning with Terraform
- **Ephemeral key** for short-lived/test servers that should disappear cleanly

Use this key value in `tailscale_authkey` in `terraform.tfvars`.

## Quick Start

```bash
cd infra/hetzner

# copy and edit config
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars with your values

# initialize
tofu init

# preview
tofu plan

# deploy
tofu apply
```

## Configuration

Create `terraform.tfvars` with:

| Variable | Required | Description |
|----------|----------|-------------|
| `hcloud_token` | yes | [Hetzner API token](https://console.hetzner.cloud/projects/*/security/tokens) |
| `tailscale_authkey` | yes | [Tailscale auth key](https://login.tailscale.com/admin/settings/keys) |
| `ssh_public_key` | yes | Your SSH public key content |
| `server_name` | no | Hostname (default: openclaw) |
| `server_type` | no | Server size (default: cax21) |
| `location` | no | Datacenter (default: fsn1) |

### Server Types

| Type | vCPU | RAM | Cost/mo | Notes |
|------|------|-----|---------|-------|
| cax11 | 2 | 4GB | ~$4 | minimum |
| cax21 | 4 | 8GB | ~$7 | recommended |
| cax31 | 8 | 16GB | ~$14 | heavy usage |

ARM servers (cax*) are cheaper. x86 available as cpx11/cpx21/cpx31.

### Locations

- `fsn1` - Falkenstein, Germany
- `nbg1` - Nuremberg, Germany
- `hel1` - Helsinki, Finland
- `ash` - Ashburn, USA
- `hil` - Hillsboro, USA

## After Deployment

`tofu apply` confirms infrastructure creation, but not full app readiness.

1. Wait ~3 minutes for cloud-init bootstrap.
2. SSH into the server: `tofu output ssh_command`
3. Run readiness checks:

```bash
cd /opt/openclaw-docker
make infra-check
```

4. If readiness passes, get gateway token:

```bash
grep OPENCLAW_GATEWAY_TOKEN /opt/openclaw-docker/.env
```

### Local-First Sync (optional)

Cloud-init bootstraps from the default public repo. If you deploy from a local copy with
uncommitted/personal files, sync your local tree after `tofu apply`:

```bash
# run from repo root on your local machine
make sync-dry-run SERVER=root@<server-ip>
make sync SERVER=root@<server-ip>
make deploy-local SERVER=root@<server-ip>
```

Defaults:
- `.env` is excluded (set `INCLUDE_ENV=1` to include intentionally)
- `data/` and `workspaces/` are included in sync
- remote path defaults to `/opt/openclaw-docker` (override with `REMOTE_DIR=...`)

### First Connection Smoke Test

Run these checks on the server:

```bash
cd /opt/openclaw-docker
make status
docker compose ps
docker compose logs --tail=50
```

Expected:
- `openclaw-gateway` is running and healthy
- setup log has no cloud-init failures
- token is present in `/opt/openclaw-docker/.env`
- if provider is not configured yet, readiness shows a warning (not a hard failure)

### Connect via Tailscale

From your local machine (with Tailscale installed):

```bash
# find the server's tailscale IP
tailscale status

# connect
OPENCLAW_GATEWAY_URL=http://<tailscale-ip>:18789 \
OPENCLAW_GATEWAY_TOKEN=<token> \
make chat
```

## Operations

```bash
# show outputs
tofu output

# update infrastructure
tofu apply

# destroy everything
tofu destroy
```

### Terraform State Notes

- `tofu destroy` only removes resources tracked in this Terraform state.
- If you created a server manually in Hetzner Console, Terraform will not destroy it unless you import it first.
- If a manual server exists and you want a clean IaC-only setup, delete that server in Hetzner Console before `tofu apply`.

## SSH Hardening (Recommended)

The cloud-init flow provides access, but you should harden SSH after first login:

```bash
sudo mkdir -p /etc/ssh/sshd_config.d
printf "PasswordAuthentication no\nKbdInteractiveAuthentication no\nChallengeResponseAuthentication no\nPermitRootLogin prohibit-password\nPubkeyAuthentication yes\n" | \
  sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null
sudo sshd -t && sudo systemctl reload ssh
```

Verify password auth is blocked:

```bash
ssh -o PreferredAuthentications=password root@<server-ip>
```

## Troubleshooting

### Cloud-init not completing

SSH in and check the log:
```bash
cat /var/log/openclaw-setup.log
cat /var/log/openclaw-bootstrap.status
```

### Gateway not starting

```bash
cd /opt/openclaw-docker
make status
make logs
```

### Tailscale not connecting

```bash
tailscale status
journalctl -u tailscaled
```

If `/var/log/openclaw-bootstrap.status` shows `ERROR=tailscale_auth_failed`, your auth key likely expired or is invalid.

Fix:
1. Generate a new Tailscale auth key.
2. Update `tailscale_authkey` in `terraform.tfvars`.
3. Recreate the server (`tofu destroy` + `tofu apply`) or rerun bootstrap manually.

### Provider not configured yet

This is a warning state (not infrastructure failure). Configure provider auth:

```bash
cd /opt/openclaw-docker
make configure
make restart
```

### SSH host key changed after recreate

If you destroy/recreate a server and reuse the same IP, SSH may fail with:

`WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`

This is usually expected because the new server has a new host key.

On your local machine:

```bash
ssh-keygen -R <server-ip>
ssh root@<server-ip>
```

For maximum safety, verify the new host fingerprint in Hetzner Console before trusting it.

### Editing cloud-init template

This project renders `cloud-init.yaml` through OpenTofu `templatefile(...)`.
When you need literal shell variables in the template, escape as `$${VAR}` (not `${VAR}`),
otherwise OpenTofu will try to interpolate and fail.

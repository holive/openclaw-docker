# Hetzner Deployment

Deploy OpenClaw to Hetzner Cloud using OpenTofu (Terraform-compatible).

## Prerequisites

- [OpenTofu](https://opentofu.org/docs/intro/install/) or Terraform installed
- Hetzner Cloud account with API token
- Tailscale account with auth key
- SSH key pair

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

1. Wait ~3 minutes for cloud-init to finish
2. SSH into the server: `tofu output ssh_command`
3. Check setup log: `cat /var/log/openclaw-setup.log`
4. Get gateway token: `grep OPENCLAW_GATEWAY_TOKEN /opt/openclaw-docker/.env`

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

## Troubleshooting

### Cloud-init not completing

SSH in and check the log:
```bash
cat /var/log/openclaw-setup.log
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

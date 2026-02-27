# Control UI Dashboard

OpenClaw includes a browser-based Control UI for chat, monitoring, and configuration.

## Quick Access

```bash
make dashboard
```

This prints a tokenized URL you can open in your browser:

```
http://127.0.0.1:18789/?token=<your-token>
```

## First-Time Setup

On first connection, you may see:

```
disconnected (1008): pairing required
```

This is a security feature. Approve your device:

```bash
make pair
```

Then refresh your browser.

## Commands

| Command | Description |
|---------|-------------|
| `make dashboard` | Print the dashboard URL with auth token |
| `make devices` | List paired and pending devices |
| `make pair` | Approve all pending device pairing requests |

## Manual Device Management

List devices:

```bash
docker compose exec openclaw-gateway node openclaw.mjs devices list
```

Approve a specific device:

```bash
docker compose exec openclaw-gateway node openclaw.mjs devices approve <request-id>
```

Revoke a device:

```bash
docker compose exec openclaw-gateway node openclaw.mjs devices revoke --device <device-id>
```

## Why Pairing?

The gateway binds to `0.0.0.0` inside the container (required for Docker port mapping). This means it doesn't recognize connections as "local" even when accessing from `127.0.0.1` on the host.

Device pairing ensures only authorized browsers can connect to your gateway, even if someone discovers the port.

## Troubleshooting

**Dashboard shows blank page**

Container may not be running:

```bash
make up
```

**"unauthorized: gateway token missing"**

Use the tokenized URL from `make dashboard`, or paste your token in the Control UI settings panel.

**"pairing required" after approving**

Try refreshing the page. If it persists, check `make devices` to verify your device is listed under "Paired".

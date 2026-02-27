# Upgrade Guide

## How to Upgrade

```bash
make update    # pulls latest base image and rebuilds
```

Docker users are shielded from most upstream breaking changes because:
- The entrypoint script handles config merging
- Environment variables abstract away JSON config format changes
- The Makefile wraps CLI commands

## What's New (v2026.2.26)

### New Providers

Additional AI providers are now supported via environment variables:
- xAI (Grok) - `XAI_API_KEY`
- Groq - `GROQ_API_KEY`
- Mistral - `MISTRAL_API_KEY`
- MiniMax - `MINIMAX_API_KEY`
- Moonshot/Kimi - `MOONSHOT_API_KEY`, `KIMI_API_KEY`
- Volcano Engine - `VOLCANO_ENGINE_API_KEY`

### Search/Tool APIs

- Brave Search - `BRAVE_API_KEY`
- Perplexity - `PERPLEXITY_API_KEY`

### New Channels

- Mattermost - `MATTERMOST_BOT_TOKEN`, `MATTERMOST_URL`

### Health Diagnostics

```bash
make doctor       # diagnose configuration issues
make doctor-fix   # auto-fix what it can
```

### Control UI Origins

When `OPENCLAW_BIND_IP` is set (remote deployments), the Control UI allowed origins are now auto-configured for both loopback and the remote IP.

## Upstream Breaking Changes (for reference)

### Anthropic subscription tokens blocked (Jan 2026)

Anthropic now blocks Claude Pro/Max subscription OAuth tokens from working in
third-party tools including OpenClaw. If you were using a subscription token,
you must switch to a Console API key (pay-per-token) or use OpenRouter.

See [PROVIDERS.md](PROVIDERS.md#anthropic-claude) for details.

### Internal changes (handled by openclaw-docker)

These do NOT affect Docker users:

- Entry point migrated from `dist/index.js` to `openclaw.mjs`
- Config merge logic centralized in `env-to-config.sh`

## Version History

| Version | Date | Notable Changes |
|---------|------|----------------|
| v2026.2.26 | 2026-02-27 | New providers, doctor targets, DRY config refactor |
| v2026.2.5 | 2026-02-05 | Initial release with dashboard, workspaces, security |

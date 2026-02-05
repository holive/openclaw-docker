# openclaw-docker

A secure, zero-friction Docker wrapper for OpenClaw.

## Quick Start

```bash
git clone https://github.com/xxx/openclaw-docker
cd openclaw-docker
make quickstart
```

On first run, choose your AI provider:
- **Free (no API key)**: Kimi, MiniMax OAuth, or Qwen OAuth - run `make configure`
- **Paid**: Anthropic or OpenAI - set API key in `.env` first

Or step by step:

```bash
make setup        # creates .env, generates token, copies templates
make up           # builds and runs gateway
make configure    # choose your AI provider (free options available)
make chat         # interactive TUI
```

## Features

- **Zero friction** - Clone, setup, run in under 2 minutes
- **Secure by default** - All hardening enabled out of the box
- **Config as environment** - No JSON editing, just .env
- **Multi-workspace** - Run different agent personalities
- **Extensible** - Add tools without forking

## Configuration

Copy `.env.example` to `.env`. Key settings:
- AI provider keys (or use `make configure` for free options)
- Gateway token (auto-generated)

See [docs/PROVIDERS.md](docs/PROVIDERS.md) for all options.

## Commands

```bash
make quickstart   # first-time setup + start
make chat         # interactive TUI
make help         # show all commands
```

## Security

Default hardening:
- Loopback binding (127.0.0.1 only)
- Token authentication (64-char hex)
- `cap_drop: ALL`
- `no-new-privileges`
- Memory limit (1.5GB)
- PID limit (256)
- tmpfs /tmp (64MB)

See [docs/SECURITY.md](docs/SECURITY.md) for details on what Docker does and doesn't protect.

## Workspaces

Create multiple agent personalities:

```bash
make workspace-new NAME=work
# edit workspaces/work/SOUL.md for personality
# edit workspaces/work/IDENTITY.md for name/role
make chat WORKSPACE=work
```

See [docs/WORKSPACES.md](docs/WORKSPACES.md) for the multi-workspace guide.

## Customization

See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for adding packages, toolchains, and browser automation.

## Deployment

Deploy to Hetzner Cloud with OpenTofu: see [infra/hetzner/](infra/hetzner/)

## Documentation

- [PROVIDERS.md](docs/PROVIDERS.md) - AI provider options (free and paid)
- [DASHBOARD.md](docs/DASHBOARD.md) - Browser-based Control UI
- [SECURITY.md](docs/SECURITY.md) - What Docker protects and doesn't
- [SKILLS.md](docs/SKILLS.md) - Installing additional skills
- [WORKSPACES.md](docs/WORKSPACES.md) - Multi-workspace guide
- [CUSTOMIZATION.md](docs/CUSTOMIZATION.md) - Extending the image
- [REMOTE.md](docs/REMOTE.md) - Remote access setup

## Pre-installed Skills

- `gh` - GitHub CLI
- `mcporter` - MCP server manager
- `@presto-ai/google-workspace-mcp` - Gmail, Calendar, Drive
- Chromium (optional, enable with `OPENCLAW_BROWSER=true`)

## License

MIT

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

All config via `.env`:

```bash
# ai providers (all optional - see docs/PROVIDERS.md)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=
OPENAI_BASE_URL=

# gateway (auto-configured)
OPENCLAW_GATEWAY_TOKEN=     # auto-generated on setup
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_BIND=loopback

# optional channels
TELEGRAM_BOT_TOKEN=
DISCORD_BOT_TOKEN=
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
```

See [docs/PROVIDERS.md](docs/PROVIDERS.md) for available AI providers including free options.

## Commands

```bash
# lifecycle
make up             # start gateway
make down           # stop gateway
make restart        # restart
make update         # pull latest and rebuild

# operations
make chat           # interactive TUI
make logs           # follow logs
make shell          # debug shell
make status         # show status

# workspaces
make chat WORKSPACE=work       # use different workspace
make workspace-new NAME=work   # create new workspace
make workspace-list            # list workspaces

# skills
make skill-install SKILL=x     # install npm skill
make skill-list                # list installed
make skill-remove SKILL=x      # remove skill

# data
make backup         # export data + workspaces
make restore FILE=x # restore from backup
make clean          # wipe everything
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

Add system packages:
```bash
docker compose build --build-arg EXTRA_APT_PACKAGES="ffmpeg imagemagick"
```

Add custom toolchains by editing `user-setup.sh`:
```bash
# example: install rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

Enable browser automation:
```bash
# in .env
OPENCLAW_BROWSER=true
```

See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for more options.

## Documentation

- [PROVIDERS.md](docs/PROVIDERS.md) - AI provider options (free and paid)
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

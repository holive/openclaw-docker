

<table>
  <tr>
  <td width="360">
  <img src="https://github.com/user-attachments/assets/ade417a8-a159-4b3a-8195-061684c1b44e" alt="openclaw" width="360">
  </td>
  <td>

  **openclaw-docker**

  Zero-friction Docker wrapper for OpenClaw.

  </td>
  </tr>
  </table>
  
 ---
 
## Quick Start

```bash
git clone https://github.com/holive/openclaw-docker
cd openclaw-docker
make quickstart
```

On first run, choose your AI provider:
- **Free (no API key)**: Kimi, MiniMax OAuth, or Qwen OAuth - run `make configure`
- **Paid**: Anthropic, OpenAI, xAI, etc. - set API key in `.env` first
- **Via OpenRouter**: access multiple providers through a single key

Or step by step:

```bash
make setup        # creates .env, generates token, copies templates
make up           # builds and runs gateway
make configure    # choose your AI provider (free options available)
make chat         # interactive TUI
```

## Resume

```bash
make resume       # start (if needed) and chat
make info         # check status without starting anything
```

## Features

- **Zero friction** - Clone, setup, run in under 2 minutes
- **Secure by default** - All hardening enabled out of the box
- **Config as environment** - No JSON editing, just .env
- **Multi-workspace** - Run different agent personalities
- **Health diagnostics** - Built-in doctor for config issues
- **Extensible** - Add tools without forking

## Configuration

Copy `.env.example` to `.env`. Key settings:
- AI provider keys (or use `make configure` for free options)
- Gateway token (auto-generated)

See [docs/PROVIDERS.md](docs/PROVIDERS.md) for all options.

## Commands

```bash
make quickstart   # first-time setup + start
make resume       # start (if needed) and chat
make info         # check workspace, provider, container status
make chat         # interactive TUI (requires running gateway)
make help         # show all commands
```

## Security

Default hardening:
- Loopback binding (127.0.0.1 by default, configurable for remote)
- Token authentication (64-char hex)
- `cap_drop: ALL`
- `no-new-privileges`
- PID limit (256, fork bomb protection)
- tmpfs /tmp (64MB)

Device pairing ensures only authorized browsers connect. Run `make doctor` to diagnose configuration issues.

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
- [UPGRADE.md](docs/UPGRADE.md) - Upgrade guide and version history

## Pre-installed Skills

- `gh` - GitHub CLI
- `mcporter` - MCP server manager
- `@presto-ai/google-workspace-mcp` - Gmail, Calendar, Drive
- Chromium (optional, enable with `OPENCLAW_BROWSER=true`)

## License

MIT

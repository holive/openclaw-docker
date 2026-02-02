# Skills

Skills extend your agent's capabilities. This project pre-installs common skills and makes it easy to add more.

## Pre-installed Skills

| Skill | Purpose |
|-------|---------|
| `gh` | GitHub CLI for repo management |
| `mcporter` | MCP server manager |
| `@presto-ai/google-workspace-mcp` | Gmail, Calendar, Drive |

## Installing Skills

```bash
make skill-install SKILL=skill-name
```

Examples:

```bash
# twitter/x integration
make skill-install SKILL=bird

# slack mcp server
make skill-install SKILL=@anthropic/slack-mcp

# custom mcp server
make skill-install SKILL=@someone/custom-mcp
```

## Listing Skills

```bash
make skill-list
```

Shows all globally installed npm packages.

## Removing Skills

```bash
make skill-remove SKILL=skill-name
```

## Browser Automation

Chromium is optional (increases image size). Enable it in `.env`:

```bash
OPENCLAW_BROWSER=true
```

Then rebuild:

```bash
make rebuild
```

## Custom Skills at Build Time

Add npm packages to the Dockerfile:

```dockerfile
# after the existing npm install line
RUN npm install -g your-custom-skill another-skill
```

## System-Level Tools

For tools that need system packages, use build args:

```bash
docker compose build --build-arg EXTRA_APT_PACKAGES="ffmpeg imagemagick"
```

Or add to Dockerfile:

```dockerfile
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*
```

## MCP Servers

Many skills are MCP (Model Context Protocol) servers. After installing, configure them in the agent's settings or via environment variables.

Common MCP servers:

| Package | Purpose |
|---------|---------|
| `mcporter` | MCP server manager |
| `@presto-ai/google-workspace-mcp` | Google Workspace |
| `@anthropic/slack-mcp` | Slack |
| `bird` | Twitter/X |

## Troubleshooting

**Skill not found after install:**
```bash
make shell
npm list -g --depth=0
```

**Permission errors:**
Skills are installed as the `node` user. Root-level installs require Dockerfile changes.

**Skill conflicts:**
Check for version conflicts:
```bash
make shell
npm ls -g
```

## Creating Custom Skills

Skills are typically MCP servers. See the MCP documentation for creating your own:
- Define tools the agent can use
- Handle requests and return results
- Package as npm module

Install your local skill:
```bash
# mount your skill directory and install
docker compose exec openclaw-gateway npm install -g /path/to/your-skill
```

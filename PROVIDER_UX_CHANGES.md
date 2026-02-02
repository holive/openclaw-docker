# Provider Configuration UX Changes

## Context

OpenClaw 2026.1.30 introduced free AI providers that work out of the box. The current setup incorrectly assumes an Anthropic API key is required, which creates unnecessary friction for users who want to use free options.

### Available Providers (as of 2026.1.30)

| Provider | Auth Method | Cost | Notes |
|----------|-------------|------|-------|
| Kimi K2.5 | Moonshot API key | $0 | Free tier, requires signup |
| Kimi Coding | Built-in provider | $0 | Switched to built-in in 2026.1.30 |
| MiniMax | OAuth (browser login) | $0 | No API key needed |
| Qwen | OAuth (browser login) | $0 | 2000 req/day free |
| Ollama | None (local) | $0 | Runs on user hardware |
| Anthropic | API key | Paid | Claude models |
| OpenAI | API key | Paid | GPT models |

### Key Insight

"Free out of the box" means $0 cost + simpler auth (OAuth login vs manual API keys), not "zero configuration". The --allow-unconfigured flag lets users start and configure via the onboard wizard.

---

## Changes Required

### 1. .env.example

**Why:** Remove the implication that an API key is required. Users should know they can use free providers via make onboard.

**Current content:**
```bash
# gateway authentication token
# generate with: openssl rand -hex 32
OPENCLAW_GATEWAY_TOKEN=

# gateway binding (loopback, lan, or tailnet)
OPENCLAW_GATEWAY_BIND=loopback

# gateway port
OPENCLAW_GATEWAY_PORT=18789
```

**New content:**
```bash
# openclaw-docker configuration
# copy to .env and customize

# === ai providers (all optional - configure via 'make onboard') ===
# free options: run 'make onboard' and choose Kimi, MiniMax OAuth, or Qwen OAuth
# paid options: set your API key below
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=

# === gateway (auto-configured on setup) ===
# generate token with: openssl rand -hex 32
OPENCLAW_GATEWAY_TOKEN=
OPENCLAW_GATEWAY_BIND=loopback
OPENCLAW_GATEWAY_PORT=18789
```

---

### 2. scripts/setup.sh

**Why:** The "next steps" section currently doesn't mention free provider options. Users should know they can get started without an API key.

**Current "next steps" section (end of file):**
```bash
echo
echo "setup complete"
echo
echo "your gateway token:"
grep "^OPENCLAW_GATEWAY_TOKEN=" .env | cut -d'=' -f2
echo
echo "next steps:"
echo "  1. run: make up"
echo "  2. run: make onboard    (configures api keys, channels, security)"
echo "  3. open: http://127.0.0.1:18789"
echo "  4. enter your gateway token when prompted"
```

**New "next steps" section:**
```bash
echo
echo "setup complete"
echo
echo "your gateway token:"
grep "^OPENCLAW_GATEWAY_TOKEN=" .env | cut -d'=' -f2
echo
echo "next steps:"
echo "  1. run: make up"
echo "  2. run: make onboard    (choose your AI provider)"
echo "  3. open: http://127.0.0.1:18789"
echo
echo "provider options:"
echo "  - free: Kimi, MiniMax OAuth, or Qwen OAuth (via 'make onboard')"
echo "  - paid: set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env"
echo
echo "see docs/PROVIDERS.md for details"
```

---

### 3. README.md

**Why:** The Quick Start section should guide users to choose a provider and mention free options are available.

**Current Quick Start step 3:**
```markdown
3. Run onboarding wizard:
   ```bash
   make onboard
   ```
   Configures API keys, channels, and security settings.
```

**New Quick Start step 3:**
```markdown
3. Run onboarding wizard:
   ```bash
   make onboard
   ```
   Choose your AI provider:
   - **Free (no API key)**: Kimi, MiniMax OAuth, or Qwen OAuth
   - **Paid**: Anthropic or OpenAI (set in .env first, or configure in wizard)

   See [docs/PROVIDERS.md](docs/PROVIDERS.md) for details on each provider.
```

---

### 4. docs/PROVIDERS.md (new file)

**Why:** Dedicated documentation explaining all provider options, how to set them up, and how to switch between them.

**Content:**
```markdown
# AI Providers

OpenClaw supports multiple AI providers, including free options that require no API keys.

## Provider Comparison

| Provider | Auth Method | Cost | Notes |
|----------|-------------|------|-------|
| Kimi K2.5 | Moonshot API key | $0 | Free tier, requires signup |
| Kimi Coding | Built-in provider | $0 | Switched to built-in in 2026.1.30 |
| MiniMax | OAuth (browser login) | $0 | No API key needed |
| Qwen | OAuth (browser login) | $0 | 2000 req/day free |
| Ollama | None (local) | $0 | Runs on user hardware |
| Anthropic | API key | Paid | Claude models |
| OpenAI | API key | Paid | GPT models |

## Quick Setup

make up
make onboard    # launches wizard

The wizard guides you through selecting and configuring your provider.

## Free Providers

### Kimi (Moonshot)

Two options available:

**Kimi Coding (recommended)**
- Built-in provider, no signup required
- Select in make onboard wizard

**Kimi K2.5**
- Requires Moonshot API key (free tier available)
- Sign up at moonshot.ai

### MiniMax OAuth

- Browser-based login, no API key needed
- The wizard opens your browser for authentication
- Token stored locally after first login

### Qwen OAuth

- Browser-based login, no API key needed
- 2000 requests/day on free tier
- Good for moderate usage

### Ollama (Local)

- Runs entirely on your machine
- No internet required after model download
- Requires Ollama installed: https://ollama.ai

## Paid Providers

### Anthropic (Claude)

Set in .env before running:

ANTHROPIC_API_KEY=sk-ant-...

Or configure via wizard after setup.

### OpenAI (GPT)

Set in .env:

OPENAI_API_KEY=sk-...

For compatible endpoints (Azure, local proxies):

OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://your-endpoint.com/v1

## Switching Providers

Run the wizard again:

make onboard

Or edit provider settings directly:

make shell
vi ~/.openclaw/openclaw.json
exit
make down && make up

## Troubleshooting

**OAuth login not working**
- Ensure browser can open from Docker (may need X11 forwarding)
- Try running make chat and configure from TUI settings

**API key not recognized**
- Check .env has no quotes around the key
- Run make down && make up after editing .env

**Rate limits on free tier**
- Switch to a different free provider
- Consider paid options for heavy usage
```

---

## Summary

| File | Change |
|------|--------|
| .env.example | Add AI providers section with free options comment, remove "required" implication |
| scripts/setup.sh | Update next steps to mention free providers and link to docs |
| README.md | Update Quick Start step 3 with provider choice guidance |
| docs/PROVIDERS.md | Create new file with full provider documentation |

## Verification

After changes:
1. .env.example should show all providers as optional
2. make setup output should mention free provider options
3. README Quick Start should guide users to choose a provider
4. docs/PROVIDERS.md should exist with provider comparison table

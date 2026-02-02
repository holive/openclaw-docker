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

```bash
make up
make onboard    # launches wizard
```

The wizard guides you through selecting and configuring your provider.

## Free Providers

### Kimi (Moonshot)

Two options available:

**Kimi Coding (recommended)**
- Built-in provider, no signup required
- Select in `make onboard` wizard

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

Set in `.env` before running:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Or configure via wizard after setup.

### OpenAI (GPT)

Set in `.env`:

```bash
OPENAI_API_KEY=sk-...
```

For compatible endpoints (Azure, local proxies):

```bash
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://your-endpoint.com/v1
```

## Switching Providers

Run the wizard again:

```bash
make onboard
```

Or edit provider settings directly:

```bash
make shell
vi ~/.openclaw/openclaw.json
exit
make down && make up
```

## Troubleshooting

**OAuth login not working**
- Ensure browser can open from Docker (may need X11 forwarding)
- Try running `make chat` and configure from TUI settings

**API key not recognized**
- Check `.env` has no quotes around the key
- Run `make down && make up` after editing `.env`

**Rate limits on free tier**
- Switch to a different free provider
- Consider paid options for heavy usage

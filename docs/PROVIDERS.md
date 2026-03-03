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
| Anthropic | API key (Console) | Paid | Claude models (subscription tokens don't work) |
| OpenAI | API key | Paid | GPT models |
| OpenRouter | API key | Varies | Access multiple providers via single key |
| xAI | API key | Paid | Grok models |
| Groq | API key | Free tier | Fast inference |
| Mistral | API key | Free tier | Mistral/Mixtral models |
| MiniMax | API key or OAuth | Free tier | MiniMax models |
| Moonshot | API key | Free tier | Kimi models |
| Volcano Engine | API key | Paid | ByteDance models |

## Quick Setup

```bash
make up
make configure    # launches wizard
```

The wizard guides you through selecting and configuring your provider.

## Free Providers

### Kimi (Moonshot)

Two options available:

**Kimi Coding (recommended)**
- Built-in provider, no signup required
- Select in `make configure` wizard

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

Requires an API key from the [Anthropic Console](https://console.anthropic.com/) (pay-per-token).

> **Note**: Claude Pro/Max subscription tokens do not work with OpenClaw.
> Anthropic blocked third-party tools from using subscription OAuth tokens
> in January 2026. You need a Console API key, not a subscription.

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

### xAI (Grok)

Set in `.env`:

```bash
XAI_API_KEY=xai-...
```

### Groq

Fast inference platform with free tier. Set in `.env`:

```bash
GROQ_API_KEY=gsk_...
```

Sign up at groq.com.

### Mistral

Set in `.env`:

```bash
MISTRAL_API_KEY=...
```

Sign up at console.mistral.ai.

### OpenRouter

Access Claude, GPT, and other models through a single API key. Useful if you want to avoid managing multiple provider keys, or as an alternative to a direct Anthropic API key.

Sign up at openrouter.ai and set in `.env`:

```bash
OPENAI_API_KEY=sk-or-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
```

OpenRouter uses the OpenAI-compatible API format, so it works through the existing `OPENAI_API_KEY` + `OPENAI_BASE_URL` variables.

### Search/Tool APIs

These enable web search and tool capabilities:

```bash
BRAVE_API_KEY=...       # brave search api
PERPLEXITY_API_KEY=...  # perplexity search api
```

## Switching Providers

Run the wizard again:

```bash
make configure
```

Or edit provider settings directly:

```bash
make shell
vi ~/.openclaw/openclaw.json
exit
make restart
```

## Troubleshooting

**OAuth login not working**
- Ensure browser can open from Docker (may need X11 forwarding)
- Try running `make chat` and configure from TUI settings

**API key not recognized**
- Check `.env` has no quotes around the key
- Run `make restart` after editing `.env`

**Rate limits on free tier**
- Switch to a different free provider
- Consider paid options for heavy usage

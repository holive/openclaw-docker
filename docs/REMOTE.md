# Remote Access

Access your OpenClaw instance from anywhere.

## Security Warning

Remote access exposes your agent to network attacks. Before proceeding:

1. Ensure token authentication is enabled (default)
2. Use encrypted connections (HTTPS/TLS)
3. Consider IP allowlisting
4. Review [SECURITY.md](SECURITY.md)

## Option 1: Tailscale (Recommended)

Tailscale creates a private network between your devices.

### Setup

1. Install Tailscale on your server:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

2. Install Tailscale on your client device

3. Access via Tailscale IP:
```
http://100.x.x.x:18789
```

### Advantages

- No port forwarding
- Works behind NAT
- Encrypted by default
- Access control via Tailscale ACLs

## Option 2: SSH Tunnel

Forward the port over SSH:

### From client

```bash
ssh -L 18789:127.0.0.1:18789 user@your-server
```

Then access locally:
```
http://127.0.0.1:18789
```

### Persistent tunnel with autossh

```bash
autossh -M 0 -f -N -L 18789:127.0.0.1:18789 user@your-server
```

## Option 3: Nginx Reverse Proxy

For HTTPS with a domain name.

### Prerequisites

- Domain pointing to your server
- Certbot for SSL certificates

### Configuration

1. Bind to all interfaces in `.env`:
```bash
OPENCLAW_GATEWAY_BIND=0.0.0.0
```

2. Create nginx config `/etc/nginx/sites-available/openclaw`:
```nginx
server {
    listen 80;
    server_name openclaw.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name openclaw.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/openclaw.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openclaw.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. Get SSL certificate:
```bash
sudo certbot --nginx -d openclaw.yourdomain.com
```

### IP Allowlisting

Add to nginx config:
```nginx
location / {
    allow 1.2.3.4;      # your IP
    allow 10.0.0.0/8;   # local network
    deny all;

    proxy_pass http://127.0.0.1:18789;
    # ... rest of config
}
```

## Option 4: Cloudflare Tunnel

Zero-trust access without exposing ports.

1. Install cloudflared:
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

2. Authenticate:
```bash
cloudflared tunnel login
```

3. Create tunnel:
```bash
cloudflared tunnel create openclaw
```

4. Configure `~/.cloudflared/config.yml`:
```yaml
tunnel: openclaw
credentials-file: /home/user/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: openclaw.yourdomain.com
    service: http://localhost:18789
  - service: http_status:404
```

5. Route DNS:
```bash
cloudflared tunnel route dns openclaw openclaw.yourdomain.com
```

6. Run tunnel:
```bash
cloudflared tunnel run openclaw
```

### Cloudflare Access (Optional)

Add authentication via Cloudflare Access for additional security.

## Channel Integrations

For Telegram, Discord, or Slack, you don't need remote web access. Configure the tokens in `.env` and the agent will connect to the platforms directly.

```bash
TELEGRAM_BOT_TOKEN=your-token
DISCORD_BOT_TOKEN=your-token
SLACK_BOT_TOKEN=your-token
SLACK_APP_TOKEN=your-token
```

## Troubleshooting

### Connection refused

Check if gateway is running:
```bash
make status
```

Check binding:
```bash
docker compose exec openclaw-gateway netstat -tlnp
```

### WebSocket errors

Ensure proxy is configured for WebSocket:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### SSL certificate issues

Check certificate validity:
```bash
openssl s_client -connect openclaw.yourdomain.com:443 -servername openclaw.yourdomain.com
```

### Firewall blocking

Allow the port:
```bash
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
```

# Customization

Extend openclaw-docker without forking.

## Build Arguments

### Extra APT Packages

Add system packages at build time:

```bash
docker compose build --build-arg EXTRA_APT_PACKAGES="ffmpeg imagemagick curl wget"
```

Or set in `.env`:
```bash
EXTRA_APT_PACKAGES=ffmpeg imagemagick
```

### Browser Automation

Enable Chromium for web automation:

```bash
# in .env
OPENCLAW_BROWSER=true
```

Rebuild:
```bash
make rebuild
```

## user-setup.sh

Custom toolchain setup that runs during build:

```bash
#!/bin/bash
# user-setup.sh

# install rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# install python packages
pip install requests pandas

# install go
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
rm go1.21.0.linux-amd64.tar.gz
```

After editing, rebuild:
```bash
make rebuild
```

## Dockerfile Modifications

For more complex customization, edit the Dockerfile directly.

### Adding npm packages

```dockerfile
# after existing npm install
RUN npm install -g @your-org/custom-mcp typescript tsx
```

### Adding a custom layer

```dockerfile
# before USER node
COPY my-custom-script.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/my-custom-script.sh
```

### Multi-stage builds

For tools that need compilation:

```dockerfile
FROM ghcr.io/openclaw/openclaw:latest as base

FROM rust:1.70 as rust-builder
RUN cargo install some-tool

FROM base
COPY --from=rust-builder /usr/local/cargo/bin/some-tool /usr/local/bin/
```

## docker-compose.yml Modifications

### Additional volumes

Mount extra directories:

```yaml
volumes:
  - ./data:/home/node/.openclaw
  - ./workspaces/${OPENCLAW_WORKSPACE:-default}:/home/node/.openclaw/workspace
  - ~/projects:/home/node/projects:ro  # read-only project access
```

### Resource limits

Adjust memory and CPU:

```yaml
deploy:
  resources:
    limits:
      memory: 4G
      cpus: '2'
```

### Read-only filesystem

For production security:

```yaml
read_only: true
```

### Additional security

```yaml
security_opt:
  - no-new-privileges:true
  - seccomp:custom-profile.json  # custom seccomp profile
```

## Environment Variables

### Gateway configuration

```bash
OPENCLAW_GATEWAY_TOKEN=your-token
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_BIND=loopback  # loopback | lan | 0.0.0.0
```

### Memory limit

```bash
OPENCLAW_MEMORY_LIMIT=2048m  # default: 1536m
```

### Custom workspace

```bash
OPENCLAW_WORKSPACE=work  # default: default
```

## Creating a Derived Image

For repeatable customization, create your own Dockerfile:

```dockerfile
# Dockerfile.custom
FROM ghcr.io/openclaw/openclaw-docker:latest

USER root

# your customizations
RUN apt-get update && apt-get install -y my-packages
RUN npm install -g my-skills

USER node
```

Build and use:
```bash
docker build -f Dockerfile.custom -t my-openclaw .
```

Update docker-compose.yml:
```yaml
services:
  openclaw-gateway:
    image: my-openclaw
    # remove build section
```

## Makefile Extensions

Add custom targets to a separate file:

```makefile
# Makefile.local
.PHONY: my-target

my-target:
	@echo "my custom command"
```

Include in main Makefile:
```makefile
-include Makefile.local
```

## Tips

1. **Test changes incrementally** - Build after each change to catch errors early
2. **Use .dockerignore** - Keep build context small
3. **Layer ordering** - Put frequently changing layers last
4. **Cache npm installs** - Group npm installs together
5. **Document your changes** - Future you will thank present you

FROM ghcr.io/openclaw/openclaw:latest

ARG EXTRA_APT_PACKAGES=""
ARG OPENCLAW_BROWSER="false"

USER root

# install github cli (official debian package)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh libsecret-1-0 jq ${EXTRA_APT_PACKAGES} \
    && rm -rf /var/lib/apt/lists/*

# install npm global packages for skills
RUN npm install -g mcporter @presto-ai/google-workspace-mcp

# optional: install chromium for browser automation
RUN if [ "$OPENCLAW_BROWSER" = "true" ]; then \
    apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*; \
    fi

# copy custom entrypoint and user setup
COPY user-setup.sh /tmp/user-setup.sh
RUN chmod +x /tmp/user-setup.sh && /tmp/user-setup.sh

COPY start-openclaw.sh /start-openclaw.sh
RUN chmod +x /start-openclaw.sh

COPY scripts/env-to-config.sh /env-to-config.sh
RUN chmod +x /env-to-config.sh

USER node
ENTRYPOINT ["/start-openclaw.sh"]

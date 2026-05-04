ARG NODE_VERSION=24.14.0
ARG PNPM_VERSION=10.32.1

FROM node:${NODE_VERSION}-bookworm-slim
ARG PNPM_VERSION

# System deps takt and the agent CLIs need at runtime.
# - git: takt operates on a checked-out repo
# - gh: GitHub label / comment / PR operations
# - curl + ca-certificates: cursor-agent installer + general HTTPS
# - openssl: needed by gh / git over https
# - procps: ps / pkill used by symphony for child cleanup
RUN apt-get update \
  && apt-get install --no-install-recommends -y \
       git curl ca-certificates openssl procps tini \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install --no-install-recommends -y gh \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# pnpm and the global CLIs symphony delegates to.
RUN npm install -g pnpm@${PNPM_VERSION} takt @anthropic-ai/claude-code @openai/codex

# cursor-agent has its own installer that drops a versioned binary into
# ~/.local/share and a symlink in ~/.local/bin. Run it as the runtime user
# so the symlink lands somewhere addressable.
ENV HOME=/data/home
RUN mkdir -p /tmp/cursor-install \
  && HOME=/tmp/cursor-install bash -c 'curl -fsSL https://cursor.com/install | bash' \
  && mkdir -p /opt/cursor-agent \
  && cp -r /tmp/cursor-install/.local/share/cursor-agent /opt/cursor-agent/ \
  && rm -rf /tmp/cursor-install

# Put the cursor-agent binary on PATH for everyone. The actual auth state
# (~/.config/cursor) lives on the persistent Volume via $HOME.
ENV PATH="/opt/cursor-agent/cursor-agent/versions/latest:${PATH}"
RUN ln -s /opt/cursor-agent/cursor-agent/versions/*/cursor-agent /usr/local/bin/cursor-agent || true

WORKDIR /app
COPY infra/symphony/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Fly proxy hits port 8080. The HTTP server in bin/symphony-serve.ts
# listens on 0.0.0.0:8080.
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]

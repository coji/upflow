ARG NODE_VERSION=24.14.0
ARG PNPM_VERSION=10.32.1

# Pin CLI versions explicitly so the image is reproducible. Bump these
# along with takt-side feature work; otherwise an opaque `latest` shift
# can change observed runner behavior between rebuilds.
ARG TAKT_VERSION=0.39.0
ARG CLAUDE_CODE_VERSION=2.1.126
ARG CODEX_VERSION=0.128.0

FROM node:${NODE_VERSION}-bookworm-slim
ARG PNPM_VERSION
ARG TAKT_VERSION
ARG CLAUDE_CODE_VERSION
ARG CODEX_VERSION

# System deps takt and the agent CLIs need at runtime.
# - git: takt operates on a checked-out repo
# - gh: GitHub label / comment / PR operations
# - curl + ca-certificates: cursor-agent installer + general HTTPS
# - openssl: needed by gh / git over https
# - procps: ps / pkill used by symphony for child cleanup
# - gosu: lets entrypoint chown the Volume as root then drop to the
#         service user, so SSH'd-as-root auth files self-heal each boot
RUN apt-get update \
  && apt-get install --no-install-recommends -y \
       git curl ca-certificates openssl procps tini gnupg gosu \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install --no-install-recommends -y gh \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# pnpm and the global CLIs symphony delegates to. Versions pinned via ARG.
RUN npm install -g \
       pnpm@${PNPM_VERSION} \
       takt@${TAKT_VERSION} \
       @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
       @openai/codex@${CODEX_VERSION}

# cursor-agent installs into the invoker's HOME, so we run the script in
# a throwaway HOME and copy the binary into a system path. The official
# installer doesn't expose a version pin yet — track upstream and rebuild
# the image when cursor-agent rolls out a relevant change.
RUN mkdir -p /tmp/cursor-install \
  && HOME=/tmp/cursor-install bash -c 'curl -fsSL https://cursor.com/install | bash' \
  && mkdir -p /opt/cursor-agent \
  && cp -r /tmp/cursor-install/.local/share/cursor-agent /opt/cursor-agent/ \
  && ln -s /opt/cursor-agent/cursor-agent/versions/*/cursor-agent /usr/local/bin/cursor-agent \
  && rm -rf /tmp/cursor-install

# Run the server as a non-root user. /data is the Volume mount and is
# owned by symphony so the persisted auth/repo state can be read+written.
# `--no-create-home` because HOME is forced to /data/home everywhere
# (Dockerfile ENV, /etc/profile.d/symphony-home.sh, entrypoint.sh) — a
# physical /home/symphony directory is dead weight.
RUN groupadd --system --gid 1001 symphony \
  && useradd --system --uid 1001 --gid symphony --no-create-home --home-dir /home/symphony symphony \
  && mkdir -p /app /data \
  && chown -R symphony:symphony /app /data

# `flyctl ssh console` opens an interactive login shell (default: root). Without
# this, HOME stays at /root for root sessions and /home/symphony for `-u symphony`,
# so any `gh auth login` etc. lands on the ephemeral image rootfs and is lost on
# restart. Forcing HOME=/data/home here keeps every interactive auth on the Volume.
RUN printf '%s\n' \
      'export HOME=/data/home' \
      'mkdir -p "$HOME" 2>/dev/null || true' \
    > /etc/profile.d/symphony-home.sh \
  && chmod +x /etc/profile.d/symphony-home.sh

WORKDIR /app
COPY --chown=symphony:symphony infra/symphony/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV HOME=/data/home

# Entrypoint starts as root so it can chown the Volume contents (auth files
# created from a SSH'd-as-root session belong to root and would otherwise
# block the unprivileged service user). After fixing ownership, the script
# re-execs itself under `gosu symphony`. There is no `USER symphony` here.

# Fly proxy hits port 8080. The HTTP server in bin/symphony-serve.ts
# listens on 0.0.0.0:8080.
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]

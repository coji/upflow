ARG NODE_VERSION=24.14.0
ARG PNPM_VERSION=10.32.1
ARG LITESTREAM_VERSION=0.5.11

# --- Build base: includes native build tools for better-sqlite3 ---
FROM node:${NODE_VERSION}-slim AS build-base
ARG PNPM_VERSION

RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl curl ca-certificates build-essential python3 \
  && apt-get clean \
  && npm i -g pnpm@${PNPM_VERSION} \
  && rm -rf /var/lib/apt/lists/*


# --- Runtime base: minimal packages for production ---
FROM node:${NODE_VERSION}-slim AS runtime-base
ARG PNPM_VERSION
ARG LITESTREAM_VERSION

RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl openssh-client sqlite3 procps curl ca-certificates unzip vim \
  && apt-get clean \
  && npm i -g pnpm@${PNPM_VERSION} \
  && curl -sSf https://atlasgo.sh | sh \
  && rm -rf /var/lib/apt/lists/*

# SHA256 digests are pinned to LITESTREAM_VERSION above.
# When bumping LITESTREAM_VERSION, refresh these from the corresponding GitHub release:
#   curl -sSL https://api.github.com/repos/benbjohnson/litestream/releases/tags/v<version>
RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
    amd64) litestream_arch="x86_64";  litestream_sha256="f9139fb9796a4c6e61bd160e1309450e954686584d91350dec849a4b6c638e54" ;; \
    arm64) litestream_arch="arm64";   litestream_sha256="7f023f620183aee439202430758a3e8b6b31d7302fd2ba6ff486bb4c3a4a32d5" ;; \
    armhf) litestream_arch="armv7";   litestream_sha256="5259f3bb55ae90e1e490dde7a524fc52dbc883ef1545b43996cb3129c404e88e" ;; \
    *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
  esac; \
  curl -fsSL -o /tmp/litestream.deb "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${litestream_arch}.deb"; \
  echo "${litestream_sha256}  /tmp/litestream.deb" | sha256sum -c -; \
  dpkg -i /tmp/litestream.deb; \
  rm /tmp/litestream.deb


# --- Install all node_modules (dev + prod) ---
FROM build-base AS deps

WORKDIR /upflow

COPY package.json pnpm-lock.yaml ./
RUN pnpm fetch


# --- Production node_modules only ---
FROM build-base AS production-deps

ENV NODE_ENV=production
WORKDIR /upflow

COPY --from=deps /upflow/node_modules /upflow/node_modules
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --offline --frozen-lockfile


# --- Build the app ---
FROM build-base AS build

WORKDIR /upflow

COPY --from=deps /upflow/node_modules /upflow/node_modules
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --offline --frozen-lockfile && pnpm rebuild better-sqlite3

COPY . .

# Sentry (optional). DSN is baked into the client bundle at build time; server reads SENTRY_DSN at runtime.
# SENTRY_PUBLISH_RELEASE=1 enables source map upload (requires SENTRY_AUTH_TOKEN).
ARG SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_TRACES_SAMPLE_RATE
ARG SENTRY_PUBLISH_RELEASE

RUN SENTRY_DSN="$SENTRY_DSN" \
    VITE_SENTRY_DSN="$SENTRY_DSN" \
    SENTRY_TRACES_SAMPLE_RATE="$SENTRY_TRACES_SAMPLE_RATE" \
    VITE_SENTRY_TRACES_SAMPLE_RATE="$SENTRY_TRACES_SAMPLE_RATE" \
    SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" \
    SENTRY_PUBLISH_RELEASE="$SENTRY_PUBLISH_RELEASE" \
    pnpm run build


# --- Production image ---
FROM runtime-base

ENV UPFLOW_DATA_DIR="/upflow/data"
ENV PORT="8080"
ENV NODE_ENV="production"

# add shortcut for connecting to database CLI
RUN printf '#!/bin/sh\nset -x\nsqlite3 "${UPFLOW_DATA_DIR}/data.db"\n' > /usr/local/bin/database-cli && chmod +x /usr/local/bin/database-cli

WORKDIR /upflow

COPY --from=production-deps /upflow/node_modules /upflow/node_modules
COPY --from=build /upflow/build /upflow/build
COPY --from=build /upflow/public /upflow/public
COPY --from=build /upflow/db /upflow/db
COPY --from=build /upflow/atlas.hcl /upflow/atlas.hcl
COPY --from=build /upflow/litestream.yml /etc/litestream.yml
COPY --from=build /upflow/package.json /upflow/package.json
COPY --from=build /upflow/tsconfig.json /upflow/tsconfig.json
COPY --from=build /upflow/start.sh /upflow/start.sh
COPY --from=build /upflow/app /upflow/app
COPY --from=build /upflow/batch /upflow/batch
COPY --from=build /upflow/ops/remote /upflow/ops/remote
COPY --from=build /upflow/server.mjs /upflow/server.mjs
COPY --from=build /upflow/instrument.server.mjs /upflow/instrument.server.mjs

CMD [ "sh", "./start.sh" ]

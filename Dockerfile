# base node image
FROM node:16-bullseye-slim as base
ARG PNPM_VERSION=7.12.1

# Install openssl for Prisma
RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl sqlite3 procps \
  && apt-get clean \
  && npm i -g pnpm@${PNPM_VERSION} \
  && rm -rf /var/lib/apt/lists/* 


# Install all node_modules, including dev dependencies
FROM base as deps

WORKDIR /upflow

COPY pnpm-lock.yaml ./
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN pnpm fetch


# Setup production node_modules
FROM base as production-deps

ENV NODE_ENV production
WORKDIR /upflow

COPY --from=deps /upflow/node_modules /upflow/node_modules
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --offline --frozen-lockfile


# Build the app
FROM base as build

WORKDIR /upflow

COPY --from=deps /upflow/node_modules /upflow/node_modules
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --offline --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build


# Finally, build the production image with minimal footprint
FROM base

ENV DATABASE_URL "file:/upflow/data/data.db?connection_limit=1"
ENV UPFLOW_DATA_DIR "/upflow/data"
ENV PORT "8080"
ENV NODE_ENV "production"

# add shortcut for connecting to database CLI
RUN printf '#!/bin/sh\nset -x\nsqlite3 file:/upflow/data/data.db\n' > /usr/local/bin/database-cli && chmod +x /usr/local/bin/database-cli

WORKDIR /upflow

# ほんとは production-deps の node_modules を使いたいけど prisma generate 後のファイルがないので一旦buildで。
COPY --from=build /upflow/node_modules /upflow/node_modules

COPY --from=build /upflow/build /upflow/build
COPY --from=build /upflow/public /upflow/public
COPY --from=build /upflow/prisma /upflow/prisma
COPY --from=build /upflow/package.json /upflow/package.json
COPY --from=build /upflow/start.sh /upflow/start.sh

ENTRYPOINT [ "./start.sh" ]

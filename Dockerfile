ARG NODE_VERSION=22.14.0
ARG PNPM_VERSION=10.5.2

# base node image
FROM node:${NODE_VERSION}-slim AS base

# Install dependencies and Atlas
RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl openssh-client sqlite3 procps curl ca-certificates unzip vim build-essential python3 \
  && apt-get clean \
  && npm i -g pnpm@${PNPM_VERSION} \
  && curl -sSf https://atlasgo.sh | sh \
  && rm -rf /var/lib/apt/lists/* 

# Install all node_modules, including dev dependencies
FROM base AS deps

WORKDIR /upflow

COPY package.json pnpm-lock.yaml ./
RUN pnpm fetch


# Setup production node_modules
FROM base AS production-deps

ENV NODE_ENV production
WORKDIR /upflow

COPY --from=deps /upflow/node_modules /upflow/node_modules
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --offline --frozen-lockfile


# Build the app
FROM base AS build

WORKDIR /upflow

COPY --from=deps /upflow/node_modules /upflow/node_modules
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --offline --frozen-lockfile && pnpm rebuild better-sqlite3

COPY . .
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

COPY --from=production-deps /upflow/node_modules /upflow/node_modules
COPY --from=build /upflow/build /upflow/build
COPY --from=build /upflow/public /upflow/public
COPY --from=build /upflow/db /upflow/db
COPY --from=build /upflow/atlas.hcl /upflow/atlas.hcl
COPY --from=build /upflow/package.json /upflow/package.json
COPY --from=build /upflow/tsconfig.json /upflow/tsconfig.json
COPY --from=build /upflow/start.sh /upflow/start.sh
COPY --from=build /upflow/app /upflow/app
COPY --from=build /upflow/batch /upflow/batch
COPY --from=build /upflow/server.mjs /upflow/server.mjs

CMD [ "sh", "./start.sh" ]
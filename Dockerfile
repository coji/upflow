# base node image
FROM node:16-bullseye-slim as base

# set for base and all layer that inherit from it
ENV NODE_ENV production

# Install openssl for Prisma
RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl sqlite3 procps \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* 

# Install all node_modules, including dev dependencies
FROM base as deps

WORKDIR /upflow

COPY package.json .npmrc ./
RUN npm install --include=dev

# Setup production node_modules
FROM base as production-deps

WORKDIR /upflow

COPY --from=deps /upflow/node_modules /upflow/node_modules
COPY package.json .npmrc ./
RUN npm prune --production

# Build the app
FROM base as build

WORKDIR /upflow

COPY --from=deps /upflow/node_modules /upflow/node_modules
COPY package.json .npmrc ./

COPY prisma .
RUN npx prisma generate

COPY . .
RUN npm run build

# Finally, build the production image with minimal footprint
FROM base

ENV DATABASE_URL=file:/upflow/data/data.db?connection_limit=1
ENV UPFLOW_DATA_DIR=/upflow/data
ENV PORT="8080"
ENV NODE_ENV="production"

# add shortcut for connecting to database CLI
RUN printf '#!/bin/sh\nset -x\nsqlite3 file:/upflow/data/data.db\n' > /usr/local/bin/database-cli && chmod +x /usr/local/bin/database-cli

WORKDIR /upflow

COPY --from=production-deps /upflow/node_modules /upflow/node_modules
COPY --from=build /upflow/node_modules/.prisma /upflow/node_modules/.prisma

COPY --from=build /upflow/build /upflow/build
COPY --from=build /upflow/public /upflow/public
COPY --from=build /upflow/package.json /upflow/package.json
COPY --from=build /upflow/start.sh /upflow/start.sh
COPY --from=build /upflow/prisma /upflow/prisma
COPY --from=build /upflow/dist /upflow/dist
COPY server.js /upflow/server.js

ENTRYPOINT [ "./start.sh" ]

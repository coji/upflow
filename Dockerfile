# base node image
FROM node:18-bullseye-slim as base

# Install openssl for Prisma
RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl openssh-client sqlite3 procps vim-tiny \
  && apt-get clean \
  && npm i -g bun \
  && rm -rf /var/lib/apt/lists/* 

ENV DATABASE_URL "file:/upflow/data/data.db?connection_limit=1"
ENV UPFLOW_DATA_DIR "/upflow/data"
ENV PORT "8080"
ENV NODE_ENV "production"
WORKDIR /upflow

# Setup production node_modules
FROM base as production-deps

COPY package.json bun.lockb ./
RUN bun install --production --frozen-lockfile


# Build the app
FROM base as build

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run prisma generate \
  && bun run build


FROM base

RUN printf '#!/bin/sh\nset -x\nsqlite3 file:/upflow/data/data.db\n' > /usr/local/bin/database-cli && chmod +x /usr/local/bin/database-cli


COPY --from=production-deps /upflow/node_modules /upflow/node_modules
COPY --from=build /upflow/node_modules/.prisma /upflow/node_modules/.prisma
COPY --from=build /upflow/build /upflow/build
COPY --from=build /upflow/public /upflow/public
COPY --from=build /upflow/prisma /upflow/prisma
COPY --from=build /upflow/package.json /upflow/package.json
COPY --from=build /upflow/start.sh /upflow/start.sh
COPY --from=build /upflow/app /upflow/app
COPY --from=build /upflow/batch /upflow/batch
COPY --from=build /upflow/server.ts /upflow/server.ts

CMD [ "sh", "./start.sh" ]

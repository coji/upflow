#!/bin/sh

# This file is how Fly starts the server (configured in fly.toml). Before starting
# the server though, we need to run any prisma migrations that haven't yet been
# run, which is why this file exists in the first place.
# Learn more: https://community.fly.io/t/sqlite-not-getting-setup-properly/4386

set -exm
echo DATABASE_URL is $DATABASE_URL
npx -y prisma migrate deploy
npx -y prisma generate
node --enable-source-maps dist/index.js &
node node_modules/@remix-run/serve/dist/cli.js build &
fg %1

#!/bin/sh
set -e

# Applies any migrations that haven't run yet against DATABASE_URL, then
# starts the server. Safe to run on every container start/restart.
npx prisma migrate deploy

exec "$@"

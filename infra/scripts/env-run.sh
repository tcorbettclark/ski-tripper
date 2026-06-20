#!/usr/bin/env bash
# Source .env (exporting all vars) then exec the given command.
# Supports $VAR and ${VAR} references in the command string,
# expanded after .env is loaded.
# Usage: env-run.sh <command with optional $VAR refs>
# Example: env-run.sh 'caddy run'
# Example: env-run.sh 'pocketbase serve --http ${POCKETBASE_HOSTNAME}:${POCKETBASE_PORT}'

set -a
source "$(dirname "$0")/../../.env"
set +a
eval exec "$@"
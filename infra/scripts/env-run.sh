#!/usr/bin/env bash
# Source an env file (exporting all vars) then exec the given command.
# Supports $VAR and ${VAR} references in the command string,
# expanded after .env is loaded.
# Usage: env-run.sh <env-file> <command with optional $VAR refs>
# Example: env-run.sh .env 'caddy run'
# Example: env-run.sh .env 'pocketbase serve --http ${POCKETBASE_HOSTNAME}:${POCKETBASE_PORT}'
# Example: env-run.sh /opt/ski-tripper/.env 'cd /home/ski-tripper/ski-tripper && bun run build'

if [ $# -lt 2 ]; then
  echo "Usage: env-run.sh <env-file> <command>" >&2
  echo "  env-run.sh .env 'pocketbase serve --http \${POCKETBASE_HOSTNAME}:\${POCKETBASE_PORT}'" >&2
  exit 1
fi

set -a
source "$1"
set +a
shift
eval exec "$@"
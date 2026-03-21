#!/usr/bin/env bash
# Levanta SDP con EC256_PRIVATE_KEY cargada desde config/ec256-dev.pem
# Uso: ./scripts/sdp-up.sh  o  bash scripts/sdp-up.sh

set -e
cd "$(dirname "$0")/.."

# Cargar clave EC256 para dev (si no está definida)
if [ -z "${EC256_PRIVATE_KEY}" ] && [ -f "config/ec256-dev.pem" ]; then
  export EC256_PRIVATE_KEY="$(cat config/ec256-dev.pem)"
fi

exec docker compose up "$@"

#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PORT:-}" ]]; then
  echo "PORT is required." >&2
  exit 64
fi

if [[ ! "$PORT" =~ ^[0-9]+$ ]]; then
  echo "PORT must be an integer between 1 and 65535." >&2
  exit 64
fi

port_number=$((10#$PORT))
if ((port_number < 1 || port_number > 65535)); then
  echo "PORT must be an integer between 1 and 65535." >&2
  exit 64
fi

export HOSTNAME="0.0.0.0"
export NODE_ENV="production"

exec node .next/standalone/server.js

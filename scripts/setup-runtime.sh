#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$project_root"

project_key="$(printf '%s' "$project_root" | sha256sum | cut -d ' ' -f 1)"
lock_file="/var/tmp/zhenghao-project-desk-${project_key}.lock"

exec 9>"$lock_file"
flock 9

dependency_hash="$(sha256sum package.json package-lock.json .npmrc | sha256sum | cut -d ' ' -f 1)"
dependency_marker="node_modules/.project-desk-dependency-hash"

if [[ ! -d node_modules ]] || [[ ! -f "$dependency_marker" ]] ||
  [[ "$(<"$dependency_marker")" != "$dependency_hash" ]]; then
  npm ci --ignore-scripts --no-audit --no-fund
  printf '%s\n' "$dependency_hash" >"$dependency_marker"
fi

npm run build

if [[ ! -f .next/standalone/server.js ]]; then
  echo "standalone server is missing" >&2
  exit 1
fi

if [[ ! -d .next/standalone/.next/static ]]; then
  echo "standalone static assets are missing" >&2
  exit 1
fi

if [[ ! -d .next/standalone/public ]]; then
  echo "standalone public assets are missing" >&2
  exit 1
fi

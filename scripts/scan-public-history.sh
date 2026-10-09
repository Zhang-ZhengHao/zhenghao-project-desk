#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

if (($# == 0)); then
  set -- "$script_directory/.."
fi

exec python3 "$script_directory/scan_public_history.py" "$@"

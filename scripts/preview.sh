#!/usr/bin/env bash
# Launch a local preview of Universal Painter.
# Runs the dev server in the foreground — press Ctrl-C to stop.
#
#   Usage:  ./scripts/preview.sh [port]     (default 5212)
#
# 5212 is this app's port in the registry (Docs_UNI_SIM/dev-preview.md).
# --strictPort means a port clash fails loudly instead of silently serving this
# app on another app's port.
# First run installs deps if node_modules is missing.
#
set -euo pipefail
cd "$(dirname "$0")/.."

port="${1:-5212}"

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)..."
  npm install
fi

echo "Universal Painter -> http://localhost:$port"
npm run dev -- --port "$port" --strictPort

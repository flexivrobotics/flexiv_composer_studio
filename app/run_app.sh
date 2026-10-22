#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd -- "$SCRIPT_DIR/frontend" && pwd)"
DIST_DIR="$FRONTEND_DIR/dist"

cd "$FRONTEND_DIR"
npm run build

python3 "$SCRIPT_DIR/backend/web_server.py" 8011 --directory "$DIST_DIR" &
SERVER_PID=$!

sleep 1
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:8011"
elif command -v open &>/dev/null; then
    open "http://localhost:8011"
fi

wait $SERVER_PID

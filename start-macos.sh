#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

HOST="${HOST:-127.0.0.1}"
BASE_PORT="${PORT:-8788}"

find_available_port() {
  local start="$1"
  local candidate
  for offset in $(seq 0 19); do
    candidate=$((start + offset))
    if ! lsof -nP -iTCP:"${candidate}" -sTCP:LISTEN >/dev/null 2>&1; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done
  echo "No available local port found starting at ${start}." >&2
  return 1
}

PORT="$(find_available_port "${BASE_PORT}")"
URL="http://localhost:${PORT}"

if ! command -v node >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Node.js is required to run ChessPrep Lab locally on macOS.
Install it with Homebrew:
  brew install node
EOF
  exit 1
fi

echo "Starting ChessPrep Lab at ${URL}"
echo "Press Ctrl+C in this Terminal window to stop the server."

if command -v open >/dev/null 2>&1; then
  (sleep 1 && open "${URL}") >/dev/null 2>&1 &
fi

HOST="${HOST}" PORT="${PORT}" node server.mjs

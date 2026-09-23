#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Running sprite manifest validation..."
npm run sprites:validate

echo "Starting MegaMan dev server..."
npm run dev -- --open

#!/usr/bin/env bash
# Старт контейнера: npm install (кэш в volume) → node server.mjs
set -euo pipefail
cd /app
echo "[resume] npm install --omit=dev"
npm install --omit=dev
exec node server.mjs

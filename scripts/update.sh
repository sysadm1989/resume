#!/usr/bin/env bash
# Обновление на сервере: git pull → docker compose up --build
#
#   cd /opt/resume && ./scripts/update.sh
#   BRANCH=main ./scripts/update.sh
#   SKIP_PULL=1 ./scripts/update.sh   # только пересборка
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${BRANCH:-}"
SKIP_PULL="${SKIP_PULL:-0}"

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Нет .env — скопируйте: cp .env.example .env && отредактируйте"
  exit 1
fi

if [[ "$SKIP_PULL" != "1" ]]; then
  if [[ ! -d .git ]]; then
    echo "Каталог не git-репозиторий: $ROOT"
    echo "Склонируйте: git clone git@github.com:sysadm1989/resume.git $ROOT"
    exit 1
  fi
  echo "==> git fetch / pull"
  git fetch --prune origin
  if [[ -n "$BRANCH" ]]; then
    git checkout "$BRANCH"
    git pull --ff-only origin "$BRANCH"
  else
    git pull --ff-only
  fi
  echo "    $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"
fi

echo "==> docker compose up -d --build"
docker compose --env-file .env up -d --build --remove-orphans
sleep 2
curl -fsS "http://127.0.0.1:${PORT:-8787}/api/health" && echo
docker compose ps
echo "==> done"

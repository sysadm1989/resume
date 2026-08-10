#!/usr/bin/env bash
# Быстрый деплой resume-сайта на Linux-сервер по SSH.
# Пример:
#   ./scripts/deploy.sh user@resume.example.com
#   DEPLOY_PATH=/opt/resume ./scripts/deploy.sh user@host
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/resume}"
SSH_OPTS="${SSH_OPTS:-}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 user@host"
  echo "Env: DEPLOY_PATH=/opt/resume  SSH_OPTS='-i ~/.ssh/id_ed25519'"
  exit 1
fi

echo "==> sync → ${TARGET}:${DEPLOY_PATH}"
ssh $SSH_OPTS "$TARGET" "sudo mkdir -p '$DEPLOY_PATH' && sudo chown \"\$(id -u):\$(id -g)\" '$DEPLOY_PATH'"

rsync -az --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude '*.log' \
  -e "ssh $SSH_OPTS" \
  "$ROOT/" "$TARGET:$DEPLOY_PATH/"

echo "==> remote install + restart"
ssh $SSH_OPTS "$TARGET" bash -s <<EOF
set -euo pipefail
cd '$DEPLOY_PATH'
if [[ ! -f .env ]]; then
  cp .env.example .env
  # подставить домашний каталог текущего пользователя
  sed -i "s|/home/YOU|\$HOME|g" .env || true
  echo "Created .env — проверьте OPENCODE_MODEL и креды OpenCode"
fi

# Node 20+
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Установите Node 20+ (см. README) и повторите."
  exit 1
fi

# OpenCode
if ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode не найден — ставлю через официальный installer…"
  curl -fsSL https://opencode.ai/install | bash
  export PATH="\$HOME/.opencode/bin:\$PATH"
fi

npm install --omit=dev

if command -v systemctl >/dev/null 2>&1; then
  UNIT_SRC='$DEPLOY_PATH/deploy/resume.service'
  if [[ -f "\$UNIT_SRC" ]]; then
    # подставить пользователя и пути
    tmp=\$(mktemp)
    sed -e "s|__USER__|\$(id -un)|g" \
        -e "s|__WORKDIR__|$DEPLOY_PATH|g" \
        -e "s|__NODE__|\$(command -v node)|g" \
        "\$UNIT_SRC" > "\$tmp"
    sudo cp "\$tmp" /etc/systemd/system/resume.service
    rm -f "\$tmp"
    sudo systemctl daemon-reload
    sudo systemctl enable --now resume.service
    sudo systemctl restart resume.service
    sleep 1
    systemctl --no-pager --full status resume.service | head -20 || true
  fi
else
  echo "systemctl нет — запускаю в screen/tmux вручную не пытаюсь. Используйте: npm start"
fi

curl -fsS "http://127.0.0.1:\${PORT:-8787}/api/health" && echo
EOF

echo "==> done. Откройте http://SERVER:8787 (или через nginx, см. README)"

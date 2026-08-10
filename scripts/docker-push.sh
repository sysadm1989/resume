#!/usr/bin/env bash
# Сборка образа и push в Docker Hub.
#
#   ./scripts/docker-push.sh
#   DOCKER_IMAGE=sysadm1989/resume:1.0.0 ./scripts/docker-push.sh
#   PUSH=0 ./scripts/docker-push.sh          # только build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${DOCKER_IMAGE:-sysadm1989/resume:latest}"
PUSH="${PUSH:-1}"
PLATFORM="${PLATFORM:-linux/amd64}"

echo "==> build ${IMAGE} (${PLATFORM})"
docker build --platform "$PLATFORM" -t "$IMAGE" .

if [[ "$PUSH" == "1" ]]; then
  echo "==> push ${IMAGE}"
  docker push "$IMAGE"
  echo "==> done: https://hub.docker.com/r/${IMAGE%:*}"
else
  echo "==> push пропущен (PUSH=0)"
fi

# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.mjs ./
COPY lib ./lib
COPY assets ./assets
COPY content ./content
COPY prompts ./prompts
COPY public ./public

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/api/health >/dev/null || exit 1

CMD ["node", "server.mjs"]

# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

# OpenCode CLI (match engine). Auth/config mounted at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl bash \
  && curl -fsSL https://opencode.ai/install | bash \
  && if [ -x /root/.opencode/bin/opencode ]; then ln -sf /root/.opencode/bin/opencode /usr/local/bin/opencode; fi \
  && opencode --version \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.mjs ./
COPY content ./content
COPY prompts ./prompts
COPY public ./public

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    OPENCODE_BIN=opencode \
    OPENCODE_MODEL=opencode/deepseek-v4-flash-free

EXPOSE 8787
CMD ["node", "server.mjs"]
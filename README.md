# Resume

Сайт-резюме + сравнение вакансии (Hugging Face API).

| | |
|--|--|
| Репозиторий | https://github.com/sysadm1989/resume.git |
| Каталог на сервере | `/opt/resume` |
| Приложение | Docker: образ `node:22-bookworm-slim`, **без build** |
| Файлы | весь репо монтируется в контейнер (`.:/app`) |
| Снаружи | nginx + Let's Encrypt → `127.0.0.1:8787` |
| Match | `HF_TOKEN` → `router.huggingface.co` |

```
браузер → :443 nginx → 127.0.0.1:8787 (node в Docker)
                              │
                              ├─ /opt/resume → /app (mount)
                              └─ /api/match → Hugging Face
```

`.env` с `HF_TOKEN` в git **не** коммитится.

---

## Быстрый старт на сервере (root)

### 1. Пакеты

```bash
apt-get update -y
apt-get install -y docker.io docker-compose-v2 git curl
systemctl enable --now docker
```

### 2. Код

```bash
cd /opt
git clone https://github.com/sysadm1989/resume.git
cd /opt/resume
chmod +x scripts/*.sh
```

### 3. Конфиг

```bash
cp .env.example .env
nano .env
```

Обязательно:

```bash
HF_TOKEN=hf_...          # https://huggingface.co/settings/tokens
                         # право: Make calls to the Inference Providers
DOMAIN=resume.example.com
LETSENCRYPT_EMAIL=you@example.com
```

Остальное по умолчанию ок:

```bash
HF_API_BASE=https://router.huggingface.co/v1
HF_MODEL=Qwen/Qwen2.5-7B-Instruct:cheapest
PORT=8787
```

### 4. Приложение

DNS домена уже должен смотреть на сервер (для TLS). Порт **8787 наружу не открывать**.

```bash
cd /opt/resume
docker compose up -d
curl -fsS http://127.0.0.1:8787/api/health | python3 -m json.tool
```

Ожидание: `"llmOk": true`. Если `false` — неверный/пустой `HF_TOKEN`.

Первый старт дольше: внутри контейнера `npm install` (кэш в volume `resume_node_modules`).

### 5. HTTPS

```bash
cd /opt/resume
DOMAIN=resume.example.com LETSENCRYPT_EMAIL=you@example.com ./scripts/setup-ssl.sh
curl -fsS https://resume.example.com/api/health | python3 -m json.tool
```

### 6. Проверка сравнения

```bash
curl -fsS -X POST https://resume.example.com/api/match \
  -H 'Content-Type: application/json' \
  -d '{"text":"DevOps Kubernetes GitLab CI Argo CD Vault"}' \
  | python3 -m json.tool
```

---

## Обновление

После `git push` в GitHub:

```bash
cd /opt/resume
./scripts/update.sh
```

Это: `git pull` → `docker compose up -d --force-recreate` (образа приложения нет).

| Что меняли | Нужно |
|------------|--------|
| `content/`, `public/`, `prompts/` | часто хватит `git pull` |
| `server.mjs`, `package.json`, `.env` | `./scripts/update.sh` |

---

## Локально (разработка / тест)

```bash
git clone https://github.com/sysadm1989/resume.git && cd resume
cp .env.example .env    # HF_TOKEN=...
npm install && npm start
# http://127.0.0.1:8787
```

Или тем же compose, что на проде:

```bash
docker compose up -d
```

Проверки:

```bash
npm run health
npm run smoke
curl -fsS http://127.0.0.1:8787/api/llm | python3 -m json.tool
curl -fsS -o /tmp/r.pdf http://127.0.0.1:8787/api/resume.pdf && file /tmp/r.pdf
```

---

## Переменные `.env`

| Переменная | Зачем |
|------------|--------|
| `HF_TOKEN` | токен Hugging Face (обязательно для match) |
| `HF_API_BASE` | `https://router.huggingface.co/v1` |
| `HF_MODEL` | модель chat completions |
| `LLM_TIMEOUT_MS` | таймаут match (мс), по умолчанию `120000` |
| `MAX_VACANCY_CHARS` | лимит текста вакансии |
| `DOMAIN` | для `setup-ssl.sh` |
| `LETSENCRYPT_EMAIL` | для Let's Encrypt |

Смена модели/токена:

```bash
nano /opt/resume/.env
cd /opt/resume && docker compose up -d --force-recreate
```

---

## Скрипты

| Файл | Назначение |
|------|------------|
| `scripts/docker-entrypoint.sh` | `npm install` + `node server.mjs` в контейнере |
| `scripts/update.sh` | обновление с GitHub |
| `scripts/setup-ssl.sh` | nginx + certbot |
| `scripts/ui-smoke.mjs` | smoke UI |

---

## Troubleshooting

| Симптом | Что сделать |
|---------|-------------|
| `llmOk: false` | `HF_TOKEN` в `.env`, не `hf_xxxxxxxx` |
| Match 401/403 | токен + право Inference Providers |
| Match 429 | лимит HF — подождать или другая `HF_MODEL` |
| 502 от nginx | `curl -s http://127.0.0.1:8787/api/health`, `docker compose ps` |
| HTTPS / certbot | DNS, порты 80/443, `nginx -t`, `certbot certificates` |
| Контейнер не стартует | `docker compose logs -f resume` |

```bash
cd /opt/resume
docker compose logs -f --tail=100 resume
curl -fsS http://127.0.0.1:8787/api/llm | python3 -m json.tool
```

TLS переустановить:

```bash
cd /opt/resume
DOMAIN=… LETSENCRYPT_EMAIL=… ./scripts/setup-ssl.sh
certbot renew --dry-run
```

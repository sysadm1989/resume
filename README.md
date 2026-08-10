# Resume

Сайт-резюме + сравнение вакансии (Hugging Face API).

| | |
|--|--|
| Репозиторий | https://github.com/sysadm1989/resume.git |
| Образ | `sysadm1989/resume:latest` (Docker Hub) |
| Каталог на сервере | `/opt/resume` (compose + `.env` + mount `content/`/`prompts/`) |
| Снаружи | nginx + Let's Encrypt → `127.0.0.1:8787` |

```
браузер → :443 nginx → контейнер resume (образ с Docker Hub)
                              │
                              ├─ mount: ./content, ./prompts
                              └─ /api/match → Hugging Face
```

`.env` с `HF_TOKEN` в git **не** коммитится.

---

## Сборка и push в Docker Hub (с ноутбука)

Один раз: `docker login` (логин Docker Hub).

```bash
cd ~/Documents/resume   # или клон репо
chmod +x scripts/*.sh
./scripts/docker-push.sh
```

По умолчанию: `sysadm1989/resume:latest`, платформа `linux/amd64`.

```bash
# другой тег
DOCKER_IMAGE=sysadm1989/resume:1.0.0 ./scripts/docker-push.sh

# только сборка, без push
PUSH=0 ./scripts/docker-push.sh
```

---

## Деплой на сервере (root)

ОС: **Ubuntu 26.04** (resolute) и совместимые 22.04/24.04. DNS A/AAAA → сервер. Порт **8787 наружу не открывать**.

### 1. Пакеты

```bash
apt-get update -y
apt-get install -y docker.io docker-compose-v2 git curl
systemctl enable --now docker
docker compose version
```

### 2. Код (для compose, .env, SSL, content)

```bash
cd /opt
git clone https://github.com/sysadm1989/resume.git
cd /opt/resume
chmod +x scripts/*.sh
```

### 3. `.env`

```bash
cp .env.example .env
nano .env
```

```bash
DOCKER_IMAGE=sysadm1989/resume:latest
HF_TOKEN=hf_...          # https://huggingface.co/settings/tokens
                         # право: Make calls to the Inference Providers
DOMAIN=alexnazarov.site
LETSENCRYPT_EMAIL=alexnazarov89@yandex.ru
```

### 4. Запуск образа

```bash
cd /opt/resume
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8787/api/health | python3 -m json.tool
# "llmOk": true
```

Порт **8787 наружу не открывать**. DNS домена → сервер (для TLS).

### 5. HTTPS

```bash
DOMAIN=alexnazarov.site LETSENCRYPT_EMAIL=alexnazarov89@yandex.ru ./scripts/setup-ssl.sh
curl -fsS https://alexnazarov.site/api/health | python3 -m json.tool
```

### 6. Match

```bash
curl -fsS -X POST https://alexnazarov.site/api/match \
  -H 'Content-Type: application/json' \
  -d '{"text":"DevOps Kubernetes GitLab CI Argo CD Vault"}' \
  | python3 -m json.tool
```

---

## Обновление

**После изменения кода** (ноутбук):

```bash
./scripts/docker-push.sh
```

**На сервере:**

```bash
cd /opt/resume
./scripts/update.sh
```

`git pull` + `docker compose pull` + `up -d`.

Только текст резюме/фото (`content/`) — достаточно `git pull` на сервере (том смонтирован, образ не нужен).

Локальная сборка на сервере без Hub:

```bash
SKIP_IMAGE=1 ./scripts/update.sh
```

---

## Локально

```bash
cp .env.example .env    # HF_TOKEN=...
npm install && npm start
# или
docker compose up -d --build
```

```bash
npm run health
npm run smoke
```

---

## Переменные `.env`

| Переменная | Зачем |
|------------|--------|
| `DOCKER_IMAGE` | образ, по умолчанию `sysadm1989/resume:latest` |
| `HF_TOKEN` | токен Hugging Face (match) |
| `HF_API_BASE` | `https://router.huggingface.co/v1` |
| `HF_MODEL` | модель chat |
| `LLM_TIMEOUT_MS` | таймаут match |
| `DOMAIN` / `LETSENCRYPT_EMAIL` | SSL |

---

## Скрипты

| Файл | Назначение |
|------|------------|
| `scripts/docker-push.sh` | build + push в Docker Hub |
| `scripts/update.sh` | обновление на сервере |
| `scripts/setup-ssl.sh` | nginx + certbot |
| `scripts/ui-smoke.mjs` | smoke UI |

---

## Troubleshooting

| Симптом | Действие |
|---------|----------|
| `llmOk: false` | `HF_TOKEN` в `.env` |
| pull denied | `docker login` на сервере или сделайте репозиторий public |
| 502 | `curl -s http://127.0.0.1:8787/api/health`, `docker compose logs -f resume` |
| certbot | DNS, 80/443, `nginx -t` |

```bash
cd /opt/resume
docker compose logs -f --tail=100 resume
docker compose pull && docker compose up -d
```

# Resume

Сайт-резюме + сравнение вакансии (OpenCode).

**Прод:** Docker Compose (`127.0.0.1:8787`) ← nginx + Let's Encrypt  
**Репо:** `git@github.com:sysadm1989/resume.git` → `/opt/resume`

```
Internet :80/:443 → nginx (TLS) → 127.0.0.1:8787 (container)
                                      ↑
                         OPENCODE_CONFIG_DIR (host) mount
```

| Скрипт | Назначение |
|--------|------------|
| `scripts/update.sh` | на сервере: `git pull` + rebuild |
| `scripts/setup-ssl.sh` | nginx + Let's Encrypt |
| `scripts/ui-smoke.mjs` | smoke UI (локально / против URL) |

`.env` и `~/.config/opencode` в git **не** входят.

---

## Локальный запуск

Нужны: Node ≥ 20, OpenCode CLI + auth.

```bash
git clone git@github.com:sysadm1989/resume.git
cd resume
cp .env.example .env
# OPENCODE_CONFIG_DIR=$HOME/.config/opencode

curl -fsSL https://opencode.ai/install | bash
export PATH="$HOME/.opencode/bin:$PATH"
opencode auth

npm install
npm start          # http://127.0.0.1:8787
# npm run dev      # с --watch
```

Или через Docker (как на проде, без nginx):

```bash
cp .env.example .env
# OPENCODE_CONFIG_DIR=$HOME/.config/opencode
docker compose --env-file .env up -d --build
curl -fsS http://127.0.0.1:8787/api/health | python3 -m json.tool
```

---

## Тестирование

```bash
# сервис должен быть запущен (npm start или compose)
npm run health

curl -fsS http://127.0.0.1:8787/api/opencode | python3 -m json.tool
# ожидайте opencodeOk: true

node scripts/ui-smoke.mjs
# npm run smoke
# BASE_URL=https://your.domain npm run smoke

# match
curl -fsS -X POST http://127.0.0.1:8787/api/match \
  -H 'Content-Type: application/json' \
  -d '{"text":"DevOps Kubernetes GitLab CI Argo CD Vault"}' \
  | python3 -m json.tool

# PDF
curl -fsS -o /tmp/resume.pdf http://127.0.0.1:8787/api/resume.pdf
file /tmp/resume.pdf
```

---

## Деплой из GitHub

ОС: Ubuntu/Debian. DNS A/AAAA → сервер. Порты 80/443 снаружи; **8787 наружу не открывать**.

### 1. Docker

```bash
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 git curl
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
# newgrp docker  или перелогин
```

### 2. Clone

```bash
sudo mkdir -p /opt/resume
sudo chown "$(id -u):$(id -g)" /opt/resume
git clone git@github.com:sysadm1989/resume.git /opt/resume
cd /opt/resume && chmod +x scripts/*.sh
```

Нет доступа — deploy key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/resume_deploy -N ''
# pubkey → GitHub → Deploy keys (RO)
printf '%s\n' 'Host github.com' '  IdentityFile ~/.ssh/resume_deploy' '  IdentitiesOnly yes' >> ~/.ssh/config
```

### 3. OpenCode auth (хост, один раз)

Auth на хосте, каталог монтируется в контейнер (CLI уже в образе).

```bash
curl -fsSL https://opencode.ai/install | bash
export PATH="$HOME/.opencode/bin:$PATH"
opencode auth
ls -la ~/.config/opencode
```

### 4. `.env`

```bash
cd /opt/resume
cp .env.example .env
```

```bash
OPENCODE_CONFIG_DIR=/home/ВАШ_USER/.config/opencode   # не /home/YOU/...
DOMAIN=resume.example.com
LETSENCRYPT_EMAIL=you@example.com
```

```bash
test -d "$(grep '^OPENCODE_CONFIG_DIR=' .env | cut -d= -f2-)" && echo OK
```

### 5. Приложение

```bash
cd /opt/resume
docker compose --env-file .env up -d --build
curl -fsS http://127.0.0.1:8787/api/health | python3 -m json.tool
# нужно: "opencodeOk": true
```

### 6. nginx + Let's Encrypt

DNS уже указывает на сервер; health на localhost ок.

```bash
cd /opt/resume
DOMAIN=resume.example.com LETSENCRYPT_EMAIL=you@example.com ./scripts/setup-ssl.sh
curl -fsS "https://resume.example.com/api/health" | python3 -m json.tool
```

Продление сертификата — timer certbot (`systemctl list-timers | grep certbot`).

### 7. Проверка match на проде

```bash
curl -fsS -X POST "https://resume.example.com/api/match" \
  -H 'Content-Type: application/json' \
  -d '{"text":"DevOps Kubernetes GitLab CI Argo CD Vault"}' \
  | python3 -m json.tool
```

---

## OpenCode

| Где | Что |
|-----|-----|
| Хост | `opencode auth` → `$HOME/.config/opencode` |
| `.env` | `OPENCODE_CONFIG_DIR` = этот каталог |
| Compose | volume → `/root/.config/opencode` |
| API | `POST /api/match` → `opencode run` |

Сменили user/home → обновить `OPENCODE_CONFIG_DIR` + `docker compose up -d`.  
Сменили модель → `OPENCODE_MODEL` + `docker compose up -d`.

---

## Обновление (после push в GitHub)

```bash
cd /opt/resume
./scripts/update.sh
# SKIP_PULL=1 ./scripts/update.sh
```

| Изменили | Действие |
|----------|----------|
| `content/`, `prompts/` | `git pull` достаточно |
| код / Docker / `public/` | `./scripts/update.sh` |
| только `.env` | `docker compose --env-file .env up -d` |

---

## TLS снова

```bash
cd /opt/resume
DOMAIN=… LETSENCRYPT_EMAIL=… ./scripts/setup-ssl.sh
sudo certbot renew --dry-run
sudo nginx -t && sudo systemctl reload nginx
```

---

## Troubleshooting

| Симптом | Действие |
|---------|----------|
| HTTPS нет | DNS, `nginx -t`, `systemctl status nginx`, `certbot certificates` |
| certbot fail | A-запись, 80/443 свободны снаружи |
| 502 | `curl -s http://127.0.0.1:8787/api/health`, `docker compose ps/logs` |
| `opencodeOk: false` | путь в `.env`, был `opencode auth`, пересоздать контейнер |
| Match auth / makeDirectory | убрать `/home/YOU/...`, снова `opencode auth` |
| Match timeout / model | сеть контейнера, `OPENCODE_MODEL`, логи |
| `git pull` rejected | на сервере не править tracked-файлы |

```bash
cd /opt/resume
docker compose logs -f --tail=100 resume
curl -fsS http://127.0.0.1:8787/api/opencode | python3 -m json.tool
ls -la "$(grep '^OPENCODE_CONFIG_DIR=' .env | cut -d= -f2-)"
sudo tail -n 50 /var/log/nginx/error.log
```
